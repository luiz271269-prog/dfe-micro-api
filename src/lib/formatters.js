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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;

export function formatDate(value) {
  if (!value) return '—';
  if (typeof value === 'string') {
    if (ISO_DATE.test(value.slice(0, 10))) {
      const [year, month, day] = value.slice(0, 10).split('-');
      return `${day}/${month}/${year}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function formatDateValue(value) {
  if (typeof value !== 'string') return value;
  if (ISO_DATE.test(value)) return formatDate(value);
  if (ISO_DATE_TIME.test(value)) return formatDateTime(value);
  return value;
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