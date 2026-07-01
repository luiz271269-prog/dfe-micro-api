import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

const ALL_MONTHS = [
'2025-09', '2025-10', '2025-11', '2025-12',
'2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];


function fmtMes(m) {
  const [y, mo] = m.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(mo) - 1]}/${y.slice(2)}`;
}

export default function MonthNavigator({ selectedMonth, onSelectMonth, isAnnual, onToggleAnnual, monthTotals }) {
  const monthIdx = ALL_MONTHS.indexOf(selectedMonth);
  const canPrev = monthIdx > 0;
  const canNext = monthIdx < ALL_MONTHS.length - 1;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => {if (onToggleAnnual && isAnnual) onToggleAnnual();if (canPrev) onSelectMonth(ALL_MONTHS[monthIdx - 1]);}}
        disabled={!canPrev || isAnnual}
        className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors shrink-0">
        <ChevronLeft className="w-3.5 h-3.5" /></button>

      <div className="flex items-center gap-1 overflow-x-auto">
        {ALL_MONTHS.slice(-5).map((m) => {
          const isActive = !isAnnual && selectedMonth === m;
          const total = monthTotals?.[m];
          return (
            <button
              key={m}
              onClick={() => {if (onToggleAnnual && isAnnual) onToggleAnnual();onSelectMonth(m);}}
              className={`rounded-lg text-xs font-semibold transition-all flex flex-col items-center min-w-[60px] bg-[hsl(var(--sidebar-ring))] text-[hsl(var(--chart-4))] px-2 py-1 ${
              isActive ?
              'bg-primary text-primary-foreground shadow' :
              "border hover:bg-muted"}`
              }>
              
              <span>{fmtMes(m)}</span>
              {total !== undefined &&
              <span className={`text-[10px] font-bold mt-0.5 ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`}>
                  {formatCurrency(total, true)}
                </span>
              }
            </button>);

        })}
      </div>

      <button
        onClick={() => {if (onToggleAnnual && isAnnual) onToggleAnnual();if (canNext) onSelectMonth(ALL_MONTHS[monthIdx + 1]);}}
        disabled={!canNext || isAnnual}
        className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors shrink-0">
        <ChevronRight className="w-3.5 h-3.5" /></button>

      {onToggleAnnual &&
      <button
        onClick={onToggleAnnual}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ml-1 ${
        isAnnual ? 'bg-primary text-primary-foreground shadow' : 'border hover:bg-muted text-muted-foreground'}`
        }>
        Anual</button>
      }
    </div>);

}

export { ALL_MONTHS, fmtMes };