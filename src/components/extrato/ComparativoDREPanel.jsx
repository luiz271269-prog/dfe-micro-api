import { Link } from 'react-router-dom';
import { RefreshCw, Scale } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useDREExtrato, linhaDREDe } from '@/components/extrato/linhasDRE';
import { operacional, sinalDRE, subtotais, aplicaDRE, campoDRE, detalhavelDRE } from '@/components/dre/modeloDRE';
import TabelaDemonstrativo from '@/components/dre/TabelaDemonstrativo';

export default function ComparativoDREPanel({mes,isAnnual,lancamentos,filtroDRE,onLinha}){
  const {data,isLoading,isFetching,error,refetch}=useDREExtrato(mes,isAnnual);
  const soma={};
  for(const l of lancamentos){const k=linhaDREDe(data?.mapa_extrato,l.id); soma[k]=(soma[k]||0)+(l.valor||0);}
  const caixa=operacional.filter(l=>aplicaDRE(l,'caixa'));
  const extrato=Object.fromEntries(caixa.map(campoDRE).map(k=>[k,Math.abs(soma[k]||0)]));
  Object.assign(extrato,subtotais(extrato),{fora:soma.fora||0});
  const linhas=[...caixa,{key:'fora',label:'Fora da DRE · movimento líquido',kind:'item'}];
  const cols=[{nome:'Extrato',valor:l=>extrato[campoDRE(l)]},{nome:'DRE Caixa',valor:l=>data?.caixa?.[campoDRE(l)]}];
  function nota(l){const d=data?.caixa?.[campoDRE(l)];if(d==null)return null;const diff=sinalDRE(l,extrato[campoDRE(l)]-d);return Math.abs(diff)>=0.0099?`Dif. ${formatCurrency(diff)}`:null;}
  return <aside className="min-w-0 overflow-hidden rounded-xl border bg-card"><header className="flex items-center justify-between border-b bg-muted/40 p-3"><div><h3 className="flex items-center gap-2 text-sm font-bold"><Scale size={16}/>Extrato × DRE Caixa</h3><p className="text-xs text-muted-foreground">{isAnnual?`Ano civil de ${mes.slice(0,4)}`:mes} · Grupo consolidado</p></div><button aria-label="Atualizar comparativo" onClick={()=>refetch()}><RefreshCw size={15} className={isFetching?'animate-spin':''}/></button></header>
  {isLoading?<p className="p-3 text-xs">Carregando comparativo…</p>:error?<p className="p-3 text-xs text-destructive">Não foi possível ler a DRE: {error.message}</p>:<TabelaDemonstrativo legenda="Conferência do extrato com a DRE Caixa" linhas={linhas} colunas={cols} selecionada={linhas.find(l=>campoDRE(l)===filtroDRE)?.key} nota={nota} acao={l=>detalhavelDRE(l)?()=>onLinha(campoDRE(l)):null}/>}
  <footer className="border-t p-3 text-xs text-muted-foreground">O extrato usa o mês de referência e exclui lançamentos marcados para ignorar. A DRE Caixa usa a data bancária. Diferença = extrato menos DRE, com o sinal da linha. <Link className="font-semibold text-primary" to={`/dre-operacional?mes=${mes}&modo=${isAnnual?'ano_civil':'mensal'}`}>Abrir DRE deste período</Link></footer></aside>;
}