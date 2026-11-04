import { lerCompleto, centavos } from './conciliacaoLeitura.ts';

// Projeção somente leitura: nunca substitui totais, pagamentos, vínculos ou histórico.
export async function liquidacoesDocumentos(db, entidade, ids) {
  if (!ids.length) return [];
  const docs = await lerCompleto(db, entidade, { id: { $in: ids } });
  if (!docs.length) return [];
  const page = await db.VinculoExtrato.aggregate({ query: { entidade_tipo: entidade, entidade_id: { $in: docs.map(d => d.id) } }, groupBy: ['entidade_id', 'tipo_vinculo'], sum: ['valor_alocado'], limit: 1000 });
  if (page.truncated) throw new Error('Vínculos excedem o limite seguro da consulta. Reduza a seleção.');
  const bancos = new Map();
  for (const v of page.rows) {
    if (v.tipo_vinculo && !['pagamento_integral', 'pagamento_parcial', 'estorno'].includes(v.tipo_vinculo)) continue;
    bancos.set(v.entidade_id, (bancos.get(v.entidade_id) || 0) + Math.abs(centavos(v.sum_valor_alocado)) * (v.tipo_vinculo === 'estorno' ? -1 : 1));
  }
  return docs.map(doc => {
    const total = centavos(entidade === 'ObraReforma' ? doc.valor : doc.valor_total);
    const registrado = Math.max(0, centavos(doc.valor_pago));
    const banco = Math.max(0, bancos.get(doc.id) || 0);
    // valor_pago é cache/declaração: nunca somá-lo novamente aos mesmos vínculos.
    const pago = Math.max(registrado, banco);
    const saldo = Math.max(0, total - pago);
    const historico = entidade === 'ObraReforma' ? doc.status_pagamento : doc.status;
    const historicoPago = ['pago', 'paga_total'].includes(historico);
    const divergente = total <= 0 || (historicoPago && saldo > 0) || pago > Math.max(0, total) || (bancos.has(doc.id) && banco !== registrado && registrado > 0);
    return { id: doc.id, total: total / 100, pago_registrado: registrado / 100, alocado_banco: banco / 100, pago_considerado: pago / 100, saldo: saldo / 100, liquidacao: total <= 0 ? 'Em revisão' : saldo === 0 ? 'Quitada' : pago > 0 ? 'Parcial' : 'Aberta', revisao: divergente, historico: historico || null, no_cartao: !!doc.lancamento_cartao_id, origem_compra: doc.origem_compra, tipo_compra: doc.tipo_compra };
  });
}