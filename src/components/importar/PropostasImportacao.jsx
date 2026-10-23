import { useState } from 'react';
import { useInfiniteQuery,useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { chamarImportacao } from '@/components/importar/salvarImportacao';
import RegistroImportacaoLinha from '@/components/importar/RegistroImportacaoLinha';
import BaixasConfirmacao from '@/components/baixas/BaixasConfirmacao';
export default function PropostasImportacao({batchId}){
  const cache=useQueryClient(),[op,setOp]=useState(null),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[resultado,setResultado]=useState('');
  const q=useInfiniteQuery({queryKey:['registros-importacao',batchId],initialPageParam:undefined,queryFn:({pageParam})=>chamarImportacao({acao:'registros',batch_id:batchId,cursor:pageParam}),getNextPageParam:p=>p.has_more?p.next_cursor:undefined});
  function propor(r,c){setErro('');setOp({registro:r,candidato:c,resumo:{efeito:c.efeito==='composicao'?'Vínculo de composição, sem pagamento':'Conciliação financeira',documento:c.descricao_documento,movimento:c.descricao_movimento,empresa:c.empresa,data:c.data,valor:c.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),criterio:c.criterio,lote:batchId,proposta:r.id},payload:{motivo:'Conferência e autorização individual da proposta de importação'}});}
  async function confirmar(){setBusy(true);setErro('');try{const r=await chamarImportacao({acao:'confirmar',proposta_id:op.registro.id,versao:op.registro.updated_date,candidato:op.candidato.chave,confirmado:true});setResultado(r.resultado?.mensagem||'Execução já registrada no histórico.');setOp(null);await cache.invalidateQueries();window.dispatchEvent(new Event('neuralfinRefresh'));}catch(e){setErro(e.message);await cache.invalidateQueries({queryKey:['registros-importacao',batchId]});await cache.invalidateQueries({queryKey:['resumo-importacao',batchId]});}finally{setBusy(false);}}
  return <div className="space-y-3">{resultado&&<p role="status" className="rounded-lg border bg-primary/5 p-3 text-sm">{resultado}</p>}{q.isLoading?<p>Carregando conferências e propostas…</p>:q.isError?<p role="alert" className="text-destructive">{q.error.message}</p>:!q.data?.pages[0].items.length?<p>Nenhum registro associado a este lote.</p>:q.data.pages.flatMap(p=>p.items).map(r=><RegistroImportacaoLinha key={r.id} registro={r} onPropor={c=>propor(r,c)} busy={busy}/>)}
    {q.hasNextPage&&<Button variant="outline" disabled={q.isFetchingNextPage} onClick={()=>q.fetchNextPage()}>Carregar mais registros</Button>}
    <BaixasConfirmacao operacao={op} onClose={()=>setOp(null)} onConfirm={confirmar} busy={busy} erro={erro}/>
  </div>;
}