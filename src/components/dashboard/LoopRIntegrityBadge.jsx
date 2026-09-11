import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function LoopRIntegrityBadge({ integrity }) {
  const healthy = integrity.count === 0 && integrity.reconciled >= 95;
  const Icon = healthy ? ShieldCheck : AlertTriangle;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Integridade Loop-R</p><p className="mt-1 text-lg font-bold">{integrity.reconciled.toFixed(1)}% conciliado</p></div>
        <Icon className={healthy ? 'text-success' : 'text-warning'} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><span className="text-muted-foreground">Classificado</span><p className="font-bold">{integrity.classified.toFixed(1)}%</p></div><div><span className="text-muted-foreground">Exceções</span><p className="font-bold">{integrity.count}</p></div><div><span className="text-muted-foreground">Valor</span><p className="font-bold">{formatCurrency(integrity.value, true)}</p></div></div>
    </div>
  );
}