import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getOpcoes, loadCustom, saveCustom, slugify } from '@/lib/classificacaoUnificada';

// Campo de formulário para os eixos unificados (origem, tipo, categoria) com botão (+) para adicionar novas opções
export default function CampoClassificacao({ eixo, label, value, onChange }) {
  const [custom, setCustom] = useState(loadCustom);
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState('');
  const opcoes = useMemo(() => getOpcoes(eixo, custom), [eixo, custom]);

  function adicionar() {
    const lbl = novo.trim();
    const key = slugify(lbl);
    if (!key) return;
    const next = { ...custom, [eixo]: { ...(custom[eixo] || {}), [key]: lbl } };
    setCustom(next);
    saveCustom(next);
    setNovo('');
    setAdding(false);
    onChange(key);
  }

  return (
    <div>
      <Label>{eixo === 'origem' ? 'Responsável econômico' : eixo === 'tipo' ? 'Natureza econômica' : eixo === 'categoria' ? 'Conta analítica' : label}</Label>
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } if (e.key === 'Escape') setAdding(false); }}
            placeholder="Nova opção"
            className="h-9 text-sm px-2 border rounded-md bg-background flex-1 min-w-0"
          />
          <button type="button" onClick={adicionar} className="h-9 px-2.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90">OK</button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Select value={opcoes[value] ? value : ''} onValueChange={onChange}>
            <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder={eixo === 'tipo' ? 'Pendente de classificação' : '—'} /></SelectTrigger>
            <SelectContent>
              {Object.entries(opcoes).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {eixo !== 'tipo' && <button type="button" onClick={() => setAdding(true)} title="Adicionar nova opção" className="h-9 w-8 shrink-0 flex items-center justify-center rounded-md border text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            <Plus className="w-4 h-4" />
          </button>}
        </div>
      )}
    </div>
  );
}