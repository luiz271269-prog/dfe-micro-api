import FixaPlanoLinha from '@/components/recorrentes/FixaPlanoLinha';
import { Button } from '@/components/ui/button';
export default function FixasPlanoLista({painel,inicio,admin,onEditar,onToggle,onExcluir}) {
  return <div className="space-y-4">
    <h2 className="text-sm font-bold">Despesas fixas cadastradas ({painel.total}) · organizadas pelo plano de contas</h2>
    {painel.pendentes>0&&<p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{painel.pendentes} cadastro(s) aguardam revisão de empresa, centro de custo ou natureza operacional. Permanecem visíveis, mas não entram nas previsões operacionais certificadas.</p>}
    {!painel.total&&<p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhuma despesa fixa cadastrada.</p>}
    {painel.grupos.map(g=>{const regras=painel.regras.filter(r=>(r.categoria??null)===(g.chave??null));return regras.length>0&&<section key={g.chave||'sem-conta'} className="overflow-hidden rounded-xl border bg-card"><header className="border-b bg-muted/40 px-4 py-3"><h3 className="font-semibold">{g.rotulo}</h3><p className="text-xs text-muted-foreground">{g.count} cadastro(s) nesta conta</p></header><div className="divide-y">{regras.map(r=><FixaPlanoLinha key={r.id} regra={r} inicio={inicio} admin={admin} onEditar={onEditar} onToggle={onToggle} onExcluir={onExcluir}/>)}</div></section>;})}
    {painel.hasNextPage&&<Button variant="outline" disabled={painel.isFetchingNextPage} onClick={()=>painel.fetchNextPage()}>{painel.isFetchingNextPage?'Carregando...':'Carregar mais despesas fixas'}</Button>}
  </div>;
}