import FixasContaSecao from '@/components/recorrentes/FixasContaSecao';
import { Button } from '@/components/ui/button';
import { GRUPOS_PLANO } from '@/lib/planoContasPadrao';

const NOMES_GRUPO = new Map(GRUPOS_PLANO);
function naturezaDoGrupo(g) {
  const n = Number(String(g.rotulo || '').match(/^(\d+)\./)?.[1]);
  return NOMES_GRUPO.has(n) ? { n, rotulo: `${n}. ${NOMES_GRUPO.get(n)}` } : { n: 99, rotulo: 'Conta não definida no plano' };
}

export default function FixasPlanoLista({painel,inicio,fim,admin,onEditar,onToggle,onExcluir,onSaved,onRevisar}) {
  const linhaProps = { inicio, fim, admin, onEditar, onToggle, onExcluir, onSaved, onRevisar };
  const naturezas = new Map();
  for (const g of painel.grupos) {
    const regras = painel.regras.filter(r => (r.categoria ?? null) === (g.chave ?? null));
    if (!regras.length) continue;
    const nat = naturezaDoGrupo(g);
    if (!naturezas.has(nat.n)) naturezas.set(nat.n, { ...nat, contas: [] });
    naturezas.get(nat.n).contas.push({ grupo: g, regras });
  }
  return <div className="space-y-4">
    <h2 className="text-sm font-bold">Despesas fixas cadastradas ({painel.total}) · organizadas pelo plano de contas</h2>
    {painel.pendentes>0&&<p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{painel.pendentes} cadastro(s) aguardam revisão de empresa, centro de custo ou natureza operacional. Permanecem visíveis, mas não entram nas previsões operacionais certificadas.</p>}
    {!painel.total&&<p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhuma despesa fixa cadastrada.</p>}
    {[...naturezas.values()].sort((a, b) => a.n - b.n).map(nat => (
      <div key={nat.n} className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{nat.rotulo}</h3>
        {nat.contas.map(c => <FixasContaSecao key={c.grupo.chave || 'sem-conta'} grupo={c.grupo} regras={c.regras} linhaProps={linhaProps} />)}
      </div>
    ))}
    {painel.hasNextPage&&<Button variant="outline" disabled={painel.isFetchingNextPage} onClick={()=>painel.fetchNextPage()}>{painel.isFetchingNextPage?'Carregando...':'Carregar mais despesas fixas'}</Button>}
  </div>;
}