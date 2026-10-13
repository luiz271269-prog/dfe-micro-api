import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useReversaoImportacao from '@/components/importar/useReversaoImportacao';
import CorrecaoHistoricoItem from '@/components/importar/CorrecaoHistoricoItem';
export default function ReverterImportacaoDialog({batch,onClose}){
 const r=useReversaoImportacao(batch),itens=r.q.data?.pages.flatMap(p=>p.items) || [];
 return <Dialog open onOpenChange={v=>{if(!v&&!r.busy)onClose();}}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Reverter correção escolhida</DialogTitle><DialogDescription>{batch.file_name} · Somente os campos da correção escolhida voltam aos valores anteriores. A importação e o histórico permanecem; pagamentos e conciliações bloqueiam a reversão.</DialogDescription></DialogHeader>
 {r.q.isLoading?<p>Carregando correções…</p>:r.q.isError?<p role="alert" className="text-destructive">{r.q.error.message}</p>:!itens.length?<p>Nenhuma correção confirmada para este arquivo. A importação original não será desfeita.</p>:<div className="max-h-56 space-y-2 overflow-y-auto">{itens.map(a=><CorrecaoHistoricoItem key={a.id} audit={a} checked={r.selecionada?.id===a.id} busy={r.busy} onSelect={()=>r.selecionar(a)} />)}</div>}
 {r.q.hasNextPage&&<Button variant="outline" disabled={r.q.isFetchingNextPage||r.busy} onClick={()=>r.q.fetchNextPage()}>Mais correções antigas</Button>}
 {r.selecionada&&<Button variant="outline" disabled={r.busy} onClick={()=>r.executar(false)}>{r.busy?'Aguarde…':'Conferir valores antes de reverter'}</Button>}
 {r.preview&&<section className="space-y-3 rounded border p-3"><h3 className="text-sm font-semibold">Registro: {r.preview.referencia}</h3><ul className="space-y-1 text-xs">{r.preview.campos.map(c=><li key={c.campo}>{c.campo.replace(/_/g,' ')}: {String(c.atual ?? 'Ausente')} → <strong>{String(c.original ?? 'Ausente')}</strong></li>)}</ul><label className="block text-xs">Justificativa<Input value={r.motivo} maxLength={1000} onChange={e=>r.setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres" /></label><Button variant="destructive" disabled={r.busy||r.motivo.trim().length<10} onClick={()=>r.executar(true)}>Confirmar reversão desta correção</Button></section>}
 {r.erro&&<p role="alert" className="text-destructive">{r.erro}</p>}{r.sucesso&&<p role="status" className="text-success">{r.sucesso}</p>}
 </DialogContent></Dialog>;
}