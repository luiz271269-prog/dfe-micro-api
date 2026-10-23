import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function RevisaoFixaLinha({ sugestao: s, onSolicitar, disabled }) {
  const [motivo, setMotivo] = useState('');
  function solicitar(e) {
    e.preventDefault();
    const acao = e.nativeEvent.submitter?.value;
    if (disabled || !['fixasConfirmar', 'fixasRejeitar'].includes(acao) || (s.bloqueada && acao === 'fixasConfirmar')) return;
    onSolicitar({ acao, mes: s.competencia, sugestao_id: s.id, motivo: motivo.trim() }, { operação: acao === 'fixasConfirmar' ? 'Confirmar ocorrência e vínculo da despesa fixa' : 'Rejeitar sugestão de conciliação', despesa: s.descricao_conta, competência: s.competencia, canal: s.canal === 'cartao' ? 'Compra no cartão, não quitação da fatura' : 'Débito bancário', evidência: s.descricao_extrato, valor: formatCurrency(s.valor_extrato), data: formatDate(s.data_extrato) });
  }
  return <article className="border rounded-lg p-3 space-y-2 text-xs">
    <div className="flex justify-between items-start gap-2"><h3 className="font-semibold text-sm break-words">{s.descricao_conta}</h3><span className="rounded-full bg-muted px-2 py-1 shrink-0">{s.canal === 'cartao' ? 'Cartão' : 'Extrato'}</span></div>
    <p className="break-words">{s.descricao_extrato}</p>
    <p>Previsto: {formatCurrency(s.valor_esperado)} · {formatDate(s.data_vencimento)}</p>
    <p>Encontrado: <b>{formatCurrency(s.valor_extrato)}</b> · {formatDate(s.data_extrato)}</p>
    <p className={s.bloqueada ? 'text-destructive' : 'text-muted-foreground'}>{s.motivo}</p>
    {s.canal === 'cartao' && <p className="text-muted-foreground">Reconhece uma única despesa operacional na competência e vincula o lançamento do cartão. A saída bancária ocorre somente na quitação da fatura.</p>}
    {s.status === 'pendente' ? <form onSubmit={solicitar} className="space-y-2"><Input aria-label={`Evidência conferida ou motivo para ${s.descricao_conta}`} placeholder="Evidência conferida / motivo (mín. 10 caracteres)" minLength={10} maxLength={500} required disabled={disabled} value={motivo} onChange={e => setMotivo(e.target.value)} /><div className="flex gap-2 flex-wrap"><Button size="sm" type="submit" value="fixasConfirmar" disabled={disabled || s.bloqueada}>Revisar baixa / conciliação</Button><Button size="sm" type="submit" value="fixasRejeitar" variant="outline" disabled={disabled}>Revisar rejeição</Button></div></form> : <p className="font-semibold text-success">{s.status === 'confirmada' ? 'Confirmada' : 'Rejeitada'}</p>}
  </article>;
}