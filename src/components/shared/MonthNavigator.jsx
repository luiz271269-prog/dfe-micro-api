import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { getCurrentMonth } from '../../lib/currentMonth';

function buildMonthRange(start, end) {
  const months = [];
  let [year, month] = start.split('-').map(Number);
  while (`${year}-${String(month).padStart(2, '0')}` <= end) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
  return months;
}

const ALL_MONTHS = buildMonthRange('2025-09', getCurrentMonth());


function fmtMes(m) {
  const [y, mo] = m.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(mo) - 1]}/${y.slice(2)}`;
}

export default function MonthNavigator({ selectedMonth, onSelectMonth, isAnnual, onToggleAnnual, monthTotals }) {
  const months = [...new Set([...ALL_MONTHS, ...Object.keys(monthTotals || {}), selectedMonth])]
    .filter((month) => /^\d{4}-\d{2}$/.test(month))
    .sort();
  const monthIdx = months.indexOf(selectedMonth);
  const canPrev = monthIdx > 0;
  const canNext = monthIdx >= 0 && monthIdx < months.length - 1;
  const windowStart = Math.max(0, Math.min(monthIdx - 2, months.length - 5));
  const visibleMonths = months.slice(windowStart, windowStart + 5);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => {if (onToggleAnnual && isAnnual) onToggleAnnual();if (canPrev) onSelectMonth(months[monthIdx - 1]);}}
        disabled={!canPrev || isAnnual}
        className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors shrink-0">
        <ChevronLeft className="w-3.5 h-3.5" /></button>

      <div className="flex items-center gap-1 overflow-x-auto">
        {visibleMonths.map((m) => {
          const isActive = !isAnnual && selectedMonth === m;
          const total = monthTotals?.[m];
          return (
            <button
              key={m}
              onClick={() => {if (onToggleAnnual && isAnnual) onToggleAnnual();onSelectMonth(m);}}
              className={`rounded-lg text-xs font-semibold transition-all flex flex-col items-center min-w-[60px] bg-[hsl(var(--sidebar-ring))] text-[hsl(var(--chart-4))] px-2 py-1 opacity-70 ${
              isActive ?
              'bg-primary text-primary-foreground shadow' :
              "border hover:bg-muted"}`
              }>
              
              <span>{fmtMes(m)}</span>
              {total !== undefined &&
              <span className={`font-bold mt-0.5 text-[hsl(var(--destructive))] text-xs px-3 ${isActive ? 'text-emerald-300' : ""}`}>
                  {formatCurrency(total, true)}
                </span>
              }
            </button>);

        })}
      </div>

      <button
        onClick={() => {if (onToggleAnnual && isAnnual) onToggleAnnual();if (canNext) onSelectMonth(months[monthIdx + 1]);}}
        disabled={!canNext || isAnnual}
        className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors shrink-0">
        <ChevronRight className="w-3.5 h-3.5" /></button>

      {onToggleAnnual &&
      <button
        onClick={onToggleAnnual}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ml-1 bg-[hsl(var(--chart-4))] text-[hsl(var(--card-foreground))] ${
        isAnnual ? 'bg-primary text-primary-foreground shadow' : "border hover:bg-muted"}`
        }>
        Anual</button>
      }
    </div>);

}

export { ALL_MONTHS, fmtMes };