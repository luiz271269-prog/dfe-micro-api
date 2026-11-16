import { useMemo } from 'react';
import { GRUPOS, ORDEM_GRUPOS, grupoDeItem } from '@/lib/gruposContasPagar';
import { formatCurrency } from '@/lib/formatters';

export default function ResumoPorGrupo({ itens, eventuais, value, onChange }) {
  const linhas = useMemo(() => {
    const soma = {};
    itens.forEach(i => {
      const g = grupoDeItem(i, eventuais);
      soma[g] = soma[g] || { total: 0, qtd: 0 };
      soma[g].total += i.valor || 0;
      soma[g].qtd += 1;
    });
    return ORDEM_GRUPOS.filter(g => soma[g]).map(g => ({ id: g, ...GRUPOS[g], ...soma[g] }));
  }, [itens, eventuais]);

  if (!linhas.length) return null;
  return (
    <section aria-label="Subtotais por grupo de origem" className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Por grupo de origem · nesta consulta</h2>
        {value !== 'todos' && <button type="button" onClick={() => onChange('todos')} className="text-xs font-semibold text-primary hover:underline">Ver todos os grupos</button>}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {linhas.map(l => (
          <button key={l.id} type="button" aria-pressed={value === l.id} onClick={() => onChange(value === l.id ? 'todos' : l.id)}
            className={`rounded-xl border border-l-4 bg-card px-3 py-2 text-left transition-all hover:shadow ${l.barra} ${value === l.id ? 'ring-2 ring-primary' : value !== 'todos' ? 'opacity-50' : ''}`}>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${l.dot}`} />
              <span className="truncate">{l.rotulo}</span>
            </span>
            <span className="mt-0.5 block text-base font-bold tabular-nums">{formatCurrency(l.total)}</span>
            <span className="text-[10px] text-muted-foreground">{l.qtd} item(ns)</span>
          </button>
        ))}
      </div>
    </section>
  );
}