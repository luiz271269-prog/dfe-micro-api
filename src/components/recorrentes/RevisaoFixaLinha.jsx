import { useState } from 'react';
import { revisarDespesasFixas } from '@/functions/revisarDespesasFixas';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function RevisaoFixaLinha({ sugestao: s, onRefresh, disabled }) {
  const [busy, setBusy] = useState(false), [erro, setErro] = useState('');
  async function resolver(acao) {
    setBusy(true); setErro('');
    try {
      const res = await revisarDespesasFixas({ acao, sugestao_id: s.id });
      if (!res.data?.success) throw new Error(res.data?.error || 'Não foi possível concluir');
      await onRefresh();
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (e) { setErro(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }
  return <article className="border rounded-lg p-3 space-y-2 text-xs">
    <div className="flex justify-between items-start gap-2"><h3 className="font-semibold text-sm break-words">{s.descricao_conta}</h3><span className="rounded-full bg-muted px-2 py-1 shrink-0">{s.canal === 'cartao' ? 'Cartão' : 'Extrato'}</span></div>
    <p className="break-words">{s.descricao_extrato}</p>
    <p>Previsto: {formatCurrency(s.valor_esperado)} · {formatDate(s.data_vencimento)}</p>
    <p>Encontrado: <b>{formatCurrency(s.valor_extrato)}</b> · {formatDate(s.data_extrato)}</p>
    <p className={s.bloqueada ? 'text-destructive' : 'text-muted-foreground'}>{s.motivo}</p>
    {s.canal === 'cartao' && <p className="text-muted-foreground">Confirma a compra desta despesa fixa na fatura; não cria outra despesa nem registra saída bancária.</p>}
    {s.status === 'pendente' ? <div className="flex gap-2 flex-wrap"><Button size="sm" disabled={busy || disabled || s.bloqueada} onClick={() => resolver('confirmar')}>{busy ? 'Processando...' : s.canal === 'cartao' ? 'Confirmar compra' : 'Confirmar pagamento'}</Button><Button size="sm" variant="outline" disabled={busy || disabled} onClick={() => resolver('rejeitar')}>Rejeitar</Button></div> : <p className="font-semibold text-success">{s.status === 'confirmada' ? 'Confirmada' : 'Rejeitada'}</p>}
    {erro && <p role="alert" className="text-destructive">{erro}</p>}
  </article>;
}