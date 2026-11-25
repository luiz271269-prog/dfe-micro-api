import { TIPOS_COMPRA } from '@/lib/classificacaoUnificada';
import TabelaDemonstrativo from '@/components/dre/TabelaDemonstrativo';
import { nomeTipoDRE,porChaveDRE } from '@/components/dre/estruturaDRE';
const nomes=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const mes=m=>`${nomes[Number(m.slice(5))-1]}/${m.slice(2,4)}`;
export default function TabelaMensalPorTipo({dados,tipos}){
  const linhas=[{...porChaveDRE.receita_bruta,campo:'receita'},...tipos.map(t=>({key:`tipo:${t}`,campo:t,label:nomeTipoDRE(t,TIPOS_COMPRA[t]),kind:'detalhe'})),{key:'pago',campo:'custoTotal',label:'Total pago',kind:'total'},{key:'diferenca',campo:'resultado',label:'Faturamento menos pagamentos',kind:'total'}];
  const coluna=(nome,valor,total=false)=>({nome,valor:l=>valor(l.campo),extra:l=>l.key!=='receita_bruta'&&!(total&&l.key==='diferenca')&&<small className="block font-normal text-muted-foreground">{valor('receita')>0?`${(100*valor(l.campo)/valor('receita')).toFixed(1)}%`:'—'}</small>});
  const colunas=[...dados.map(d=>coluna(mes(d.mes),k=>d[k]||0)),coluna('Total',k=>dados.reduce((s,d)=>s+(d[k]||0),0),true)];
  return <section className="rounded-xl border bg-card p-4"><h3 className="text-sm font-semibold">Pagamentos mês a mês por tipo</h3><p className="mb-3 text-xs text-muted-foreground">Pagamentos classificados em R$ e como percentual do faturamento. A diferença compara notas emitidas com pagamentos, não representa lucro operacional. Transferências entre contas e recebimentos não entram como despesa.</p><TabelaDemonstrativo linhas={linhas} colunas={colunas} legenda="Faturamento e pagamentos classificados por mês" /></section>;
}