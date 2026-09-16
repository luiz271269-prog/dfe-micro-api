const ABERTOS = ['pendente', 'parcial', 'nao_identificado'];

export function consolidarDocumentosCompras(compras = []) {
  const grupos = new Map();
  compras.filter((c) => ABERTOS.includes(c.status_pagamento) && !c.lancamento_cartao_id).forEach((c) => {
    const documento = c.numero_nota || c.pedido_central_id || c.pedido;
    if (!documento) return;
    const chave = `${c.fornecedor || ''}|${documento}`;
    if (!grupos.has(chave)) grupos.set(chave, new Map());
    const vencimento = c.data_vencimento || '';
    const parcelas = grupos.get(chave);
    if (!parcelas.has(vencimento)) parcelas.set(vencimento, []);
    parcelas.get(vencimento).push(c);
  });
  return [...grupos.values()].flatMap((parcelas) => {
    const datas = [...parcelas.keys()].sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b)));
    return datas.map((data, indice) => {
      const itens = parcelas.get(data);
      const base = itens[0];
      const valorTotal = itens.reduce((s, item) => s + (item.valor_total || 0), 0);
      const valorPago = itens.reduce((s, item) => s + (item.valor_pago || 0), 0);
      const numero = base.numero_nota || base.pedido_central_id || base.pedido;
      return {
        id: `${base.fornecedor || 'sem-fornecedor'}-${numero}-${data || 'sem-data'}`, numero, tipo: base.numero_nota ? 'NF' : 'Pedido',
        parcela: `${indice + 1}/${datas.length}`, fornecedor: base.fornecedor || '—', data_vencimento: data,
        data_emissao: base.data_emissao, forma_pagamento: base.forma_pagamento,
        status_pagamento: valorPago > 0 ? 'parcial' : base.status_pagamento,
        valor: Math.max(0, valorTotal - valorPago), itens,
      };
    });
  }).filter((documento) => documento.valor > 0.01);
}