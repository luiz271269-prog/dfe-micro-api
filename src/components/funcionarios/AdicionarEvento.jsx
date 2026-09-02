import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Chips de tipos pré-definidos + campo "Novo tipo" para eventos personalizados.
export default function AdicionarEvento({ presets, usados = [], onAdd, tone = 'provento' }) {
  const [novo, setNovo] = useState('');
  const chip = tone === 'provento'
    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
    : 'border-red-200 text-red-700 hover:bg-red-50';
  const disponiveis = presets.filter(p => !usados.includes(p));

  function addCustom() {
    const d = novo.trim();
    if (!d) return;
    onAdd(d);
    setNovo('');
  }

  return (
    <div className="mt-2 space-y-2">
      {disponiveis.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {disponiveis.map(p => (
            <button key={p} type="button" onClick={() => onAdd(p)}
              className={`text-[11px] font-semibold px-2 py-1 rounded-full border bg-card inline-flex items-center gap-1 ${chip}`}>
              <Plus className="w-3 h-3" /> {p}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Novo tipo de evento..."
          className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={!novo.trim()} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Novo Tipo
        </Button>
      </div>
    </div>
  );
}