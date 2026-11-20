export default function linhasComparativo(op, cx, carteira) {
  const f = op.faturamento.fontes, d = op.despesas.componentes, p = cx.pagamentos, r = cx.retiradas;
  const ded = op.tributos.valor + op.cmvEstimado.valor;
  const negativo = linha => ({ ...linha, exibicao: -linha.valor });
  const outros = [r.proLabore, r.pessoal, cx.investimentos, cx.financeiros, cx.aplicacoes, cx.transferenciasForaPerimetro, cx.naoClassificado];
  const grupos = new Map((carteira?.grupos || []).map(g => [g.chave, g]));
  const rows = [
    ['Receita bruta de vendas e serviços',op.faturamento.valor], ['Vendas de produtos',f.produtos], ['Serviços / Assistência',f.servicos], ['Locações',f.locacoes],
    ['Entradas de caixa',null,cx.recebimentos.valor], ['Recebimentos operacionais',null,cx.recebimentos],
    ['(−) Deduções e custos da operação',-ded], ['Deduções e tributos sobre vendas',negativo(op.tributos)],
    [op.cmvEstimado.fonteStatus === 'indisponivel' ? 'CMV indisponível — Central desconectada' : 'Custo das mercadorias vendidas (CMV)',negativo(op.cmvEstimado)],
    ['Resultado bruto',op.faturamento.valor-ded], ['(−) Despesas operacionais',-(op.folha.valor+op.despesas.valor)], ['Saídas de caixa',null,cx.totalPagamentos],
    ['Compras (fornecedores)',null,p.compras,'compras'], ['Faturas de cartão',null,p.cartao,'cartoes'], ['Impostos',null,p.tributos,'tributos'],
    ['Pessoal: salários, encargos e benefícios',negativo(op.folha),p.folha,'folha'], ['Despesas administrativas e operacionais',negativo(d.despesasOp)],
    ['Outras despesas',null,p.despesas], ['Despesas fixas e operacionais',null,null,'despesas'], ['Manutenção de obras e instalações',negativo(d.obrasManutencao)],
    ['Resultado operacional',op.resultado,null,null,op.margemOperacional != null ? `${op.margemOperacional}% do faturamento` : null], ['Caixa operacional líquido',null,cx.caixaOperacao],
    ['Movimentos financeiros e de investimento',null,outros.reduce((s,l)=>s+l.valor,0)], ['Pró-labore',null,r.proLabore,'pro_labore'], ['Retiradas pessoais',null,r.pessoal,'pessoal'],
    ['Obras e investimentos',null,cx.investimentos,'obras'], ['Financeiros (tarifas, juros, empréstimos)',null,cx.financeiros,'financeiro'], ['Aplicações / resgates',null,cx.aplicacoes],
    ...(cx.transferenciasForaPerimetro.registros ? [['Transferências fora do perímetro',null,cx.transferenciasForaPerimetro]] : []),
    ...(cx.naoClassificado.registros ? [['Não classificado (requer revisão)',null,cx.naoClassificado]] : []), ['Resultado líquido de caixa no período',null,cx.resultado],
  ];
  return rows.map(([nome,opValor,cxValor,key,nota]) => ({nome,opValor,cxValor,grupo:grupos.get(key),nota}));
}