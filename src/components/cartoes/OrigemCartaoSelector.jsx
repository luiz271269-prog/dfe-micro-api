import { useEffect, useState } from 'react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';
import { getCor } from '@/lib/classificacaoUnificada';
export default function OrigemCartaoSelector({ record, onSaved }) {
  const [valor, setValor] = useState(record.origem_compra || ''), [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const { itens, opcoes } = useCadastroClassificacao('origem', record.tipo_compra);
  useEffect(() => { setValor(record.origem_compra || ''); }, [record.id, record.origem_compra]);
  async function salvar(v) {
    if (saving) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const { data } = await revisarTiposGasto({ action: 'salvar_eixo', entidade: 'LancamentoCartao', id: record.id, campo: 'origem_compra', valor: v });
      if (data.error) throw new Error(data.error);
      setValor(data.classificacao.origem_compra); setEditing(false); setSaved(data.classificacao.origem_compra === v ? 'Salvo' : 'Salvo com ajuste do plano de contas');
      onSaved?.(record.id, data.classificacao);
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (e) { setError(e.response?.data?.error || e.message); } finally { setSaving(false); }
  }
  return <div className="space-y-1">
    {editing ? <select aria-label="Quem comprou" value={valor} disabled={saving} onChange={e => salvar(e.target.value)} className="h-7 rounded border bg-background text-xs max-w-full"><option value="" disabled>Selecione...</option>{itens.map(i => <option key={i.chave} value={i.chave}>{i.rotulo}</option>)}</select> : <button type="button" onClick={() => setEditing(true)} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getCor('origem',valor)}`}>{opcoes[valor] || (valor ? 'Pendente de cadastro' : '—')}</button>}
    {(saving || saved) && <p aria-live="polite" className="text-[10px] text-muted-foreground">{saving ? 'Salvando...' : saved}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}