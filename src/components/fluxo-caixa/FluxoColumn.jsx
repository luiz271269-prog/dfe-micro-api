import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';

const styles = {
  entrada: { box: 'border-success/30', header: 'bg-success/10', title: 'text-success', value: 'text-success' },
  saida: { box: 'border-destructive/30', header: 'bg-destructive/10', title: 'text-destructive', value: 'text-destructive' },
};

const GETTERS = {
  data: (i) => i.data_prevista || '',
  descricao: (i) => (i.descricao || '').toLowerCase(),
  valor: (i) => i.valor_previsto || 0,
  status: (i) => i.status || '',
};

function Th({ col, label, align, sort, onSort }) {
  const ativo = sort.col === col;
  return (
    <th className={`px-3 py-2 text-${align}`}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-0.5 hover:text-foreground ${ativo ? 'text-foreground font-bold' : ''}`}
      >
        {label}
        {ativo && (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </th>
  );
}

export default function FluxoColumn({ title, tipo, items, origemLabels, onMarkRealizado }) {
  const style = styles[tipo];
  const total = items.reduce((sum, item) => sum + (item.valor_previsto || 0), 0);
  // Padrão: sempre em ordem de vencimento (data ascendente)
  const [sort, setSort] = useState({ col: 'data', dir: 'asc' });

  const onSort = (col) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));

  const ordenados = useMemo(() => {
    const get = GETTERS[sort.col] || GETTERS.data;
    const mult = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }, [items, sort]);

  return (
    <section className={`min-w-0 overflow-hidden rounded-xl border bg-card ${style.box}`}>
      <header className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${style.header}`}>
        <h2 className={`font-semibold ${style.title}`}>{title}</h2>
        <strong className={style.value}>{formatCurrency(total)}</strong>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr>
              <Th col="data" label="Data" align="left" sort={sort} onSort={onSort} />
              <Th col="descricao" label="Descrição" align="left" sort={sort} onSort={onSort} />
              <Th col="valor" label="Valor" align="right" sort={sort} onSort={onSort} />
              <Th col="status" label="Status" align="left" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {ordenados.length === 0 ? <tr><td colSpan="4" className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação encontrada</td></tr> : ordenados.map(item => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-3 py-3 font-semibold">{formatDate(item.data_prevista)}</td>
                <td className="px-3 py-3"><p>{item.descricao}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.categoria}</p></td>
                <td className={`whitespace-nowrap px-3 py-3 text-right font-bold ${style.value}`}>{tipo === 'entrada' ? '+' : '-'}{formatCurrency(item.valor_previsto)}</td>
                <td className="px-3 py-3"><div className="flex flex-wrap items-center gap-1"><StatusBadge status={item.status} />{item._auto ? <span className="rounded-full bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold text-info">{origemLabels[item.origem_tipo] || 'Auto'}</span> : item.status === 'previsto' && <button onClick={() => onMarkRealizado(item.id, item.valor_previsto)} className="text-xs text-primary hover:underline">Realizar</button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}