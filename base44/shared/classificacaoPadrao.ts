// Vocabulário unificado no backend: eixos "quem comprou" (origem_compra) e "tipo de compra" (tipo_compra).

export const TIPO_POR_ENTIDADE = {
  Tributo: 'impostos',
  FolhaPagamento: 'folha',
  FaturaCartao: 'financeiro',
  ItemCompra: 'estoque',
  DespesaOperacional: 'despesas',
  ObraReforma: 'obras',
  TituloCobranca: 'financeiro',
  NotaFiscal: 'financeiro',
  MovimentoFinanceiro: 'financeiro',
  TransferenciaInterna: 'financeiro',
};

// Categoria do extrato bancário -> eixos unificados
export const CLASSIFICACAO_POR_CATEGORIA = {
  recebimento: { origem_compra: 'empresa', tipo_compra: 'financeiro' },
  fornecedor: { origem_compra: 'empresa', tipo_compra: 'estoque' },
  pessoal: { origem_compra: 'empresa', tipo_compra: 'folha' },
  pro_labore: { origem_compra: 'pro_labore', tipo_compra: 'pro_labore' },
  tributo: { origem_compra: 'empresa', tipo_compra: 'impostos' },
  despesa_operacional: { origem_compra: 'empresa', tipo_compra: 'despesas' },
  financeiro: { origem_compra: 'empresa', tipo_compra: 'financeiro' },
  saque: { origem_compra: 'empresa', tipo_compra: 'outro' },
  obras_reforma: { origem_compra: 'empresa', tipo_compra: 'obras' },
  transferencia: { origem_compra: 'empresa', tipo_compra: 'financeiro' },
  interno: { origem_compra: 'empresa', tipo_compra: 'financeiro' },
};

// Eixos de um lançamento bancário, completando o que faltar pela categoria.
export function eixosDoLancamento(lanc) {
  const padrao = CLASSIFICACAO_POR_CATEGORIA[lanc?.categoria] || { origem_compra: 'empresa', tipo_compra: 'outro' };
  return {
    origem_compra: lanc?.origem_compra || padrao.origem_compra,
    tipo_compra: lanc?.tipo_compra || padrao.tipo_compra,
  };
}

// Eixos de um vínculo: herda da origem, cai no padrão do tipo de entidade, depois no lançamento.
export function eixosDoVinculo(origem, entidadeTipo, lanc) {
  const doLanc = eixosDoLancamento(lanc);
  return {
    origem_compra: origem?.origem_compra || doLanc.origem_compra,
    tipo_compra: origem?.tipo_compra || TIPO_POR_ENTIDADE[entidadeTipo] || doLanc.tipo_compra,
  };
}