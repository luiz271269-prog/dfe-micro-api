const valorAberto = (c) => Math.max(0, (c.valor_total || 0) - (c.valor_pago || 0));

export function consolidarTitulosCompras(compras = [], pago = false) {
  const elegiveis = compras.filter((c) => c.numero_nota && c.data_vencimento && !c.lancamento_cartao_id)
    .filter((c) => pago ? c.status_pagamento === 'pago' : ['pendente', 'parcial', 'nao_identificado'].includes(c.status_pagamento));
  const notas = new Map();
  elegiveis.forEach((c) => {
    const chave = `${c.fornecedor || ''}|${c.numero_nota}`;
    if (!notas.has(chave)) notas.set(chave, new Map());
    const parcelas = notas.get(chave);
    const data = c.data_vencimento;
    if (!parcelas.has(data)) parcelas.set(data, []);
    parcelas.get(data).push(c);
  });
  return [...notas.values()].flatMap((parcelas) => {
    const datas = [...parcelas.keys()].sort();
    return datas.map((data, indice) => {
      const registros = parcelas.get(data);
      const base = registros[0];
      const valor = registros.reduce((s, c) => s + (pago ? (c.valor_pago || c.valor_total || 0) : valorAberto(c)), 0);
      return {
        id: `compra-nf-${base.numero_nota}-${data}`, origem_id: base.id, origem_ids: registros.map((c) => c.id), origem_tipo: 'compra',
        descricao: `NF ${base.numero_nota} · Parcela ${indice + 1}/${datas.length}`, fornecedor: base.fornecedor || '—',
        numero_nota: base.numero_nota, pedido_central_id: base.pedido_central_id, pedido_central_internal_id: base.pedido_central_internal_id,
        categoria: 'estoque', valor, valor_pago: pago ? valor : registros.reduce((s, c) => s + (c.valor_pago || 0), 0),
        data_vencimento: data, data_emissao: base.data_emissao, empresa: base.empresa || '—', forma_pagamento: base.forma_pagamento,
        origem_compra: base.origem_compra || 'empresa', tipo_compra: base.tipo_compra || '', is_grouped: registros.length > 1,
      };
    });
  }).filter((titulo) => titulo.valor > 0.01);
}