import TabelaDemonstrativo from '@/components/dre/TabelaDemonstrativo';
import { operacional,divergencias } from '@/components/dre/modeloDRE';
import { percentuaisDRE,tipoPercentualDRE,formatarPercentualDRE } from '@/components/dre/percentuaisDRE';
export default function QuadroOperacional({c,k,abrir}){
  const cols=[['Competência',c],['Caixa',k]].map(([nome,b])=>({nome,valor:l=>b[l.key],extra:l=><small className="block text-[10px] font-normal text-muted-foreground">{percentuaisDRE(b[l.key],b,tipoPercentualDRE(l.key)).map(p=><span key={p.chave} className="block">{formatarPercentualDRE(p.valor)} {p.label}</span>)}</small>}));
  return <>{[['Competência',c],['Caixa',k]].map(([nome,b])=>{const falhas=divergencias(b);return falhas.length>0&&<p key={nome} role="alert" className="p-2 text-destructive">Conferir composição em {nome}: {falhas.join(', ')}.</p>})}<TabelaDemonstrativo legenda="Resultado por competência e caixa" linhas={operacional} colunas={cols} acao={l=>['item','detalhe'].includes(l.kind)?()=>abrir(l.key):null}/></>;
}