import { formatCurrency } from '@/lib/formatters';
import { ChevronRight } from 'lucide-react';

export default function DRELinhaDupla({
  label,
  comp,
  caixa,
  isTotal,
  isSub,
  negative,
  destaque,
  indent = 0,
  onClick,
}) {
  const fmt = (v) => {
    if (negative && v > 0) return `(${formatCurrency(v)})`;
    return formatCurrency(v);
  };
  const corValor = (v) =>
    destaque ? (v < 0 ? 'text-rose-600' : 'text-emerald-700') : negative ? 'text-rose-600' : '';

  const base = isTotal
    ? 'border-t-2 border-foreground/20 font-bold bg-muted/40'
    : isSub
      ? 'border-b border-border/40'
      : 'border-b border-border/20';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-2 sm:gap-3 py-2.5 px-3 min-h-[44px] ${base} ${
        destaque ? 'bg-indigo-50/70' : ''
      } ${onClick ? 'cursor-pointer hover:bg-muted/60 transition-colors' : ''}`}
    >
      <span
        className={`text-xs flex items-center gap-1 ${
          isTotal || destaque ? 'font-bold uppercase' : isSub ? 'font-semibold' : ''
        }`}
        style={{ paddingLeft: `${indent * 16}px` }}
      >
        {label}
        {onClick && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <div className="rounded-md bg-blue-50 px-2 py-1 sm:bg-transparent sm:p-0 sm:w-40 text-right">
          <span className="block sm:hidden text-[9px] font-bold uppercase text-blue-700/70">Competência</span>
          <span className={`text-sm tabular-nums text-blue-700 ${isTotal || destaque ? 'font-bold' : ''} ${corValor(comp)}`}>
            {fmt(comp)}
          </span>
        </div>
        <div className="rounded-md bg-emerald-50 px-2 py-1 sm:bg-transparent sm:p-0 sm:w-40 text-right">
          <span className="block sm:hidden text-[9px] font-bold uppercase text-emerald-700/70">Caixa</span>
          <span className={`text-sm tabular-nums text-emerald-700 ${isTotal || destaque ? 'font-bold' : ''} ${corValor(caixa)}`}>
            {fmt(caixa)}
          </span>
        </div>
      </div>
    </div>
  );
}