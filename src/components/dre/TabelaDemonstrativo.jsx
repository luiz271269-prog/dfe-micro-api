import { estiloDRE } from '@/components/dre/estruturaDRE';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { sinalDRE } from '@/components/dre/modeloDRE';

export default function TabelaDemonstrativo({linhas,colunas,acao,selecionada,nota,legenda}){
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><caption className="sr-only">{legenda}</caption>
    <thead className="bg-muted text-muted-foreground"><tr><th scope="col" className="p-2 text-left">Descrição</th>{colunas.map(c=><th key={c.nome} scope="col" className="p-2 text-right">{c.nome}</th>)}</tr></thead>
    <tbody>{linhas.map(l=>{const click=acao?.(l),total=l.kind==='total',det=l.kind==='detalhe',obs=nota?.(l);return <tr key={l.key} className={`border-b last:border-0 ${estiloDRE[l.kind]} ${selecionada===l.key?'bg-accent ring-1 ring-inset ring-primary':''}`}>
      <th scope="row" className={`py-2.5 pr-2 text-left ${det?'pl-5 font-normal text-muted-foreground':'pl-2'}`}>{click?<button className="text-left hover:underline" onClick={click}>{l.label} <ChevronRight className="inline h-3 w-3"/></button>:l.label}{obs&&<small className="block text-warning">{obs}</small>}</th>
      {colunas.map(c=>{const raw=c.valor(l),v=sinalDRE(l,raw);return <td key={c.nome} className="p-2 text-right tabular-nums"><span className={`whitespace-nowrap ${v<0?'text-destructive':total&&v>0?'text-success':''}`}>{v==null?'—':formatCurrency(v)}</span>{c.extra?.(l)}</td>;})}
    </tr>;})}</tbody></table></div>;
}