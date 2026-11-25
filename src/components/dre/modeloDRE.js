import { projetarDRE } from '@/components/dre/estruturaDRE';
const custo={deduz:true};
export const operacional=projetarDRE({receita_bruta:{regime:'competencia'},recebimentos:{campo:'receita_bruta',regime:'caixa'},das:custo,receita_liquida:{},cmv:{...custo,regime:'competencia'},comprasCartao:{...custo,campo:'cmv',regime:'caixa'},lucro_bruto:{},total_despesas_operacionais:custo,folha:custo,despesas:custo,outros_tributos:custo,manutencao:{...custo,campo:'obras',regime:'competencia'},prolabore:custo,investimentos:{...custo,campo:'obras',regime:'caixa'},lucro_operacional:{}});
export const campoDRE=l=>l.campo||l.key;
export const aplicaDRE=(l,regime)=>!l.regime||l.regime===regime;
export const valorDRE=(l,b,regime)=>aplicaDRE(l,regime)?b?.[campoDRE(l)]:null;
export const detalhavelDRE=l=>!['receita_liquida','lucro_bruto','lucro_operacional','total_despesas_operacionais'].includes(l.key);
export const sinalDRE=(linha,valor)=>valor==null?null:(linha.deduz?-valor:valor);
export const rotulosDRE=Object.fromEntries(operacional.map(l=>[l.key,l.label]));
export function subtotais(b){
  const round=n=>Math.round(n*100)/100;
  const receita_liquida=round(b.receita_bruta-b.das), lucro_bruto=round(receita_liquida-b.cmv);
  const total_despesas_operacionais=round(['folha','despesas','outros_tributos','prolabore','obras'].reduce((s,k)=>s+b[k],0));
  return {receita_liquida,lucro_bruto,total_despesas_operacionais,lucro_operacional:round(lucro_bruto-total_despesas_operacionais)};
}
export function divergencias(b){return Object.entries(subtotais(b)).filter(([key,n])=>!Number.isFinite(b[key])||Math.round(n*100)!==Math.round(b[key]*100)).map(([key])=>rotulosDRE[key]);}