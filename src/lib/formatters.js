export function formatCurrency(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

export const categoriaLabels = {
  recebimento: 'Recebimento',
  fornecedor: 'Fornecedor',
  pessoal: 'Pessoal',
  tributo: 'Tributo',
  despesa_operacional: 'Despesa Operacional',
  financeiro: 'Financeiro',
  saque: 'Saque',
  obras_reforma: 'Obras/Reforma',
  transferencia: 'Transferência',
  interno: 'Interno',
};

export const categoriaColors = {
  recebimento: 'green',
  fornecedor: 'red',
  pessoal: 'purple',
  tributo: 'orange',
  despesa_operacional: 'yellow',
  financeiro: 'blue',
  saque: 'slate',
  obras_reforma: 'emerald',
  transferencia: 'blue',
  interno: 'slate',
};