const linhas = entradas => entradas.map(([nome, valor, nota, subtotal]) => ({
  nome, valores: [valor], nota, subtotal: subtotal ?? typeof valor === 'number',
}));

export default function linhasComparativo(op, cx, carteira) {
  const f = op.faturamento.fontes, d = op.despesas.componentes, p = cx.pagamentos, r = cx.retiradas;
  const ded = op.tributos.valor + op.cmvEstimado.valor;
  const negativo = linha => ({ ...linha, exibicao: -linha.valor });
  const outros = [r.proLabore, r.pessoal, cx.investimentos, cx.financeiros, cx.aplicacoes, cx.transferenciasForaPerimetro, cx.naoClassificado];
  return [
    { id: 'operacao', titulo: 'Operação', contexto: 'Receitas, custos e despesas por competência', coluna: 0, largura: 1, linhas: linhas([
      ['Receita bruta de vendas e serviços', op.faturamento.valor], ['Vendas de produtos', f.produtos], ['Serviços / Assistência', f.servicos], ['Locações', f.locacoes],
      ['(−) Deduções e custos da operação', -ded], ['Deduções e tributos sobre vendas', negativo(op.tributos)],
      [op.cmvEstimado.fonteStatus === 'indisponivel' ? 'CMV indisponível — Central desconectada' : 'Custo das mercadorias vendidas (CMV)', negativo(op.cmvEstimado)],
      ['Resultado bruto', op.faturamento.valor - ded], ['(−) Despesas operacionais', -(op.folha.valor + op.despesas.valor)],
      ['Pessoal por competência: salários, encargos e benefícios', negativo(op.folha)], ['Despesas administrativas e operacionais', negativo(d.despesasOp)],
      ['Manutenção de obras e instalações', negativo(d.obrasManutencao)],
      ['Resultado operacional', op.resultado, op.margemOperacional != null ? `${op.margemOperacional}% do faturamento` : null],
    ]) },
    { id: 'caixa', titulo: 'Caixa', contexto: 'Entradas e saídas efetivamente realizadas', coluna: 1, largura: 1, linhas: linhas([
      ['Recebimentos operacionais', cx.recebimentos, null, true], ['Saídas de caixa', cx.totalPagamentos],
      ['Pagamentos a fornecedores', p.compras], ['Pagamentos de faturas de cartão', p.cartao], ['Impostos pagos', p.tributos],
      ['Pagamentos de pessoal', p.folha], ['Outras despesas pagas', p.despesas], ['Caixa operacional líquido', cx.caixaOperacao],
      ['Movimentos financeiros e de investimento', outros.reduce((s, l) => s + l.valor, 0)],
      ['Pagamentos de pró-labore', r.proLabore], ['Retiradas pessoais realizadas', r.pessoal], ['Saídas para obras e investimentos', cx.investimentos],
      ['Financeiros (tarifas, juros, empréstimos)', cx.financeiros], ['Aplicações / resgates', cx.aplicacoes],
      ...(cx.transferenciasForaPerimetro.registros ? [['Transferências fora do perímetro', cx.transferenciasForaPerimetro]] : []),
      ...(cx.naoClassificado.registros ? [['Não classificado (requer revisão)', cx.naoClassificado]] : []),
      ['Resultado líquido de caixa no período', cx.resultado],
    ]) },
    { id: 'obrigacoes', titulo: 'Obrigações', contexto: 'Saldos em aberto e previsões, sem pagamentos realizados', coluna: 2, largura: 2,
      linhas: carteira ? [
        ...carteira.grupos.map(g => ({ nome: g.rotulo, valores: [g.confirmado, g.previsto], href: g.href })),
        { nome: 'Totais de contas a pagar', valores: [carteira.totalConfirmado, carteira.totalPrevisto], subtotal: true },
      ] : [],
    },
  ];
}