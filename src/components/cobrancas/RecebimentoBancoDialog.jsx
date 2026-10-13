import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { vincularExtrato } from '@/functions/vincularExtrato';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
export default function RecebimentoBancoDialog({titulo,onClose,onSaved}) {
  const [mes,setMes]=useState(new Date().toISOString().slice(0,7)),[banco,setBanco]=useState(''),[valor,setValor]=useState(String(Math.max(0,(titulo.valor_titulo || 0)-(titulo.valor_pago || 0)))),[motivo,setMotivo]=useState(''),[erro,setErro]=useState(''),[busy,setBusy]=useState(false);
  const lista=useInfiniteQuery({queryKey:['creditos-recebimento',mes],initialPageParam:undefined,queryFn:({pageParam})=>base44.entities.LancamentoBancario.filter({mes_referencia:mes,valor:{$gt:0},categoria:{$nin:['transferencia','transferencia_interna','interno','aporte','emprestimo','aplicacao','resgate']},status_conciliacao:{$nin:['conciliado','ignorar']}},{sort:'-data',limit:50,...(pageParam?{cursor:pageParam}:{})}),getNextPageParam:p=>p.has_more?p.next_cursor:undefined});
  async function confirmar(){setBusy(true);setErro('');try{const r=await vincularExtrato({acao:'criar',entidade_tipo:'TituloCobranca',entidade_id:titulo.id,lancamento_bancario_id:banco,valor_alocado:Number(valor),tipo_vinculo:'recebimento_parcial',observacao:motivo});if(!r.data?.success)throw new Error(r.data?.error);onSaved();onClose();}catch(e){setErro(e.response?.data?.error || e.message);}finally{setBusy(false);}}
  return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Conciliar entrada · recebimento</DialogTitle><DialogDescription>{titulo.cliente} · {titulo.seu_numero || titulo.nosso_numero}</DialogDescription></DialogHeader>
    <p className="text-xs text-muted-foreground">A baixa será derivada do crédito bancário vinculado. Pagamento parcial mantém o saldo em aberto.</p>
    <label className="text-sm">Mês do extrato<Input type="month" value={mes} onChange={e=>{setMes(e.target.value);setBanco('');}} /></label>
    {lista.isLoading?<p>Buscando créditos…</p>:lista.isError?<p className="text-destructive">{lista.error.message}</p>:<label className="text-sm">Crédito do extrato<select className="mt-1 w-full rounded-md border bg-background p-2" value={banco} onChange={e=>setBanco(e.target.value)}><option value="">Selecione o recebimento</option>{lista.data?.pages.flatMap(p=>p.items).map(b=><option key={b.id} value={b.id}>{b.data} · {formatCurrency(b.valor-(b.valor_conciliado || 0))} disponível · {b.descricao}</option>)}</select></label>}
    {lista.hasNextPage&&<Button variant="outline" onClick={()=>lista.fetchNextPage()} disabled={lista.isFetchingNextPage}>Mais créditos</Button>}
    <label className="text-sm">Valor recebido<Input type="number" min="0.01" step="0.01" value={valor} onChange={e=>setValor(e.target.value)} /></label>
    <label className="text-sm">Justificativa<Input value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={1000} placeholder="Evidência da correspondência (mínimo 10 caracteres)" /></label>
    {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
    <Button disabled={busy||!banco||Number(valor)<=0||motivo.trim().length<10} onClick={confirmar}>{busy?'Conciliando…':'Confirmar recebimento'}</Button>
  </DialogContent></Dialog>;
}