import { useState } from 'react';
import { useInfiniteQuery,useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { revisarImportacao } from '@/functions/revisarImportacao';
export default function useReversaoImportacao(batch){
 const qc=useQueryClient(),[selecionada,setSelecionada]=useState(null),[preview,setPreview]=useState(null),[motivo,setMotivo]=useState(''),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[sucesso,setSucesso]=useState('');
 const q=useInfiniteQuery({queryKey:['correcoes-importacao',batch.id],initialPageParam:undefined,queryFn:({pageParam})=>base44.entities.AuditoriaImportacao.filter({batch_id:batch.id,fase:'confirmada',acao:{$ne:'reversao'}},{sort:'-created_date',limit:50,...(pageParam?{cursor:pageParam}:{})}),getNextPageParam:p=>p.has_more?p.next_cursor:undefined});
 function selecionar(a){setSelecionada(a);setPreview(null);setErro('');setMotivo('');setSucesso('');}
 async function executar(confirmar){setBusy(true);setErro('');setSucesso('');try{const r=await revisarImportacao({acao:confirmar?'reverter':'preverReversao',batch_id:batch.id,audit_id:selecionada.id,motivo,versao:preview?.versao});if(!r.data?.success)throw new Error(r.data?.error || 'Reversão não concluída.');if(confirmar){setSelecionada(null);setPreview(null);setMotivo('');setSucesso('Correção revertida e registrada na auditoria. A importação original foi preservada.');await qc.invalidateQueries();window.dispatchEvent(new Event('neuralfinRefresh'));localStorage.setItem('neuralfinPendingRefresh',Date.now().toString());}else setPreview(r.data);}catch(e){setErro(e.response?.data?.error || e.message);}finally{setBusy(false);}}
 return {q,selecionada,selecionar,preview,motivo,setMotivo,busy,erro,sucesso,executar};
}