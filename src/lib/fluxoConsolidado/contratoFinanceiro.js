/**
 * GATE 1 — CONTRATO FINANCEIRO (Plano Unificado Loop-R)
 *
 * Fonte única de verdade para o motor consolidado. Nenhum componente ou
 * cálculo pode usar regra que não esteja declarada aqui.
 *
 * status: 'definido' | 'provisorio' | 'pendente_usuario'
 * regime: 'competencia' | 'caixa' | 'posicao'
 * perimetro: 'conta' | 'empresa' | 'grupo'
 */

export const PERIMETROS = {
  conta: 'Conta bancária individual',
  empresa: 'Empresa (NeuralTec ou Liesch)',
  grupo: 'Grupo consolidado (NeuralTec + Liesch)',
};

export const TOLERANCIA_POR_CONTA = 0.01;

export const CONTRATO = [
  {
    id: 1,
    indicador: 'Faturamento',
    definicao: 'Receita reconhecida por fato gerador, nunca por recebimento.',
    formula: 'NF não anulada + fatos externos (contrato_locacao, ordem_servico, contrato_assistencia) sem NF correspondente − devoluções',
    regime: 'competencia',
    perimetro: 'empresa',
    fontes: [
      { entidade: 'NotaFiscal', campoValor: 'valor_total', campoData: 'data_emissao' },
      { entidade: 'IntegracaoFinanceira', campoValor: 'valor', campoData: 'data_referencia',
        filtro: { tipo_registro: ['contrato_locacao', 'ordem_servico', 'contrato_assistencia'] } },
    ],
    exclusoes: ['NF anulada', 'NF espelho de CI', 'IntegracaoFinanceira tipo recebimento_*'],
    deduplicacao: 'ver decisão 8',
    status: 'definido',
  },
  {
    id: 2,
    indicador: 'CMV estimado',
    rotulo: 'Custo de mercadorias — estimativa por compras',
    definicao: 'Proxy: compras de estoque do mês. Não é CMV contábil.',
    formula: 'Σ ItemCompra com tipo_compra = estoque no mês de emissão',
    regime: 'competencia',
    perimetro: 'empresa',
    fontes: [{ entidade: 'ItemCompra', campoValor: 'valor_total', campoData: 'data_emissao' }],
    exclusoes: ['tipo_compra ≠ estoque'],
    acoplamentoBridge: 'Como o operacional já desconta compras do período, o bridge NÃO aplica ajuste de variação de estoque.',
    confianca: 'estimado',
    status: 'provisorio',
  },
  {
    id: 3,
    indicador: 'Custos Fixos',
    definicao: 'Soma dos custos fixos operacionais. Não é ponto de equilíbrio.',
    formula: 'DespesaOperacional recorrente + FolhaPagamento (excl. pró-labore) na competência',
    regime: 'competencia',
    perimetro: 'empresa',
    fontes: [
      { entidade: 'DespesaOperacional', campoValor: 'valor', campoData: 'data', filtro: { recorrente: true } },
      { entidade: 'FolhaPagamento', campoValor: 'salario_liquido', campoData: 'competencia' },
    ],
    exclusoes: ['origem_compra = pro_labore'],
    evolucaoFutura: 'Ponto de Equilíbrio = Custos Fixos ÷ margem de contribuição %, quando a margem for confiável.',
    status: 'definido',
  },
  {
    id: 4,
    indicador: 'Adimplência',
    definicao: 'Percentual de títulos pagos até o vencimento.',
    formula: 'títulos pagos com data_pagamento ≤ data_vencimento ÷ títulos pagos no período',
    regime: 'caixa',
    perimetro: 'empresa',
    fontes: [{ entidade: 'TituloCobranca', campoData: 'data_vencimento' }],
    substitui: 'recebido ÷ emitido (que é cobertura de carteira, não adimplência)',
    status: 'definido',
  },
  {
    id: 5,
    indicador: 'Saldo inicial',
    definicao: 'Posição de abertura verificável por conta.',
    formula: 'saldo_apos do último LancamentoBancario de cada conta antes do 1º dia do mês',
    regime: 'posicao',
    perimetro: 'conta',
    fontes: [{ entidade: 'LancamentoBancario', campoValor: 'saldo_apos', campoData: 'data', agrupador: 'conta_bancaria' }],
    condicao: 'Só é verificável se Σ(movimentos classificados + não classificados) da conta fechar com saldo_final − saldo_inicial.',
    status: 'definido',
  },
  {
    id: 6,
    indicador: 'Saldo atual consolidado',
    definicao: 'Soma do último saldo_apos de cada conta do perímetro. Sem valores estáticos.',
    formula: 'Σ por conta_bancaria do saldo_apos mais recente',
    regime: 'posicao',
    perimetro: 'grupo',
    fontes: [{ entidade: 'LancamentoBancario', campoValor: 'saldo_apos', agrupador: 'conta_bancaria' }],
    decisaoPendente: 'Quais contas compõem cada perímetro (lista de conta_bancaria → empresa; fundos/aplicações entram em caixa e equivalentes?).',
    defaultAplicado: 'Prefixo da conta define a empresa (NeuralTec…, Liesch…); aplicações/resgates ficam em linha própria "Aplicações" do Resultado de Caixa.',
    status: 'pendente_usuario',
  },
  {
    id: 7,
    indicador: 'Transferências internas',
    definicao: 'Neutralizadas apenas no perímetro em que origem e destino coincidem.',
    formula: 'Par débito/crédito em TransferenciaInterna: excluído de entradas/saídas/resultado no perímetro comum; visível na conferência por conta.',
    regime: 'caixa',
    perimetro: 'depende',
    fontes: [{ entidade: 'TransferenciaInterna', campos: ['lancamento_debito_id', 'lancamento_credito_id', 'conta_origem', 'conta_destino'] }],
    regra: 'Nunca "ignorar" globalmente. Transferência sem par identificado permanece como movimento não classificado.',
    status: 'definido',
  },
  {
    id: 8,
    indicador: 'Deduplicação NF × integração × título',
    definicao: 'Mesmo fato gerador em várias fontes conta uma vez.',
    precedencia: ['NotaFiscal', 'IntegracaoFinanceira', 'TituloCobranca'],
    chave: 'registro_externo_id ↔ NotaFiscal.numero; fallback: contraparte normalizada + valor ± 0,01 + data ± 3 dias',
    regime: 'competencia',
    decisaoPendente: 'Confirmar se o número da NF é gravado no registro externo (locações/assistência) ou se o fallback será a regra principal.',
    defaultAplicado: 'Fallback (contraparte + valor ± 0,01 + data ± 3 dias) em uso; registros deduplicados são listados na evidência.',
    status: 'pendente_usuario',
  },
  {
    id: 9,
    indicador: 'Datas de competência',
    definicao: 'Campo que define o mês operacional de cada entidade.',
    mapa: {
      NotaFiscal: 'data_emissao',
      ItemCompra: 'data_emissao',
      Tributo: 'competencia',
      FolhaPagamento: 'competencia',
      DespesaOperacional: 'data',
      ObraReforma: 'data',
      LancamentoCartao: 'data da compra',
      IntegracaoFinanceira: 'data_referencia',
    },
    regime: 'competencia',
    status: 'definido',
  },
  {
    id: 10,
    indicador: 'Cartão: competência × pagamento',
    definicao: 'Compra no cartão entra na operação na data da compra; sai do caixa quando a fatura é paga.',
    formula: 'Operação: LancamentoCartao por data. Caixa: VinculoExtrato entidade_tipo=FaturaCartao por data do LancamentoBancario.',
    bridge: 'Ajuste = compras do mês no cartão − faturas pagas no mês',
    status: 'definido',
  },
  {
    id: 11,
    indicador: 'Pró-labore / retiradas',
    definicao: 'Fora do resultado da operação; entra após o caixa da operação. Convenção gerencial.',
    formula: 'Vínculos e lançamentos com origem_compra = pro_labore ou tipo_compra = pro_labore',
    regime: 'caixa',
    exclusoes: ['Folha de funcionários (permanece operacional)'],
    status: 'definido',
  },
  {
    id: 12,
    indicador: 'Obras: investimento × manutenção',
    definicao: 'Investimento fica fora da operação; manutenção é despesa operacional.',
    formula: 'ObraReforma.natureza = investimento → Investimentos; = manutencao → despesas operacionais',
    fontes: [{ entidade: 'ObraReforma', campoValor: 'valor', campoData: 'data', campoClassificacao: 'natureza' }],
    antiDuplaContagem: 'Se houver lancamento_bancario_id ou lancamento_cartao_id, o caixa usa o vínculo; a obra é fallback apenas em competência.',
    decisaoPendente: 'Default para registros sem natureza preenchida: investimento (recomendado) ou não classificado.',
    defaultAplicado: 'Sem natureza → investimento.',
    status: 'pendente_usuario',
  },
  {
    id: 13,
    indicador: 'Financeiros não operacionais',
    definicao: 'Juros, tarifas, IOF, empréstimos, aportes. Linha própria ±Financeiros no Resultado de Caixa.',
    formula: 'LancamentoBancario com tipo_compra = financeiro, ou MovimentoFinanceiro vinculado',
    regime: 'caixa',
    decisaoPendente: 'Fonte prioritária: categoria do extrato ou MovimentoFinanceiro? Empréstimo recebido entra como entrada financeira (não receita)?',
    defaultAplicado: 'Extrato: vínculo > tipo_compra/origem_compra específicos > categoria. Categoria "financeiro" sem classificação específica = financeiro não operacional (MovimentoFinanceiro está vazio).',
    status: 'pendente_usuario',
  },
  {
    id: 14,
    indicador: 'Movimento não classificado',
    definicao: 'Continua compondo o caixa. Nunca é excluído.',
    formula: 'Movimentação total = classificado + não classificado. Recebimento operacional identificado exige vínculo ou classificação.',
    regime: 'caixa',
    loopR: 'Qualquer valor não classificado impede status Conciliado (permite apenas Fechado).',
    status: 'definido',
  },
  {
    id: 15,
    indicador: 'Precedência entre fontes por regime',
    definicao: 'Mesma obrigação em várias fontes: uma fonte manda por regime.',
    regra: {
      competencia: 'Entidade de controle (Tributo, Folha, Despesa, Obra, ItemCompra, LancamentoCartao)',
      caixa: 'LancamentoBancario via VinculoExtrato; entidade de controle só como fallback quando não houver vínculo',
    },
    status: 'definido',
  },
];

export const INDICADORES_LOOP_R = {
  coberturaClassificacao: 'Σ|valor classificado| ÷ Σ|valor movimentado| (valores absolutos)',
  coberturaConciliacao: 'Σ valor_alocado com vínculo ÷ Σ valor elegível',
  completude: 'fontes carregadas ÷ fontes necessárias (parcial ou indisponível bloqueia verde)',
  diferencaBancaria: 'R$ |saldo calculado − saldo bancário| por conta',
};

export const STATUS_LOOP_R = {
  fechado: 'Identidades aritméticas fecham (residual pode existir).',
  conciliado: 'Residual ≤ tolerância, sem não classificados e todas as fontes completas.',
  divergente: 'Saldo inicial + Resultado de Caixa ≠ saldo bancário final.',
  nao_verificavel: 'Fonte indisponível — não é divergente nem conciliado.',
};

export const pendencias = () => CONTRATO.filter((c) => c.status === 'pendente_usuario');