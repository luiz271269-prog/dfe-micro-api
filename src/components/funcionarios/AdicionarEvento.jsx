import { Plus } from 'lucide-react';

// Chips de tipos pré-definidos ainda não usados na folha.
export default function AdicionarEvento({ presets, usados = [], onAdd, tone = 'provento' }) {
  const chip = tone === 'provento'
    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
    : 'border-red-200 text-red-700 hover:bg-red-50';
  const disponiveis = presets.filter(p => !usados.includes(p));
  if (disponiveis.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {disponiveis.map(p => (
        <button key={p} type="button" onClick={() => onAdd(p)}
          className={`text-[11px] font-semibold px-2 py-1 rounded-full border bg-card inline-flex items-center gap-1 ${chip}`}>
          <Plus className="w-3 h-3" /> {p}
        </button>
      ))}
    </div>
  );
}