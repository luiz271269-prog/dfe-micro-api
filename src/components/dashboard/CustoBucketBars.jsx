import { formatCurrency } from '@/lib/formatters';

const labels = { avista: 'À vista', cartao: 'Cartão', boleto: 'Boleto', nao_identificado: 'Não identificado', banco: 'Contas bancárias' };
const colors = { avista: 'bg-chart-1', cartao: 'bg-chart-3', boleto: 'bg-chart-4', nao_identificado: 'bg-muted-foreground', banco: 'bg-chart-1' };

export default function CustoBucketBars({ buckets }) {
  const entries = Object.entries(buckets || {});
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {entries.map(([key, value]) => value > 0 && <div key={key} className={colors[key]} style={{ width: `${total ? value / total * 100 : 0}%` }} />)}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {entries.map(([key, value]) => <div key={key} className="flex justify-between gap-2"><span className="text-muted-foreground">{labels[key] || key}</span><span className="font-semibold tabular-nums">{formatCurrency(value, true)}</span></div>)}
      </div>
    </div>
  );
}