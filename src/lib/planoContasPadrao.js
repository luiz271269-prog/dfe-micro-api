export const NATUREZAS_PLANO = [
  ['receitas', '1. RECEITAS', 1], ['estoque', '2. CUSTOS', 2],
  ['despesas', '3. DESPESAS OPERACIONAIS', 3], ['folha', '4. FOLHA DE PAGAMENTO', 4],
  ['pro_labore', '4.04 Pró-labore', 4.04], ['impostos', '5. TRIBUTOS', 5],
  ['obras', '6. INVESTIMENTOS', 6], ['financeiro', '7. FINANCEIRO', 7],
].map(([chave, rotulo, ordem]) => ({ eixo: 'tipo', chave, rotulo, ordem, nivel: 'base' }));

const conta = (chave, rotulo, ordem, natureza, centros = []) => ({
  eixo: 'categoria', chave, rotulo, ordem, nivel: 'subcategoria',
  natureza_vinculada: natureza, naturezas_vinculadas: natureza ? [natureza] : [], centros_custo_vinculados: centros,
});

export const CONTAS_PLANO = [
  conta('recebimento', '1.01 Recebimentos', 1.01, 'receitas'),
  conta('fornecedor', '2.01 CMV - Produtos', 2.01, 'estoque'), conta('fretes_compras_vendas', '2.02 Fretes sobre compras/vendas', 2.02, 'estoque'),
  conta('servicos_diretamente_vinculados', '2.03 Serviços diretamente vinculados', 2.03, 'estoque'), conta('produtos', '2.04 Produtos', 2.04, 'estoque'), conta('estoque', '2.05 Estoque', 2.05, 'estoque'),
  conta('administrativas', '3.01 Administrativas', 3.01, 'despesas'), conta('comerciais', '3.02 Comerciais', 3.02, 'despesas'),
  conta('despesa_operacional', '3.03 Operacionais', 3.03, 'despesas'), conta('tecnologia', '3.04 Tecnologia', 3.04, 'despesas'),
  conta('transporte', '3.05 Veículos / transporte', 3.05, 'despesas'), conta('outro', '3.06 Outras despesas', 3.06, 'despesas'),
  conta('combustivel', '3.07 Combustível', 3.07, 'despesas'), conta('seguro', '3.08 Seguro', 3.08, 'despesas'), conta('pessoal', '3.09 Pessoal', 3.09, 'despesas'),
  conta('salarios_comissoes', '4.01 Salários + comissões', 4.01, 'folha'), conta('rescisoes_contrato', '4.02 Rescisões de contrato', 4.02, 'folha'),
  conta('beneficios', '4.03 Benefícios (férias / 13º salário)', 4.03, 'folha'), conta('pro_labore', '4.04 Pró-labore', 4.04, 'pro_labore', ['pro_labore']),
  conta('alimentacao', '4.05 Alimentação', 4.05, 'pro_labore', ['pro_labore']), conta('lazer', '4.06 Lazer', 4.06, 'pro_labore', ['pro_labore']),
  conta('beleza', '4.07 Beleza', 4.07, 'pro_labore', ['pro_labore']), conta('farmacia', '4.08 Farmácia', 4.08, 'pro_labore', ['pro_labore']),
  conta('saude_bem_estar', '4.09 Saúde/Bem-Estar', 4.09, 'pro_labore', ['pro_labore']), conta('servico_pessoal', '4.10 Serviço Pessoal', 4.1, 'pro_labore', ['pro_labore']),
  conta('das', '5.01 DAS', 5.01, 'impostos'), conta('tributos_vendas', '5.02 Tributos sobre vendas', 5.02, 'impostos'),
  conta('tributos_folha', '5.03 Tributos sobre folha', 5.03, 'impostos'), conta('tributo', '5.04 Tributos e taxas diversos', 5.04, 'impostos'),
  conta('equipamentos', '6.01 Equipamentos', 6.01, 'obras'), conta('moveis', '6.02 Móveis', 6.02, 'obras'),
  conta('infraestrutura', '6.03 Infraestrutura', 6.03, 'obras'), conta('obras_reforma', '6.04 Obras / Reformas', 6.04, 'obras'),
  conta('financeiro', '7.00 Despesas financeiras', 7, 'financeiro'), conta('tarifas', '7.01 Tarifas', 7.01, 'financeiro'),
  conta('juros', '7.02 Juros', 7.02, 'financeiro'), conta('rendimentos', '7.03 Rendimentos', 7.03, 'financeiro'), conta('emprestimos', '7.04 Empréstimos', 7.04, 'financeiro'),
  conta('transferencia', '8.01 Transferências internas', 8.01, ''), conta('interno', '8.01 Movimentações internas', 8.011, ''),
  conta('aplicacoes', '8.02 Aplicações', 8.02, ''), conta('resgates', '8.03 Resgates', 8.03, ''), conta('saque', '8.04 Retiradas pessoais', 8.04, 'pro_labore', ['pro_labore']),
];

export const GRUPOS_PLANO = [
  [1, 'RECEITAS'], [2, 'CUSTOS'], [3, 'DESPESAS OPERACIONAIS'], [4, 'FOLHA DE PAGAMENTO'],
  [5, 'TRIBUTOS'], [6, 'INVESTIMENTOS'], [7, 'FINANCEIRO'], [8, 'MOVIMENTAÇÕES NÃO DRE'],
];