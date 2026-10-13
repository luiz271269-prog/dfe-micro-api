import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import ReverterImportacaoDialog from '@/components/importar/ReverterImportacaoDialog';
import LembreteImportacao from '@/components/importar/LembreteImportacao';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import HistoricoImportacaoLinha from '@/components/importar/HistoricoImportacaoLinha';
export default function HistoricoImportacoes({tipos,tipo,onReler,busy,refresh}) {
  const [reversao,setReversao]=useState(null);
  const q=useInfiniteQuery({queryKey:['historico-importacoes',tipo,refresh],initialPageParam:undefined,queryFn:({pageParam})=>base44.entities.ImportBatch.filter(tipo?{batch_type:tipo}:{}, {sort:'-created_date',limit:50,...(pageParam?{cursor:pageParam}:{})}),getNextPageParam:p=>p.has_more?p.next_cursor:undefined});
  return <section className="mt-6">{tipo&&<LembreteImportacao key={tipo} tipo={tipo} label={tipos.find(t=>t.id===tipo)?.label || tipo} refresh={refresh} />}<h2 className="my-2 text-sm font-bold text-muted-foreground">{tipo?`Importações de ${tipos.find(t=>t.id===tipo)?.label || tipo}`:'Histórico completo · selecione um tipo para filtrar'}</h2><p className="mb-3 text-xs text-muted-foreground">Reler faz uma nova identificação e extração, sem reutilizar a leitura antiga. Alterações só são aplicadas após sua revisão.</p>
    {q.isLoading?<p>Carregando arquivos…</p>:q.isError?<p role="alert" className="text-destructive">{q.error.message}</p>:!q.data.pages[0].items.length?<p>{tipo?'Nenhuma importação deste tipo.':'Nenhuma importação realizada.'}</p>:<div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-xs"><thead className="bg-muted"><tr>{['Data','Documento / papel','Arquivo','Salvos','Status','Revisão'].map(c=><th key={c} className="p-3 text-left">{c}</th>)}</tr></thead><tbody>{q.data.pages.flatMap(p=>p.items).map(b=><HistoricoImportacaoLinha key={b.id} batch={b} tipos={tipos} onReler={onReler} onReverter={setReversao} busy={busy} />)}</tbody></table></div>}
    {q.hasNextPage&&<Button variant="outline" className="mt-3" disabled={q.isFetchingNextPage} onClick={()=>q.fetchNextPage()}>{q.isFetchingNextPage?'Carregando…':'Mais arquivos antigos'}</Button>}
    {reversao&&<ReverterImportacaoDialog key={reversao.id} batch={reversao} onClose={()=>setReversao(null)} />}
  </section>;
}