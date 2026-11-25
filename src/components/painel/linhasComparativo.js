import { projetarDRE } from '@/components/dre/estruturaDRE';

export default function linhasComparativo(op,cx,carteira){
  const f=op.faturamento.fontes,d=op.despesas.componentes,p=cx.pagamentos,r=cx.retiradas;
  const ded=op.tributos.valor+op.cmvEstimado.valor;
  const outros=[r.proLabore,r.pessoal,cx.investimentos,cx.financeiros,cx.aplicacoes,cx.transferenciasForaPerimetro,cx.naoClassificado];
  const grupos=new Map((carteira?.grupos||[]).map(g=>[g.chave,g]));
  const row=(opValor,cxValor,key,nota)=>({opValor,cxValor,grupo:grupos.get(key),nota});
  const neg=l=>({...l,exibicao:-l.valor});
  const operacao=projetarDRE({
    receita_bruta:row(op.faturamento.valor),produtos:row(f.produtos),servicos:row(f.servicos),locacoes:row(f.locacoes),entradas:row(null,cx.recebimentos.valor),recebimentos:row(null,cx.recebimentos),
    deducoes:row(-ded),tributos:row(neg(op.tributos),p.tributos,'tributos'),cmv:row(neg(op.cmvEstimado),null,null,op.cmvEstimado.fonteStatus==='indisponivel'?'CMV indisponível — Central desconectada':null),compras:row(null,p.compras,'compras'),cartoes:row(null,p.cartao,'cartoes'),lucro_bruto:row(op.faturamento.valor-ded),
    total_despesas_operacionais:row(-(op.folha.valor+op.despesas.valor)),folha:row(neg(op.folha),p.folha,'folha'),despesas:row(neg(d.despesasOp),p.despesas,'despesas'),manutencao:row(neg(d.obrasManutencao)),lucro_operacional:row(op.resultado,null,null,op.margemOperacional!=null?`${op.margemOperacional}% do faturamento`:null),saidas:row(null,cx.totalPagamentos),caixa_operacional:row(null,cx.caixaOperacao)
  });
  // Neste motor retiradas e investimentos só entram após o caixa operacional.
  return [...operacao,...projetarDRE({movimentos:row(null,outros.reduce((s,l)=>s+l.valor,0))}),...projetarDRE({
    prolabore:row(null,r.proLabore,'pro_labore'),pessoal:row(null,r.pessoal,'pessoal'),investimentos:row(null,cx.investimentos,'obras'),financeiro:row(null,cx.financeiros,'financeiro'),aplicacoes:row(null,cx.aplicacoes),
    ...(cx.transferenciasForaPerimetro.registros?{transferencias:row(null,cx.transferenciasForaPerimetro)}:{}),...(cx.naoClassificado.registros?{pendente:row(null,cx.naoClassificado)}:{}),resultado_caixa:row(null,cx.resultado),...(carteira?{carteira:{grupo:{confirmado:carteira.totalConfirmado,previsto:carteira.totalPrevisto}}}:{})
  })];
}