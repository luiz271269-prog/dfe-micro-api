const r = (key,label,kind='item',deduz=false) => ({key,label,kind,deduz});
export const operacional = [
  r('receita_bruta','Receita bruta de vendas'), r('das','Impostos sobre vendas · DAS','item',true),
  r('receita_liquida','Receita líquida','total'), r('cmv','Custo das mercadorias · CMV','item',true),
  r('lucro_bruto','Lucro bruto','total'), r('total_despesas_operacionais','Despesas operacionais','grupo',true),
  ...[['folha','Folha de pagamento'],['despesas','Despesas administrativas e operacionais'],['outros_tributos','Outros tributos'],['prolabore','Pró-labore'],['obras','Obras e reformas']].map(([k,l])=>r(k,l,'detalhe',true)),
  r('lucro_operacional','Resultado operacional','total')
];
export const sinalDRE=(linha,valor)=>valor==null?null:(linha.deduz?-valor:valor);
export const rotulosDRE=Object.fromEntries(operacional.map(l=>[l.key,l.label]));
export function subtotais(b){
  const round=n=>Math.round(n*100)/100;
  const receita_liquida=round(b.receita_bruta-b.das), lucro_bruto=round(receita_liquida-b.cmv);
  const total_despesas_operacionais=round(operacional.filter(l=>l.kind==='detalhe').reduce((s,l)=>s+b[l.key],0));
  return {receita_liquida,lucro_bruto,total_despesas_operacionais,lucro_operacional:round(lucro_bruto-total_despesas_operacionais)};
}
export function divergencias(b){return Object.entries(subtotais(b)).filter(([key,n])=>!Number.isFinite(b[key])||Math.round(n*100)!==Math.round(b[key]*100)).map(([key])=>rotulosDRE[key]);}