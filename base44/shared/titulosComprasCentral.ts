import { parcelasCentral } from './parcelasCentral.ts';

export function titulosComprasCentral(pedidos, itens) {
  const porPedido = new Map();
  for (const item of itens) {
    const chave = item.pedido_central_internal_id;
    if (!porPedido.has(chave)) porPedido.set(chave, []);
    porPedido.get(chave).push(item);
  }
  return pedidos.flatMap(pedido => {
    const linhas = porPedido.get(pedido.id) || [];
    const base = linhas[0];
    if (!base || base.status_pagamento === 'pago' || /cancelad/i.test(pedido.status || '')) return [];
    const total = linhas.reduce((s, i) => s + i.valor_total, 0);
    const pago = linhas.reduce((s, i) => s + i.valor_pago, 0);
    const original = linhas.reduce((s, i) => s + i.valor_original, 0);
    return parcelasCentral({ ...pedido, data_vencimento: base.data_vencimento }, total, pago, original).map(parcela => ({
      id: `${pedido.id}-parcela-${parcela.numero}`, numero: pedido.numero_pedido, tipo: 'Pedido',
      parcela: `${parcela.numero}/${parcela.quantidade}`, fornecedor: base.fornecedor,
      data_emissao: base.data_emissao, data_criacao_ordem: base.data_criacao_ordem, data_vencimento: parcela.data_vencimento,
      data_pagamento_informada: base.data_pagamento_informada,
      forma_pagamento: base.forma_pagamento, condicao_pagamento: base.condicao_pagamento,
      cartao_final: base.cartao_final, pagamento_antecipado: pedido.pagamento_antecipado === true,
      valor_pago_informado: Math.round((Number(pedido.valor_pago) || 0) * base.taxa_cambio * 100) / 100,
      status_pagamento: base.status_pagamento, moeda_original: base.moeda_original, taxa_cambio: base.taxa_cambio,
      valor_compra: parcela.valor_compra, valor: parcela.valor, valor_original: parcela.valor_original,
      vencimento_previsto: parcela.vencimento_previsto, valor_previsto: parcela.valor_previsto, itens: linhas,
    }));
  });
}

export function resumoComprasCentral(documentos) {
  const resumo = { total: 0, quantidade: documentos.length, valor_compra: 0, canais: {}, outros: 0 };
  for (const doc of documentos) {
    const canal = resumo.canais[doc.forma_pagamento] ||= { valor: 0, quantidade: 0 };
    canal.valor += Math.round(doc.valor * 100); canal.quantidade++;
    resumo.total += Math.round(doc.valor * 100); resumo.valor_compra += Math.round(doc.valor_compra * 100);
    if (!['banco_pix', 'cartao', 'banco_boleto'].includes(doc.forma_pagamento)) resumo.outros += Math.round(doc.valor * 100);
  }
  for (const canal of Object.values(resumo.canais)) canal.valor /= 100;
  resumo.total /= 100; resumo.valor_compra /= 100; resumo.outros /= 100;
  return resumo;
}