/**
 * Motor de Contas a Pagar Unificado
 * Consolida 4 origens em uma única lista normalizada:
 *  - DespesaOperacional (status: pendente)
 *  - Tributo (status: a_vencer / vencido)
 *  - FolhaPagamento (status: pendente)
 *  - FaturaCartao (status: aberta / vencida)
 *
 * Também faz o pareamento com débitos do extrato para baixa automática.
 */

export function consolidarContasPagar({ despesas = [], tributos = [], folhas = [], faturas = [], cartoes = [] }) {
  const itens = [];

  despesas.filter(d => d.status === 'pendente').forEach(d => {
    itens.push({
      id: `desp-${d.id}`,
      origem_id: d.id,
      origem_tipo: 'despesa',
      descricao: d.descricao,
      fornecedor: d.fornecedor || '—',
      categoria: d.categoria,
      valor: d.valor,
      data_vencimento: d.data_vencimento || d.data,
      empresa: d.empresa,
      forma_pagamento: d.forma_pagamento,
    });
  });

  tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido').forEach(t => {
    itens.push({
      id: `trib-${t.id}`,
      origem_id: t.id,
      origem_tipo: 'tributo',
      descricao: t.descricao || `${t.tipo} ${t.competencia}`,
      fornecedor: 'Receita / Governo',
      categoria: t.tipo,
      valor: (t.valor_original || 0) - (t.valor_pago || 0),
      data_vencimento: t.data_vencimento,
      empresa: t.empresa,
      forma_pagamento: 'boleto',
    });
  });

  folhas.filter(f => f.status === 'pendente').forEach(f => {
    // Folha vence dia 5 do mês seguinte à competência
    const [y, m] = (f.competencia || '').split('-').map(Number);
    const venc = y && m ? new Date(y, m, 5).toISOString().slice(0, 10) : null;
    itens.push({
      id: `folha-${f.id}`,
      origem_id: f.id,
      origem_tipo: 'folha',
      descricao: `Salário — ${f.funcionario_nome}`,
      fornecedor: f.funcionario_nome,
      categoria: 'folha',
      valor: f.salario_liquido,
      data_vencimento: venc,
      empresa: f.empresa,
      forma_pagamento: 'transferencia',
    });
  });

  faturas.filter(fat => fat.status === 'aberta' || fat.status === 'vencida').forEach(fat => {
    const cartao = cartoes.find(c => c.id === fat.conta_cartao_id);
    itens.push({
      id: `fat-${fat.id}`,
      origem_id: fat.id,
      origem_tipo: 'fatura',
      descricao: `Fatura ${cartao?.nome || 'Cartão'} — ${fat.mes_referencia}`,
      fornecedor: cartao?.nome || 'Cartão de Crédito',
      categoria: 'cartao',
      valor: fat.valor_total - (fat.valor_pago || 0),
      data_vencimento: fat.data_vencimento,
      empresa: cartao?.empresa_vinculada || '—',
      forma_pagamento: 'debito_automatico',
    });
  });

  return itens;
}

/**
 * Agrupa por faixa de vencimento (aging).
 * Retorna: { vencidos, hoje, semana, ate15, ate30, acima30 }
 */
export function calcularAging(itens, hoje = new Date()) {
  const hojeStr = hoje.toISOString().slice(0, 10);
  const addDias = n => new Date(hoje.getTime() + n * 86400000).toISOString().slice(0, 10);
  const d7 = addDias(7);
  const d15 = addDias(15);
  const d30 = addDias(30);

  const buckets = { vencidos: [], hoje: [], semana: [], ate15: [], ate30: [], acima30: [], semData: [] };
  itens.forEach(i => {
    const v = i.data_vencimento;
    if (!v) buckets.semData.push(i);
    else if (v < hojeStr) buckets.vencidos.push(i);
    else if (v === hojeStr) buckets.hoje.push(i);
    else if (v <= d7) buckets.semana.push(i);
    else if (v <= d15) buckets.ate15.push(i);
    else if (v <= d30) buckets.ate30.push(i);
    else buckets.acima30.push(i);
  });
  return buckets;
}

/**
 * Dado um débito do extrato bancário, procura o item de conta a pagar compatível.
 * Match por valor (±0.50) + data_vencimento próxima (±7 dias).
 */
export function acharContaPagarPorLancamento(lanc, contasPagar, toleranciaDias = 7, toleranciaValor = 0.5) {
  const valor = Math.abs(lanc.valor);
  const dataLanc = new Date(lanc.data);

  return contasPagar.find(c => {
    if (Math.abs(c.valor - valor) > toleranciaValor) return false;
    if (!c.data_vencimento) return false;
    const diff = Math.abs((new Date(c.data_vencimento) - dataLanc) / 86400000);
    return diff <= toleranciaDias;
  });
}