import { useState, useMemo } from 'react';

// Ordenação padrão de tabelas do app: clique no cabeçalho alterna asc/desc.
// Campos numéricos/data começam em desc; texto em asc.
const NUM_HINTS = ['valor', 'saldo', 'total', 'quantidade', 'orcamento', 'salario', 'liquido', 'bruto', 'pago', 'comissao', 'parcela'];

function isNumericField(field, sample) {
  if (typeof sample === 'number') return true;
  return NUM_HINTS.some(h => field.toLowerCase().includes(h));
}

export default function useTableSort(items = [], initialField = null, initialDir = 'desc') {
  const [sortField, setSortField] = useState(initialField);
  const [sortDir, setSortDir] = useState(initialDir);

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      const sample = items.find(i => i?.[field] != null)?.[field];
      const startsDesc = isNumericField(field, sample) || field.includes('data') || field.includes('competencia') || field.includes('vencimento');
      setSortDir(startsDesc ? 'desc' : 'asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortField) return items;
    const sample = items.find(i => i?.[sortField] != null)?.[sortField];
    const numeric = isNumericField(sortField, sample);
    const arr = [...items];
    arr.sort((a, b) => {
      const av = a?.[sortField], bv = b?.[sortField];
      const cmp = numeric
        ? (Number(av) || 0) - (Number(bv) || 0)
        : String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [items, sortField, sortDir]);

  return { sorted, sortField, sortDir, handleSort };
}