import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Reconcilia retroativamente TituloCobranca órfãos (sem nota_fiscal_id) com NotaFiscal.
// Estágio 1: seu_numero direto (NF-XXX / CI-XXXXXX) → match exato.
// Estágio 2: fuzzy por cliente normalizado + valor_titulo ≈ valor_total/N (parcelas 1..12).

function normalizeCliente(c) {
  return (c || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

function extractNFCIRef(value) {
  if (!value) return null;
  const s = String(value).toUpperCase().trim();
  const m = s.match(/(NF|CI)[\s\-]*0*(\d+)/);
  if (m) return { tipo: m[1], numero: m[2] };
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run !== false; // default true
    const minConfianca = Number(body?.min_confianca || 70);

    const svc = base44.asServiceRole.entities;
    const [titulos, notas] = await Promise.all([
      svc.TituloCobranca.list('-created_date', 5000),
      svc.NotaFiscal.list('-data_emissao', 5000),
    ]);

    const orfaos = titulos.filter(t => !t.nota_fiscal_id);

    const nfPorNum = new Map();
    notas.forEach(n => {
      const key = `${n.tipo}-${String(n.numero).trim()}`;
      nfPorNum.set(key, n);
    });

    const nfPorCliente = new Map();
    notas.forEach(n => {
      const cli = normalizeCliente(n.cliente);
      if (!cli) return;
      if (!nfPorCliente.has(cli)) nfPorCliente.set(cli, []);
      nfPorCliente.get(cli).push(n);
    });

    const matches = [];
    let matchExato = 0, matchFuzzy = 0, semMatch = 0;

    for (const t of orfaos) {
      // Estágio 1: seu_numero / nosso_numero direto
      const ref = extractNFCIRef(t.seu_numero) || extractNFCIRef(t.nosso_numero);
      if (ref) {
        const key = `${ref.tipo}-${ref.numero}`;
        const nf = nfPorNum.get(key);
        if (nf) {
          matches.push({
            titulo_id: t.id,
            titulo: { nosso_numero: t.nosso_numero, seu_numero: t.seu_numero, cliente: t.cliente, data_vencimento: t.data_vencimento, valor_titulo: t.valor_titulo },
            nota_fiscal_id: nf.id,
            nf: { tipo: nf.tipo, numero: nf.numero, cliente: nf.cliente, valor_total: nf.valor_total },
            metodo: 'seu_numero',
            confianca: 100,
          });
          matchExato++;
          continue;
        }
      }

      // Estágio 2: fuzzy por cliente + valor
      const cli = normalizeCliente(t.cliente);
      if (!cli) { semMatch++; continue; }
      const candidatas = nfPorCliente.get(cli) || [];
      if (candidatas.length === 0) { semMatch++; continue; }

      const valorTitulo = Number(t.valor_titulo || 0);
      let bestMatch = null;
      let bestScore = 0;

      for (const nf of candidatas) {
        const valorTotal = Number(nf.valor_total || 0);
        if (valorTotal <= 0) continue;
        // Tenta N de 1 a 12 parcelas
        for (let n = 1; n <= 12; n++) {
          const esperado = valorTotal / n;
          const diff = Math.abs(esperado - valorTitulo);
          const tol = Math.max(0.50, valorTitulo * 0.02);
          if (diff <= tol) {
            const score = n === 1 ? 95 : Math.max(70, 95 - n * 2);
            if (score > bestScore) {
              bestMatch = { nf, n, diff };
              bestScore = score;
            }
            break;
          }
        }
      }

      if (bestMatch && bestScore >= minConfianca) {
        matches.push({
          titulo_id: t.id,
          titulo: { nosso_numero: t.nosso_numero, seu_numero: t.seu_numero, cliente: t.cliente, data_vencimento: t.data_vencimento, valor_titulo: t.valor_titulo },
          nota_fiscal_id: bestMatch.nf.id,
          nf: { tipo: bestMatch.nf.tipo, numero: bestMatch.nf.numero, cliente: bestMatch.nf.cliente, valor_total: bestMatch.nf.valor_total },
          metodo: `fuzzy_${bestMatch.n}x`,
          confianca: bestScore,
        });
        matchFuzzy++;
      } else {
        semMatch++;
      }
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_orfaos: orfaos.length,
        match_exato: matchExato,
        match_fuzzy: matchFuzzy,
        sem_match: semMatch,
        total_para_vincular: matches.length,
        matches: matches.slice(0, 100),
      });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only para apply' }, { status: 403 });
    }

    let atualizados = 0, erros = 0;
    for (const m of matches) {
      try {
        await svc.TituloCobranca.update(m.titulo_id, { nota_fiscal_id: m.nota_fiscal_id });
        atualizados++;
        await sleep(120);
      } catch {
        erros++;
      }
    }

    return Response.json({ dry_run: false, atualizados, erros, total_match: matches.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});