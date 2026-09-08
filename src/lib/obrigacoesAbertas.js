import { base44 } from '@/api/base44Client';

// Carrega todas as obrigações em aberto (não vinculadas ao extrato) num formato único
// { entidade_tipo, entidade_id, descricao, fornecedor, valor, data_vencimento, tipo_label }
export async function carregarObrigacoesAbertas() {
  const [despesas, tributos, faturas, cartoes, folhas, vinculos] = await Promise.all([
    base44.entities.DespesaOperacional.list('-data_vencimento', 800),
    base44.entities.Tributo.list('-data_vencimento', 500),
    base44.entities.FaturaCartao.list('-data_vencimento', 300),
    base44.entities.ContaCartao.list(),
    base44.entities.FolhaPagamento.list('-competencia', 500),
    base44.entities.VinculoExtrato.list('-created_date', 5000),
  ]);

  const vinc = new Set(vinculos.map(v => `${v.entidade_tipo}-${v.entidade_id}`));
  const lista = [];

  despesas.filter(d => d.status !== 'pago').forEach(d => {
    if (vinc.has(`DespesaOperacional-${d.id}`)) return;
    lista.push({
      entidade_tipo: 'DespesaOperacional', entidade_id: d.id, tipo_label: 'despesa',
      descricao: d.descricao, fornecedor: d.fornecedor || '—',
      valor: d.valor || 0, data_vencimento: d.data_vencimento || d.data,
    });
  });

  tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido').forEach(t => {
    if (vinc.has(`Tributo-${t.id}`)) return;
    lista.push({
      entidade_tipo: 'Tributo', entidade_id: t.id, tipo_label: 'tributo',
      descricao: t.descricao || `${t.tipo} ${t.competencia}`, fornecedor: 'Receita / Governo',
      valor: (t.valor_original || 0) - (t.valor_pago || 0), data_vencimento: t.data_vencimento,
    });
  });

  faturas.filter(f => f.status === 'aberta' || f.status === 'vencida').forEach(f => {
    if (vinc.has(`FaturaCartao-${f.id}`)) return;
    const c = cartoes.find(x => x.id === f.conta_cartao_id);
    lista.push({
      entidade_tipo: 'FaturaCartao', entidade_id: f.id, tipo_label: 'fatura',
      descricao: `Fatura ${c?.nome || 'Cartão'} — ${f.mes_referencia}`, fornecedor: c?.nome || 'Cartão',
      valor: (f.valor_total || 0) - (f.valor_pago || 0), data_vencimento: f.data_vencimento,
    });
  });

  folhas.filter(f => f.status !== 'pago').forEach(f => {
    if (vinc.has(`FolhaPagamento-${f.id}`)) return;
    lista.push({
      entidade_tipo: 'FolhaPagamento', entidade_id: f.id, tipo_label: 'folha',
      descricao: `Folha ${f.competencia} — ${f.funcionario_nome}`, fornecedor: f.funcionario_nome,
      valor: f.salario_liquido || 0, data_vencimento: f.data_pagamento || null,
    });
  });

  return lista;
}

// Marca a obrigação como paga e cria o vínculo com o lançamento do extrato
export async function conciliarObrigacaoComLancamento(obrigacao, lancamento, observacao) {
  const valor = Math.abs(lancamento.valor || 0);
  const data = lancamento.data;

  if (obrigacao.entidade_tipo === 'DespesaOperacional') {
    await base44.entities.DespesaOperacional.update(obrigacao.entidade_id, { status: 'pago', data });
  } else if (obrigacao.entidade_tipo === 'Tributo') {
    await base44.entities.Tributo.update(obrigacao.entidade_id, { status: 'pago', data_pagamento: data, valor_pago: valor });
  } else if (obrigacao.entidade_tipo === 'FaturaCartao') {
    await base44.entities.FaturaCartao.update(obrigacao.entidade_id, { status: 'paga_total', data_pagamento: data, valor_pago: valor });
  } else if (obrigacao.entidade_tipo === 'FolhaPagamento') {
    await base44.entities.FolhaPagamento.update(obrigacao.entidade_id, { status: 'pago', data_pagamento: data, valor_pago: valor });
  }

  await base44.entities.VinculoExtrato.create({
    lancamento_bancario_id: lancamento.id,
    entidade_tipo: obrigacao.entidade_tipo,
    entidade_id: obrigacao.entidade_id,
    valor_alocado: valor,
    tipo_vinculo: 'pagamento_integral',
    conciliado_por: 'manual',
    confianca: 100,
    observacao: observacao || `Conciliação manual · ${obrigacao.descricao}`,
  });

  await base44.entities.LancamentoBancario.update(lancamento.id, { status_conciliacao: 'conciliado' });
}