// Documento explica a composição; somente a fatura representa a obrigação.
export function situacaoFatura(fatura, hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })) {
  const centavos = valor => Math.round(Number(valor || 0) * 100);
  const total = centavos(fatura.valor_total), pago = centavos(fatura.valor_pago);
  const saldo = Math.max(0, total - pago);
  const liquidacao = saldo === 0 ? 'Quitada' : pago > 0 ? 'Parcial' : 'Aberta';
  const vencimento = fatura.data_vencimento;
  const temporal = saldo === 0 ? 'Encerrada' : !vencimento ? 'Sem vencimento' : vencimento < hoje ? 'Vencida' : vencimento === hoje ? 'Vence hoje' : 'A vencer';
  return { valor_total: total / 100, valor_pago: pago / 100, saldo: saldo / 100, liquidacao, temporal, inconsistencia_historica: (fatura.status === 'paga_total') !== (saldo === 0 && total > 0) };
}
export function normalizarFaturaCarteira(fatura, cartoes = []) {
  const cartao = cartoes.find(c => c.id === fatura.conta_cartao_id);
  const situacao = situacaoFatura(fatura);
  return {
    id: `fat-${fatura.id}`, origem_id: fatura.id, origem_tipo: 'fatura',
    descricao: `Fatura ${cartao?.nome || 'Cartão'} — ${fatura.mes_referencia}`,
    fornecedor: cartao?.nome || 'Cartão de Crédito', categoria: 'cartao',
    ...situacao, valor: situacao.saldo, data_vencimento: fatura.data_vencimento,
    data_emissao: /^\d{4}-\d{2}$/.test(fatura.mes_referencia || '') ? `${fatura.mes_referencia}-01` : fatura.data_vencimento,
    data_pagamento: fatura.data_pagamento, empresa: cartao?.empresa_vinculada || '—',
    forma_pagamento: 'debito_automatico', origem_compra: fatura.origem_compra || 'empresa', tipo_compra: fatura.tipo_compra || '',
    composicao_ref: { fatura_id: fatura.id, somente_explicativa: true },
  };
}