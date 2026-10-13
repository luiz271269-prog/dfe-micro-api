import { useState } from 'react';
import { Button } from '@/components/ui/button';
import useEvidenciasFinanceiras from '@/components/financeiro/useEvidenciasFinanceiras';
import EvidenciaFinanceiraDialog from '@/components/financeiro/EvidenciaFinanceiraDialog';
import { formatCurrency } from '@/lib/formatters';
const NOMES={boletos_liquidados:'Boleto liquidado',relatorio_nfs:'Conferência fiscal',dda_boletos:'DDA · não pago'};
export default function EvidenciasFinanceirasPanel({direcao='entrada'}) {
  const [estado,setEstado]=useState('pendente'), [selecionada,setSelecionada]=useState(null);
  const {lista,totais,itens,atualizar}=useEvidenciasFinanceiras(direcao,estado);
  return <section className="my-4 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">Evidências de {direcao==='entrada'?'Entradas':'Saídas'} · conciliação</h3><p className="mt-1 text-xs text-muted-foreground">Documentos importados para conferir fontes existentes, sem criar notas, títulos ou débitos.</p>
    <div className="my-3 flex flex-wrap gap-2">{['pendente','confirmada','rejeitada'].map(s=><Button size="sm" key={s} variant={s===estado?'default':'outline'} onClick={()=>setEstado(s)}>{s} ({totais.data?.rows.find(r=>r.estado===s)?.count || 0})</Button>)}</div>
    {lista.isLoading?<p className="text-sm text-muted-foreground">Carregando evidências…</p>:lista.isError?<p className="text-sm text-destructive">{lista.error.message}</p>:!itens.length?<p className="py-3 text-sm text-muted-foreground">Nenhuma evidência neste estado.</p>:<div className="divide-y">{itens.map(ev=><div key={ev.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{ev.contraparte || ev.referencia}</p><p className="text-xs text-muted-foreground">{NOMES[ev.tipo]} · {ev.data || ev.vencimento} · {ev.referencia} · {ev.arquivo_nome}</p>{ev.motivo&&<p className="mt-1 text-xs text-muted-foreground">{ev.motivo} · {ev.confirmada_em?.slice(0,10)}</p>}</div><span className="font-semibold tabular-nums">{formatCurrency(ev.valor)}</span>{ev.estado==='pendente'&&<Button size="sm" variant="outline" onClick={()=>setSelecionada(ev)}>Revisar</Button>}</div>)}</div>}
    {lista.hasNextPage&&<Button className="mt-3" variant="outline" disabled={lista.isFetchingNextPage} onClick={()=>lista.fetchNextPage()}>{lista.isFetchingNextPage?'Carregando…':'Carregar mais'}</Button>}
    {selecionada&&<EvidenciaFinanceiraDialog item={selecionada} onClose={()=>setSelecionada(null)} onSaved={atualizar} />}
  </section>;
}