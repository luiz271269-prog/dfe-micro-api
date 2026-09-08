import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const round = (n) => Math.round((n || 0) * 100) / 100;
const normCli = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

// Extrai o número da NF/CI de um seu_numero ("NF-262", "NF-143-p2", "CI-100106")
function extrairNFRef(valor) {
  if (!valor) return null;
  const s = String(valor).toUpperCase();
  const m = s.match(/(NF|CI)[\s\-]*0*(\d+)/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Conciliação unificada Sicredi: cruza boletos pagos avulsos (BOL-) com as parcelas
 * estruturadas (TituloCobranca com NF + parcela) que ainda estão em aberto.
 *
 * Critério de match (NÃO usa o número do boleto):
 *   cliente (normalizado) + valor (tolerância R$ 0,50) + data_vencimento idêntica.
 *   Quando o boleto carrega referência de NF, ela também precisa bater.
 *
 * Ação por match:
 *   1. Marca a PARCELA estruturada como paga (data_pagamento + valor_pago do boleto).
 *   2. Apaga o boleto avulso (BOL-) duplicado.
 *
 * Payload: { dry_run?: boolean }  // default TRUE — só aplica quando dry_run=false
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Lê toda a carteira de cobrança via service role — restrito a admin, inclusive no dry_run
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run !== false;

    const svc = base44.asServiceRole.entities;
    const titulos = await svc.TituloCobranca.list('-data_vencimento', 10000);

    // Boletos avulsos pagos: nosso_numero começa com BOL-, status pago, sem parcela estruturada
    const bolPagos = titulos.filter((t) =>
      (t.nosso_numero || '').startsWith('BOL-') &&
      t.status === 'pago' &&
      !t.parcela_numero
    );

    // Parcelas estruturadas ainda em aberto (têm NF/CI + parcela)
    const parcelasAberto = titulos.filter((t) =>
      t.parcela_numero &&
      ['em_aberto', 'vencido'].includes(t.status) &&
      /NF|CI/i.test(t.seu_numero || '')
    );

    const matches = [];
    const usados = new Set();
    for (const bol of bolPagos) {
      const bolNFRef = extrairNFRef(bol.seu_numero); // normalmente null em BOL- avulso
      const cand = parcelasAberto.filter((p) => {
        if (usados.has(p.id)) return false;
        if (normCli(p.cliente) !== normCli(bol.cliente)) return false;
        if (Math.abs((p.valor_titulo || 0) - (bol.valor_titulo || 0)) > 0.50) return false;
        if (p.data_vencimento !== bol.data_vencimento) return false;
        // Se o boleto tiver referência de NF, ela precisa bater com a da parcela
        if (bolNFRef && extrairNFRef(p.seu_numero) !== bolNFRef) return false;
        return true;
      });
      if (cand.length >= 1) {
        const p = cand[0];
        usados.add(p.id);
        matches.push({
          cliente: bol.cliente,
          valor: round(bol.valor_titulo),
          vencimento: bol.data_vencimento,
          data_pagamento: bol.data_pagamento,
          bol_nosso: bol.nosso_numero,
          bol_id: bol.id,
          parcela_nf: p.seu_numero,
          parcela_nosso: p.nosso_numero,
          parcela_label: `${p.parcela_numero}/${p.parcela_total}`,
          parcela_id: p.id,
        });
      }
    }

    const valorTotal = round(matches.reduce((s, m) => s + m.valor, 0));

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_boletos_pagos: bolPagos.length,
        total_parcelas_aberto: parcelasAberto.length,
        duplicatas_encontradas: matches.length,
        valor_total: valorTotal,
        matches,
      });
    }

    // EXECUÇÃO REAL (apaga registros) — admin já validado no início
    let parcelasBaixadas = 0;
    let boletosRemovidos = 0;
    let erros = 0;
    for (const m of matches) {
      try {
        // 1. Baixa a parcela estruturada com os dados do boleto pago
        await svc.TituloCobranca.update(m.parcela_id, {
          status: 'pago',
          data_pagamento: m.data_pagamento,
          valor_pago: m.valor,
        });
        parcelasBaixadas++;
        await sleep(120);
        // 2. Remove o boleto avulso duplicado
        await svc.TituloCobranca.delete(m.bol_id);
        boletosRemovidos++;
        await sleep(120);
      } catch (e) {
        erros++;
        const isRate = e?.status === 429 || (e?.message || '').includes('Rate limit');
        if (isRate) await sleep(2000);
      }
    }

    return Response.json({
      dry_run: false,
      duplicatas_processadas: matches.length,
      parcelas_baixadas: parcelasBaixadas,
      boletos_removidos: boletosRemovidos,
      valor_total: valorTotal,
      erros,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});