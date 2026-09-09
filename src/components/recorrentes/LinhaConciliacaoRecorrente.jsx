import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { conciliarRegraRecorrente } from '@/functions/conciliarRegraRecorrente';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function LinhaConciliacaoRecorrente({ lanc, matches, onRefresh }) {
  const [regraId, setRegraId] = useState(matches.length === 1 ? matches[0].regra.id : '');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState(false);
  const escolha = matches.find(m => m.regra.id === regraId);
  const vinculado = feito || ['conciliado', 'parcial', 'ignorar'].includes(lanc.status_conciliacao) || lanc.vinculos_count > 0;
  async function conciliar() {
    setBusy(true); setErro('');
    try {
      const res = await conciliarRegraRecorrente({ regra_id: regraId, lancamento_id: lanc.id });
      if (!res.data?.success) throw new Error(res.data?.error || 'Não foi possível conciliar');
      setFeito(true);
      await onRefresh();
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (e) { setErro(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }
  return <div className="border rounded-lg p-3 space-y-2">
    <div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold break-words">{lanc.descricao}</p><p className="text-xs text-muted-foreground">{formatDate(lanc.data)} · {lanc.conta_bancaria || 'Sem conta'}</p></div><span className="font-semibold tabular-nums whitespace-nowrap">{formatCurrency(Math.abs(lanc.valor))}</span></div>
    <div className="flex items-center gap-2 flex-wrap">
      <select aria-label="Regra a aplicar" className="min-w-0 flex-1 rounded-md border bg-background text-foreground p-2 text-xs" value={regraId} disabled={busy || vinculado} onChange={e => { setRegraId(e.target.value); setErro(''); }}>
        <option value="">Escolha a regra ({matches.length} compatíveis)</option>
        {matches.map(m => <option key={m.regra.id} value={m.regra.id}>{m.regra.nome} · esperado {formatCurrency(m.regra.valor_esperado)}</option>)}
      </select>
      <Button size="sm" onClick={conciliar} disabled={busy || vinculado || !escolha || escolha.status !== 'ok' || lanc.alerta_duplicidade}>{busy ? 'Conciliando...' : vinculado ? 'Já tratado' : 'Conciliar'}</Button>
    </div>
    {escolha?.status === 'divergente' && <p className="text-xs text-warning">Valor fora da tolerância: revise a regra antes de conciliar.</p>}
    {lanc.alerta_duplicidade && <p className="text-xs text-warning">Possível duplicidade; conciliação bloqueada.</p>}
    {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    {feito && <p role="status" className="text-xs text-success">Despesa vinculada e pagamento conciliado.</p>}
  </div>;
}