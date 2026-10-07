import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCurrentMonth } from '@/lib/currentMonth';
import useConciliacaoComprasCartao from '@/components/cartoes/useConciliacaoComprasCartao';
import ConciliacaoCompraLinha from '@/components/cartoes/ConciliacaoCompraLinha';
export default function ConciliacaoComprasCartao({mes,anual=false}) {
  const [local,setLocal]=useState(getCurrentMonth());
  const periodo=mes||local;
  const {resultado:r,busy,erro,feedback,executar}=useConciliacaoComprasCartao(periodo);
  return <section className="bg-card text-card-foreground border rounded-xl p-4 mb-5 space-y-3">
    <div className="flex gap-3 items-center flex-wrap"><h2 className="font-semibold flex-1 flex items-center gap-2"><Link2 className="w-4 h-4 text-primary"/>Compra do cartão ↔ Documento de origem</h2>{!mes&&<Input className="w-auto" aria-label="Mês da conciliação" type="month" value={local} onChange={e=>setLocal(e.target.value)} disabled={busy}/>}</div>
    <p className="text-xs text-muted-foreground">Compras, Despesas e Obras são comparadas juntas para impedir reutilização. Automático somente com correspondência única nos dois sentidos, valor exato, fornecedor, empresa e classificação compatíveis, em até 3 dias. Casos ambíguos ficam para revisão.</p>
    <p className="text-xs">A compra conta uma vez; a obrigação com o fornecedor passa para a fatura. Este vínculo não declara que a fatura já foi paga pelo banco.</p>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||anual} onClick={()=>executar('analisar',{},null)}>{busy&&<Loader2 className="w-4 h-4 animate-spin"/>}Analisar mês sem alterar dados</Button><Button size="sm" disabled={busy||anual||!r?.resumo.automaticos} onClick={()=>executar('aplicar')}>Vincular alta confiança desta página</Button><Link className="text-xs text-primary underline self-center" to="/contas-a-pagar">Conferir obrigações e faturas</Link></div>
    {anual&&<p className="text-xs text-muted-foreground">Selecione a visão mensal para executar a conciliação.</p>}
    {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}{feedback&&<p role="status" className="text-sm text-primary">{feedback}</p>}
    {r&&<><p className="text-xs text-muted-foreground">Nesta página: {r.resumo.avaliados} compras · {r.resumo.automaticos} alta confiança · {r.resumo.revisao} para revisão · {r.resumo.conflitos} conflitos · {r.resumo.vinculados} vinculadas</p><div className="space-y-2">{r.detalhes.map(row=><ConciliacaoCompraLinha key={`${row.id}-${row.status}`} row={row} busy={busy} onConfirm={extra=>executar('confirmar',extra)} onRepair={id=>executar('reparar',{lancamento_cartao_id:id})}/>)}</div>{!r.detalhes.length&&<p className="text-sm text-muted-foreground">Nenhuma compra elegível nesta página.</p>}{r.has_more&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>executar('analisar',{},r.next_cursor)}>Próxima página de compras</Button>}</>}
  </section>;
}