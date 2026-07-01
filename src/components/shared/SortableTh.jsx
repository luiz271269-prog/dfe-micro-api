import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

export default function SortableTh({ field, children, align = 'left', className = '', sortField, sortDir, onSort }) {
  const active = sortField === field;
  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  const thAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th className={`${thAlign} px-4 py-3 font-semibold text-muted-foreground ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 ${alignClass} hover:text-foreground transition-colors select-none w-full ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        <span>{children}</span>
        {active ? (
          sortDir === 'asc'
            ? <ArrowUp className="w-3.5 h-3.5 text-primary" />
            : <ArrowDown className="w-3.5 h-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}