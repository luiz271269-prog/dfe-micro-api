import StatusBadge from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';

const styles = {
  entrada: { box: 'border-success/30', header: 'bg-success/10', title: 'text-success', value: 'text-success' },
  saida: { box: 'border-destructive/30', header: 'bg-destructive/10', title: 'text-destructive', value: 'text-destructive' },
};

export default function FluxoColumn({ title, tipo, items, origemLabels, onMarkRealizado }) {
  const style = styles[tipo];
  const total = items.reduce((sum, item) => sum + (item.valor_previsto || 0), 0);

  return (
    <section className={`min-w-0 overflow-hidden rounded-xl border bg-card ${style.box}`}>
      <header className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${style.header}`}>
        <h2 className={`font-semibold ${style.title}`}>{title}</h2>
        <strong className={style.value}>{formatCurrency(total)}</strong>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-left">Status</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan="4" className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação encontrada</td></tr> : items.map(item => (
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