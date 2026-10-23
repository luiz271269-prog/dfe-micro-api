export function registrosFluxoProjetado({ titulos, tributos, faturas, despesas, folhas, cartoes }) {
  const registros = [], mesRef = d => (d || '').slice(0, 7);
  for (const t of titulos) {
    if (t.status === 'pago' || !t.data_vencimento) continue;
    registros.push({ data_prevista: t.data_vencimento, tipo: 'entrada', categoria: 'recebimento_cobranca', descricao: `Cobrança ${t.nosso_numero || ''} · ${t.cliente}`, valor_previsto: t.valor_titulo || 0, status: 'previsto', origem_id: t.id, origem_tipo: 'titulo_cobranca', mes_referencia: mesRef(t.data_vencimento) });
  }
  for (const t of tributos) {
    if (t.status === 'pago' || !t.data_vencimento) continue;
    registros.push({ data_prevista: t.data_vencimento, tipo: 'saida', categoria: 'pagamento_tributo', descricao: `${t.tipo} ${t.competencia} · ${t.descricao || ''}`.trim(), valor_previsto: t.valor_original || 0, status: 'previsto', origem_id: t.id, origem_tipo: 'tributo', empresa: t.empresa, mes_referencia: mesRef(t.data_vencimento) });
  }
  for (const f of faturas) {
    if (f.status === 'paga_total' || !f.data_vencimento) continue;
    const nome = cartoes.find(c => c.id === f.conta_cartao_id)?.nome || 'Cartão';
    registros.push({ data_prevista: f.data_vencimento, tipo: 'saida', categoria: 'despesa_variavel', descricao: `Fatura ${nome} · ${f.mes_referencia}`, valor_previsto: Math.max(0, (f.valor_total || 0) - (f.valor_pago || 0)), status: 'previsto', origem_id: f.id, origem_tipo: 'fatura', mes_referencia: mesRef(f.data_vencimento) });
  }
  for (const d of despesas) {
    if (d.status === 'pago' || d.lancamento_cartao_id) continue;
    const dt = d.data_vencimento || d.data;
    if (!dt) continue;
    registros.push({ data_prevista: dt, tipo: 'saida', categoria: 'despesa_fixa', descricao: `${d.descricao} · ${d.fornecedor || ''}`.trim(), valor_previsto: Math.max(0, (d.valor || 0) - (d.valor_pago || 0)), status: 'previsto', origem_id: d.id, origem_tipo: 'despesa', empresa: d.empresa, mes_referencia: mesRef(dt) });
  }
  for (const f of folhas) {
    if (f.status !== 'pendente') continue;
    const dt = f.data_pagamento || `${f.competencia}-05`;
    registros.push({ data_prevista: dt, tipo: 'saida', categoria: 'folha_pagamento', descricao: `Folha ${f.competencia} · ${f.funcionario_nome}`, valor_previsto: f.salario_liquido || 0, status: 'previsto', origem_id: f.id, origem_tipo: 'folha', empresa: f.empresa, mes_referencia: f.competencia });
  }
  return registros.filter(r => r.valor_previsto > 0);
}