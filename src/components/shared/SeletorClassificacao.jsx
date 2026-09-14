import { useState, useMemo } from 'react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { Plus } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getOpcoes, getCor, loadCustom, saveCustom, slugify } from '@/lib/classificacaoUnificada';
import TipoGastoSelector from '@/components/shared/TipoGastoSelector';

// Badge editável para os eixos unificados: eixo="origem" (Quem comprou) ou "tipo" (Tipo de compra)
export default function SeletorClassificacao({ eixo, entityName, record, field, onChange }) {
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(loadCustom);
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState('');
  const [valor, setValor] = useState(record?.[field] || '');

  const opcoes = useMemo(() => getOpcoes(eixo, custom), [eixo, custom]);

  async function salvar(v) {
    setValor(v);
    setEditing(false);
    const { data } = await revisarTiposGasto({ action: 'salvar_eixo', entidade: entityName, id: record.id, campo: field, valor: v });
    const aplicado = data?.classificacao?.[field] ?? v;
    setValor(aplicado);
    if (onChange) onChange(record.id, field, aplicado);
    window.dispatchEvent(new Event('neuralfinRefresh'));
  }

  function adicionar() {
    const label = novo.trim();
    const key = slugify(label);
    if (!key) return;
    const next = { ...custom, [eixo]: { ...(custom[eixo] || {}), [key]: label } };
    setCustom(next);
    saveCustom(next);
    setNovo('');
    setAdding(false);
    salvar(key);
  }

  if (eixo === 'tipo') return <TipoGastoSelector entityName={entityName} record={record} onChange={onChange} />;

  if (adding) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); if (e.key === 'Escape') setAdding(false); }}
          placeholder="Nova opção"
          className="h-6 text-[10px] px-1.5 border rounded bg-background w-28"
        />
        <button onClick={adicionar} className="text-[10px] font-semibold text-primary hover:underline">OK</button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Select value={valor || ''} onValueChange={salvar} open onOpenChange={(o) => { if (!o) setEditing(false); }}>
          <SelectTrigger className="h-6 text-[10px] px-1.5 w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {Object.entries(opcoes).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={() => { setEditing(false); setAdding(true); }} title="Adicionar opção" className="text-muted-foreground hover:text-primary">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        onClick={() => setEditing(true)}
        title="Clique para classificar"
        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-75 transition-opacity ${getCor(eixo, valor)}`}
      >
        {opcoes[valor] || '—'}
      </span>
      <button type="button" onClick={() => setAdding(true)} title="Adicionar nova opção" className="text-muted-foreground/50 hover:text-primary">
        <Plus className="w-3 h-3" />
      </button>
    </span>
  );
}