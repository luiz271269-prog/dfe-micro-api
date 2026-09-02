import { Input } from '@/components/ui/input';
import { X, Repeat } from 'lucide-react';

// Linha de um evento (fixo ou avulso): rótulo + valor; avulsos têm toggle recorrente e remover.
export default function EventoLinha({ label, valor, onChange, onRemove, recorrente, onToggleRecorrente, tone = 'provento' }) {
  const cor = tone === 'provento' ? 'text-emerald-700' : 'text-red-700';
  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-b-0">
      <span className="flex-1 text-sm truncate">{label}</span>
      {onToggleRecorrente && (
        <button type="button" onClick={onToggleRecorrente}
          title={recorrente ? 'Repete todo mês' : 'Só neste mês'}
          className={`p-1 rounded ${recorrente ? 'bg-primary/10 text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
          <Repeat className="w-3.5 h-3.5" />
        </button>
      )}
      <Input type="number" step="0.01" inputMode="decimal" value={valor}
        onChange={e => onChange(e.target.value)}
        className={`h-8 w-28 text-right text-sm font-semibold tabular-nums ${cor}`} />
      {onRemove ? (
        <button type="button" onClick={onRemove} className="p-1 text-muted-foreground hover:text-red-600" title="Remover">
          <X className="w-4 h-4" />
        </button>
      ) : <span className="w-6" />}
    </div>
  );
}