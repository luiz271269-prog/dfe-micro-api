import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Campo único para criar um tipo de evento personalizado, escolhendo se é provento ou desconto.
export default function NovoTipoEvento({ onAdd }) {
  const [novo, setNovo] = useState('');
  const [tipo, setTipo] = useState('provento');

  function add() {
    const d = novo.trim();
    if (!d) return;
    onAdd(tipo, d);
    setNovo('');
  }

  return (
    <div className="flex gap-2 items-center">
      <div className="flex rounded-md border overflow-hidden text-xs font-semibold shrink-0">
        <button type="button" onClick={() => setTipo('provento')}
          className={`px-2.5 py-1.5 ${tipo === 'provento' ? 'bg-emerald-600 text-white' : 'bg-card text-emerald-700 hover:bg-emerald-50'}`}>Provento</button>
        <button type="button" onClick={() => setTipo('desconto')}
          className={`px-2.5 py-1.5 ${tipo === 'desconto' ? 'bg-red-600 text-white' : 'bg-card text-red-700 hover:bg-red-50'}`}>Desconto</button>
      </div>
      <Input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Novo tipo de evento..."
        className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={!novo.trim()} className="gap-1 shrink-0">
        <Plus className="w-3.5 h-3.5" /> Novo Tipo
      </Button>
    </div>
  );
}