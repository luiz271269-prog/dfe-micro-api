import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { TIPOS_COMPRA, tipoGastoValido, getCor, exigeTipoGasto } from '@/lib/classificacaoUnificada';

export default function TipoGastoSelector({ entityName, record, onChange }) {
  const [valor, setValor] = useState(record?.tipo_compra || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setValor(record?.tipo_compra || ''); }, [record?.id, record?.tipo_compra]);
  if (entityName === 'FaturaCartao') return <span className="text-[10px] text-muted-foreground">Tipos nos lançamentos do cartão</span>;
  if (entityName === 'LancamentoBancario' && record?.valor !== undefined && !exigeTipoGasto(entityName, record)) return <span className="text-[10px] text-muted-foreground">Não se aplica — movimentação financeira</span>;
  const pendente = !tipoGastoValido(valor);
  async function salvar(tipo) {
    if (!tipoGastoValido(tipo) || saving) return;
    setSaving(true); setError('');
    try {
      const { data } = await revisarTiposGasto({ action: 'salvar', entidade: entityName, id: record.id, tipo });
      if (data?.error) throw new Error(data.error);
      setValor(tipo); setEditing(false);
      onChange?.(record.id, 'tipo_compra', tipo);
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }
  return <span className="inline-flex flex-col gap-1 max-w-full">
    <span className="inline-flex items-center gap-1">
      {editing ? <select aria-label="Tipo de gasto" autoFocus disabled={saving} value={tipoGastoValido(valor) ? valor : ''} onChange={e => salvar(e.target.value)} className="h-7 max-w-full rounded border bg-background text-xs">
        <option value="" disabled>Escolha o tipo de gasto</option>
        {Object.entries(TIPOS_COMPRA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select> : <button type="button" onClick={() => setEditing(true)} title={pendente ? `Classificação anterior: ${valor || 'não informada'}` : 'Alterar tipo de gasto'} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-left ${pendente ? 'bg-warning/10 text-warning' : getCor('tipo', valor)}`}>
        {pendente ? 'Pendente de classificação' : TIPOS_COMPRA[valor]}
      </button>}
      <button type="button" disabled={saving} onClick={() => setEditing(v => !v)} aria-label="Selecionar tipo de gasto" className="text-muted-foreground hover:text-primary"><Plus className="w-3.5 h-3.5" /></button>
      {saving && <span className="text-xs text-muted-foreground">Salvando…</span>}
    </span>
    {error && <span role="alert" className="text-xs text-destructive whitespace-normal">{error}</span>}
  </span>;
}