import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { conferirNovoVinculoReceber } from '../../shared/validarComposicaoReceber.ts';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Reconcilia retroativamente TituloCobranca órfãos (sem nota_fiscal_id) com NotaFiscal.
// Exige referência explícita e composição integral da nota.

function extractNFCIRef(value) {
  if (!value) return null;
  const s = String(value).toUpperCase().trim();
  const m = s.match(/^(NF|CI)[\s\-]*0*(\d+)$/);
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
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const [titulos, notas] = await Promise.all([
      svc.TituloCobranca.list('-created_date', 5000),
      svc.NotaFiscal.list('-data_emissao', 5000),
    ]);

    const orfaos = titulos.filter(t => !t.nota_fiscal_id);

    const nfPorNum = new Map();
    notas.forEach(n => {
      const key = `${n.tipo}-${String(n.numero).trim().replace(/^0+(?=\d)/, '')}`;
      nfPorNum.set(key, nfPorNum.has(key) ? null : n);
    });

    const candidatos = new Map();
    for (const t of orfaos) {
      const ref = extractNFCIRef(t.seu_numero);
      const nf = ref && nfPorNum.get(`${ref.tipo}-${ref.numero}`);
      if (!nf) continue;
      if (!candidatos.has(nf.id)) candidatos.set(nf.id, { nf, titulos: [] });
      candidatos.get(nf.id).titulos.push(t);
    }
    const matches = [], divergencias = [];
    for (const { nf, titulos } of candidatos.values()) {
      const erro = await conferirNovoVinculoReceber(svc, nf, titulos);
      if (erro) { divergencias.push(erro); continue; }
      for (const t of titulos) matches.push({ titulo_id: t.id, titulo: t, nota_fiscal_id: nf.id, nf: { tipo: nf.tipo, numero: nf.numero, cliente: nf.cliente, valor_total: nf.valor_total }, metodo: 'seu_numero', confianca: 100 });
    }
    const matchExato = matches.length, matchFuzzy = 0, semMatch = orfaos.length - matches.length;
    if (dryRun) {
      return Response.json({
        grupos_divergentes: divergencias.length,
        dry_run: true,
        total_orfaos: orfaos.length,
        match_exato: matchExato,
        match_fuzzy: matchFuzzy,
        sem_match: semMatch,
        total_para_vincular: matches.length,
        matches: matches.slice(0, 100),
      });
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