import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const TONS = {
  blue: { card: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900', icon: 'bg-blue-100 text-blue-600' },
  green: { card: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900', icon: 'bg-emerald-100 text-emerald-600' },
  orange: { card: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900', icon: 'bg-orange-100 text-orange-600' },
  purple: { card: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900', icon: 'bg-purple-100 text-purple-600' },
  amber: { card: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900', icon: 'bg-amber-100 text-amber-600' },
  red: { card: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900', icon: 'bg-rose-100 text-rose-600' },
  sky: { card: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-900', icon: 'bg-sky-100 text-sky-600' },
  violet: { card: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900', icon: 'bg-violet-100 text-violet-600' },
};

export default function KpiCard({ titulo, valor, texto, sub, icon: Icon, tom = 'blue', variacao, negativoRuim = true, href, onClick }) {
  const t = TONS[tom] || TONS.blue;
  const num = typeof valor === 'number' ? valor : null;
  const corValor = num != null && num < 0 && negativoRuim ? 'text-rose-600' : 'text-foreground';
  const bom = variacao != null && (negativoRuim ? variacao >= 0 : variacao <= 0);
  const inner = (
    <div className={`rounded-2xl border p-4 flex gap-3 h-full transition-shadow hover:shadow-md ${t.card} ${href || onClick ? 'cursor-pointer' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}>{Icon && <Icon className="w-5 h-5" />}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground truncate">{titulo}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xl font-bold tracking-tight tabular-nums ${corValor}`}>{texto ?? (num != null ? formatCurrency(num) : '—')}</p>
          {variacao != null && (
            <span className={`text-xs font-semibold flex items-center ${bom ? 'text-emerald-600' : 'text-rose-600'}`}>
              {variacao >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{Math.abs(variacao)}%
            </span>
          )}
        </div>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
  if (onClick) return <div onClick={onClick}>{inner}</div>;
  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}