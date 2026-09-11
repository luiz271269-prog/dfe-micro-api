import { Hammer, WalletCards } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import CustoBucketBars from './CustoBucketBars';

function Card({ title, total, percent, icon: Icon, onClick, children }) {
  return <button onClick={onClick} className="rounded-xl border bg-card p-4 text-left shadow-sm hover:bg-muted/30"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase text-muted-foreground">{title}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xl font-bold">{formatCurrency(total)}</p><p className="mb-3 text-xs text-muted-foreground">{percent.toFixed(1)}% do faturamento</p>{children}</button>;
}

export default function OutrasSaidasSection({ data, onDrill }) {
  const desvio = data.obras.total - data.obras.orcado;
  return (
    <section className="space-y-3"><div><h2 className="font-bold">Outras Saídas</h2><p className="text-xs text-muted-foreground">Valores fora do custo operacional principal</p></div><div className="grid gap-3 md:grid-cols-2">
      <Card title="Obras e reformas" total={data.obras.total} percent={data.obras.percent} icon={Hammer} onClick={() => onDrill('obrasConsolidadas')}><p className="mb-2 text-xs text-muted-foreground">Orçado {formatCurrency(data.obras.orcado, true)} · desvio {formatCurrency(desvio, true)}</p><CustoBucketBars buckets={data.obras.buckets} /></Card>
      <Card title="Pró-labore" total={data.proLabore.total} percent={data.proLabore.percent} icon={WalletCards} onClick={() => onDrill('proLaboreConsolidado')}><CustoBucketBars buckets={data.proLabore.buckets} /></Card>
    </div></section>
  );
}