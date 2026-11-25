import TabelaDemonstrativo from '@/components/dre/TabelaDemonstrativo';
import { operacional, divergencias, campoDRE, valorDRE, detalhavelDRE } from '@/components/dre/modeloDRE';
import { percentuaisDRE,tipoPercentualDRE,formatarPercentualDRE } from '@/components/dre/percentuaisDRE';
export default function QuadroOperacional({c,k,abrir}){
  const cols=[['Competência','competencia',c],['Caixa','caixa',k]].map(([nome,regime,b])=>({nome,valor:l=>valorDRE(l,b,regime),extra:l=>valorDRE(l,b,regime)!=null&&<small className="block text-[10px] font-normal text-muted-foreground">{percentuaisDRE(b[campoDRE(l)],b,tipoPercentualDRE(campoDRE(l))).map(p=><span key={p.chave} className="block">{formatarPercentualDRE(p.valor)} {p.label}</span>)}</small>}));
  return <>{[['Competência',c],['Caixa',k]].map(([nome,b])=>{const falhas=divergencias(b);return falhas.length>0&&<p key={nome} role="alert" className="p-2 text-destructive">Conferir composição em {nome}: {falhas.join(', ')}.</p>})}<TabelaDemonstrativo legenda="Resultado por competência e caixa" linhas={operacional} colunas={cols} acao={l=>detalhavelDRE(l)?()=>abrir(l):null}/></>;
}