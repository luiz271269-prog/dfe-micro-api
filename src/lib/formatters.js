export function formatCurrency(value, compact = false) {
  if (value == null || isNaN(value)) return compact ? 'R$0' : 'R$ 0,00';
  if (compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1000000) return `${sign}R$${(abs/1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}R$${Math.round(abs/1000)}k`;
    return `${sign}R$${abs.toFixed(0)}`;
  }
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
  pessoal: 'Folha Pgto',
  pro_labore: 'Pró-labore',
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
  pro_labore: 'purple',
  tributo: 'orange',
  despesa_operacional: 'yellow',
  financeiro: 'blue',
  saque: 'slate',
  obras_reforma: 'emerald',
  transferencia: 'blue',
  interno: 'slate',
};