import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palmtree, Check } from 'lucide-react';

export default function FeriasSection({ func }) {
  const [inicio, setInicio] = useState(func.ferias_inicio || '');
  const [fim, setFim] = useState(func.ferias_fim || '');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    setSalvando(true);
    await base44.entities.Funcionario.update(func.id, {
      ferias_inicio: inicio || null,
      ferias_fim: fim || null,
    });
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-2 flex items-center gap-1.5">
        <Palmtree className="w-3.5 h-3.5" /> Férias
      </p>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <Label className="text-xs">Início</Label>
          <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-blue-700">
          A folha de férias (salário + ⅓) é gerada automaticamente pelo botão "Gerar Folhas Pendentes".
        </p>
        <Button size="sm" onClick={salvar} disabled={salvando || !inicio} className="h-7 text-xs gap-1 shrink-0">
          {salvo ? <><Check className="w-3 h-3" /> Salvo</> : salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}