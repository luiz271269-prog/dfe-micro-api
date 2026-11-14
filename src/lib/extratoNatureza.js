import { classificarNaturezaBancaria } from './naturezaCreditoExtrato';

// Natureza contábil do lançamento: aplicações, resgates e transferências
// ficam em conferência e nunca entram como saída de contas a pagar.
export function classificarNaturezaExtrato(lancamento) {
  if (['transferencia', 'interno', 'aporte', 'emprestimo'].includes(lancamento?.categoria)) return 'conferencia';
  const { natureza } = classificarNaturezaBancaria(lancamento);
  if (natureza === 'transferencia') return 'conferencia';
  if (natureza === 'aplicacao' || natureza === 'resgate') return 'aplicacao';
  if (natureza === 'despesa') return 'saida';
  if (natureza === 'receita' || natureza === 'credito_revisar') return 'entrada';
  return 'outro';
}

export function ehSaidaContasPagar(lancamento) {
  return classificarNaturezaExtrato(lancamento) === 'saida';
}