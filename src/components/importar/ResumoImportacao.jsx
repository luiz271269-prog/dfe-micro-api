import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { chamarImportacao } from '@/components/importar/salvarImportacao';
import useContratoImportacao from '@/hooks/useContratoImportacao';
import PropostasImportacao from '@/components/importar/PropostasImportacao';
export default function ResumoImportacao({batchId,tipo,onNova}){
  const cache=useQueryClient(),[busy,setBusy]=useState(false),[erro,setErro]=useState('');
  const {data:matriz=[]}=useContratoImportacao(),m=matriz.find(m=>m.tipo===tipo);
  const q=useQuery({queryKey:['resumo-importacao',batchId],queryFn:async()=>(await chamarImportacao({acao:'resumo',batch_id:batchId})).resumo});
  async function buscar(){setBusy(true);setErro('');try{let cursor;do{const r=await chamarImportacao({acao:'buscar',batch_id:batchId,cursor});cursor=r.has_more?r.next_cursor:null;}while(cursor);await cache.invalidateQueries({queryKey:['resumo-importacao',batchId]});await cache.invalidateQueries({queryKey:['registros-importacao',batchId]});}catch(e){setErro(e.message);}finally{setBusy(false);}}
  if(q.isLoading)return <p className="p-6">Carregando resultado da importação…</p>;
  if(q.isError)return <p role="alert" className="text-destructive">{q.error.message}</p>;
  const s=q.data;
  return <section className="space-y-4 mb-6"><h2 className="text-xl font-semibold">Arquivo processado · conciliação independente</h2><p className="text-xs text-muted-foreground">Lote {batchId} · {m?.grupo} · {m?.conciliacao.replaceAll('_',' ')}</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Importação</h3><p className="mt-2 text-sm">{s.lidos} lidos · {s.total} processados · {s.criados} criados · {s.atualizados} atualizados · {s.ignorados} ignorados · {s.erros} erros</p></div>
      <div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Conferência</h3><p className="mt-2 text-sm">{s.encontrados} encontrados · {s.divergentes} divergentes · {s.ambiguos} ambíguos · {s.sem_par} sem par</p>{s.aguardando_busca>0&&<p className="text-xs text-muted-foreground mt-1">{s.aguardando_busca} aguardando busca</p>}</div>
      <div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Liquidação / composição</h3><p className="mt-2 text-sm">{m?.pode_propor_liquidacao?`${s.pagamentos_informados} informados · ${s.propostas} para revisão · ${s.executados} execuções confirmadas · ${s.falhas} falhas`:'Não aplicável. Conferência não dá baixa.'}</p><p className="mt-1 text-xs text-muted-foreground">A importação não executa baixas.</p></div>
      <div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Próxima ação</h3><Button className="mt-2 whitespace-normal h-auto text-left" variant="outline" disabled={busy} onClick={buscar}>{busy?'Buscando, sem executar baixas…':m?.proxima_acao||'Conferir importação'}</Button>{m?.path&&<Link to={m.path} className="block mt-2 text-xs text-primary underline">Abrir módulo de origem</Link>}</div>
    </div>{erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
    <PropostasImportacao batchId={batchId}/><Button variant="outline" onClick={onNova}>Nova importação</Button>
  </section>;
}