/**
 * Consolidação das obrigações JÁ PAGAS, normalizada no mesmo formato do contasPagarEngine,
 * mas indexada pela DATA DE EMISSÃO / REGISTRO do documento (não pelo vencimento).
 * Usada no modo "Pagos por emissão" da tela de Contas a Pagar. Somente leitura.
 */

// Não inferir tipos dos registros antigos: a classificação é manual.

function eixos(reg, origem_tipo) {
  return {
    origem_compra: reg?.origem_compra || 'empresa',
    tipo_compra: reg?.tipo_compra || '',
  };
}

export function consolidarContasPagas({ despesas = [], tributos = [], folhas = [], faturas = [], cartoes = [], compras = [], obras = [] }) {
  const itens = [];

  despesas.filter(d => d.status === 'pago' && !d.lancamento_cartao_id).forEach(d => {
    itens.push({
      id: `desp-${d.id}`, origem_id: d.id, origem_tipo: 'despesa',
      descricao: d.descricao, fornecedor: d.fornecedor || '—', categoria: d.categoria,
      valor: d.valor,
      data_emissao: d.data,
      data_pagamento: d.data,
      empresa: d.empresa, forma_pagamento: d.forma_pagamento,
      recorrente: !!d.recorrente,
      ...eixos(d, 'despesa'),
    });
  });

  tributos.filter(t => t.status === 'pago').forEach(t => {
    const [y, m] = (t.competencia || '').split('-');
    itens.push({
      id: `trib-${t.id}`, origem_id: t.id, origem_tipo: 'tributo',
      descricao: t.descricao || `${t.tipo} ${t.competencia}`, fornecedor: 'Receita / Governo', categoria: t.tipo,
      valor: t.valor_pago || t.valor_original,
      data_emissao: y && m ? `${y}-${m}-01` : t.data_vencimento,
      data_pagamento: t.data_pagamento,
      empresa: t.empresa, forma_pagamento: 'boleto',
      ...eixos(t, 'tributo'),
    });
  });

  folhas.filter(f => f.status === 'pago').forEach(f => {
    const [y, m] = (f.competencia || '').split('-');
    itens.push({
      id: `folha-${f.id}`, origem_id: f.id, origem_tipo: 'folha',
      descricao: `Salário — ${f.funcionario_nome}`, fornecedor: f.funcionario_nome, categoria: 'folha',
      valor: f.salario_liquido,
      data_emissao: y && m ? `${y}-${m}-01` : f.data_pagamento,
      data_pagamento: f.data_pagamento,
      empresa: f.empresa, forma_pagamento: 'transferencia',
      ...eixos(f, 'folha'),
    });
  });

  faturas.filter(f => f.status === 'paga_total').forEach(fat => {
    const cartao = cartoes.find(c => c.id === fat.conta_cartao_id);
    const [y, m] = (fat.mes_referencia || '').split('-');
    itens.push({
      id: `fat-${fat.id}`, origem_id: fat.id, origem_tipo: 'fatura',
      descricao: `Fatura ${cartao?.nome || 'Cartão'} — ${fat.mes_referencia}`,
      fornecedor: cartao?.nome || 'Cartão de Crédito', categoria: 'cartao',
      valor: fat.valor_pago || fat.valor_total,
      data_emissao: y && m ? `${y}-${m}-01` : fat.data_vencimento,
      data_pagamento: fat.data_pagamento,
      empresa: cartao?.empresa_vinculada || '—', forma_pagamento: 'debito_automatico',
      ...eixos(fat, 'fatura'),
    });
  });

  compras.filter(c => c.status_pagamento === 'pago' && !c.lancamento_cartao_id).forEach(c => {
    itens.push({
      id: `compra-${c.id}`, origem_id: c.id, origem_tipo: 'compra',
      descricao: c.descricao_produto || `Compra NF ${c.numero_nota || ''}`.trim(),
      fornecedor: c.fornecedor || '—', categoria: c.categoria_produto || 'compra',
      valor: c.valor_pago || c.valor_total,
      data_emissao: c.data_emissao,
      data_pagamento: null,
      empresa: c.empresa || '—', forma_pagamento: c.forma_pagamento,
      ...eixos(c, 'compra'),
    });
  });

  obras.filter(o => o.lancamento_bancario_id && !o.lancamento_cartao_id).forEach(o => {
    itens.push({
      id: `obra-${o.id}`, origem_id: o.id, origem_tipo: 'obra',
      descricao: o.descricao, fornecedor: o.responsavel || 'Prestador',
      categoria: o.tipo_profissional || o.tipo || 'obra',
      valor: o.valor || 0,
      data_emissao: o.data,
      data_pagamento: null,
      empresa: o.empresa || '—', forma_pagamento: o.forma_pagamento,
      ...eixos(o, 'obra'),
    });
  });

  return itens.filter(i => (i.valor || 0) > 0.01);
}