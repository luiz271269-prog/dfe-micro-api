export default function liquidacaoObra(obra) {
  if (obra.liquidacao_consulta) return obra.liquidacao_consulta;
  const total = Math.round(Number(obra.valor || 0) * 100) / 100;
  // Compatibilidade de leitura para consumidores que ainda não consultam os vínculos.
  const pago = Number(obra.valor_pago || 0) || (obra.status_pagamento === 'pago' || obra.lancamento_bancario_id ? total : 0);
  const saldo = Math.round(Math.max(0, total - pago) * 100) / 100;
  return { total, pago_considerado: pago, saldo, liquidacao: saldo === 0 ? 'Quitada' : pago > 0 ? 'Parcial' : 'Aberta', revisao: false };
}