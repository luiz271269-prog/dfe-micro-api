import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

/**
 * Diagnóstico da conciliação 360° — responde:
 *  - Quantos registros "pagos" existem em cada entidade?
 *  - Quantos têm vínculo com extrato?
 *  - Quantos NÃO têm vínculo + razões prováveis (sem data_pagamento, valor não bate, etc.)
 *  - Lista os 10 maiores débitos do extrato sem vínculo
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;

    const lancamentos = await svc.LancamentoBancario.list('-data', 5000);
    await sleep(200);
    const vinculos = await svc.VinculoExtrato.list('-created_date', 20000);
    await sleep(200);
    const tributos = await svc.Tributo.filter({ status: 'pago' });
    await sleep(150);
    const folhas = await svc.FolhaPagamento.filter({ status: 'pago' });
    await sleep(150);
    const despesas = await svc.DespesaOperacional.filter({ status: 'pago' });
    await sleep(150);
    const obras = await svc.ObraReforma.list('-data', 2000);
    await sleep(150);
    const faturas = await svc.FaturaCartao.filter({ status: 'paga_total' });
    await sleep(150);
    const itens = await svc.ItemCompra.list('-data_emissao', 5000);

    // Index de vínculos por entidade
    const vinculosPorEnt = new Map();
    for (const v of vinculos) {
      const k = `${v.entidade_tipo}|${v.entidade_id}`;
      vinculosPorEnt.set(k, (vinculosPorEnt.get(k) || 0) + 1);
    }

    function analisar(arr, tipo, getValor, getData, valorAbsList) {
      let comVinculo = 0, semVinculo = 0, semData = 0, semValor = 0, valorNaoBate = 0;
      const exemplosSem = [];
      for (const r of arr) {
        const tem = vinculosPorEnt.has(`${tipo}|${r.id}`);
        if (tem) { comVinculo++; continue; }
        semVinculo++;
        const v = getValor(r);
        const d = getData(r);
        if (!d) { semData++; if (exemplosSem.length < 3) exemplosSem.push({ id: r.id, motivo: 'sem_data', valor: v, raw: { data: r.data, data_pagamento: r.data_pagamento, data_vencimento: r.data_vencimento } }); continue; }
        if (!v) { semValor++; continue; }
        const bate = valorAbsList.has(Math.round(v * 100));
        if (!bate) { valorNaoBate++; if (exemplosSem.length < 3) exemplosSem.push({ id: r.id, motivo: 'valor_nao_no_extrato', valor: v, data: d }); }
      }
      return { total: arr.length, comVinculo, semVinculo, semData, semValor, valorNaoBate, exemplosSem };
    }

    // Set de valores absolutos do extrato (para checagem rápida)
    const valoresExtrato = new Set(lancamentos.filter(l => l.valor < 0).map(l => Math.round(Math.abs(l.valor) * 100)));

    const resumo = {
      lancamentos_extrato: {
        total: lancamentos.length,
        debitos: lancamentos.filter(l => l.valor < 0).length,
        creditos: lancamentos.filter(l => l.valor > 0).length,
        com_vinculo: lancamentos.filter(l => (l.vinculos_count || 0) > 0).length,
        sem_vinculo: lancamentos.filter(l => (l.vinculos_count || 0) === 0).length,
      },
      tributos:    analisar(tributos,    'Tributo',    t => t.valor_pago || t.valor_original, t => t.data_pagamento || t.data_vencimento, valoresExtrato),
      folhas:      analisar(folhas,      'FolhaPagamento', f => f.salario_liquido, f => f.data_pagamento || f.competencia, valoresExtrato),
      despesas:    analisar(despesas,    'DespesaOperacional', d => d.valor, d => d.data || d.data_vencimento, valoresExtrato),
      obras:       analisar(obras,       'ObraReforma', o => o.valor, o => o.data, valoresExtrato),
      faturas:     analisar(faturas,     'FaturaCartao', f => f.valor_pago || f.valor_total, f => f.data_pagamento || f.data_vencimento, valoresExtrato),
      itens_compra: analisar(itens,     'ItemCompra', i => i.valor_pago || i.valor_total, i => i.data_emissao, valoresExtrato),
    };

    // Top 10 maiores débitos sem vínculo
    const topDebitosSem = lancamentos
      .filter(l => l.valor < 0 && (l.vinculos_count || 0) === 0)
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 15)
      .map(l => ({
        id: l.id,
        data: l.data,
        valor: l.valor,
        descricao: l.descricao,
        categoria: l.categoria,
      }));

    return Response.json({
      success: true,
      resumo,
      top_debitos_sem_vinculo: topDebitosSem,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});