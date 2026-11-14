// Natureza dos lançamentos do extrato: sinal do valor + evidência no texto.
// Aplicações, resgates e transferências internas não são receita nem despesa operacional.
// Espelho de base44/shared/naturezaExtrato.ts

const normalizar = (texto) => (texto || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z]+/g, ' ').replace(/\s+/g, ' ').trim();

const APLICACAO = /\bAPLIC(ACAO|ACOES|AR|ADO|ADA)?\b|\bCDB\b|\bRDB\b|\bLCI\b|\bLCA\b|\bTESOURO DIRETO\b|\bPOUPANCA\b|\bCOFRINHO\b/;
const RESGATE = /\bRESG(ATE|AR|ADO|ADA)?\b/;
const TRANSFERENCIA = /TRANSF(ERENCIA|ERIR)? ENTRE CONTAS|ENTRE CONTAS (PROPRIAS|DA MESMA)|MESMA TITULARIDADE|TRANSFERENCIA PROPRIA|CONTA PROPRIA/;
const RECEITA = /LIQ COBRANCA|COBRANCA SIMPLES|RECEBIMENTO PIX|PIX RECEBIDO|PIX CRED|RECEB COB|BOLETO RECEBIDO|\bTED\b/;
const NAO_RECEITA = /DEVOLUC|ESTORNO|LIBERACAO DE CREDITO|EMPRESTIMO|FINANCIAMENTO|APORTE|CAPITAL SOCIAL|TRANSF|MESMA TITULARIDADE|NEURALTEC|LIESCH/;

export const CATEGORIAS_MOVIMENTO_FINANCEIRO = ['aplicacoes', 'resgates', 'transferencia', 'interno'];

const CATEGORIAS_DESPESA = [
  'despesa_operacional', 'outro', 'fornecedor', 'administrativas', 'comerciais', 'tecnologia',
  'transporte', 'seguro', 'combustivel', 'fretes_compras_vendas', 'servicos_diretamente_vinculados',
  'equipamentos', 'moveis', 'infraestrutura', 'obras_reforma', 'tarifas', 'juros', 'tributo',
  'das', 'tributos_vendas', 'tributos_folha', 'salarios_comissoes', 'beneficios',
  'rescisoes_contrato', 'financeiro', 'estoque', 'produtos',
];

const TIPOS_GASTO = ['despesas', 'estoque', 'impostos', 'folha', 'obras', 'pro_labore', 'fretes'];

const ALVO = {
  receita: { categoria: 'recebimento', origem_compra: 'empresa', tipo_compra: 'receitas' },
  aplicacao: { categoria: 'aplicacoes', origem_compra: 'empresa', tipo_compra: 'financeiro' },
  resgate: { categoria: 'resgates', origem_compra: 'empresa', tipo_compra: 'financeiro' },
  transferencia: { categoria: 'transferencia', origem_compra: 'empresa', tipo_compra: 'financeiro' },
};

export function classificarNaturezaBancaria(lancamento) {
  const valor = Number(lancamento?.valor || 0);
  const categoria = String(lancamento?.categoria || '');
  const texto = normalizar(`${lancamento?.descricao || ''} ${lancamento?.detalhe || ''}`);

  if (categoria === 'transferencia' || categoria === 'interno') {
    return { natureza: 'transferencia', motivo: 'Categoria de movimentação interna preservada' };
  }
  if (categoria === 'aplicacoes') return { natureza: 'aplicacao', motivo: 'Categoria 8.02 Aplicações preservada' };
  if (categoria === 'resgates') return { natureza: 'resgate', motivo: 'Categoria 8.03 Resgates preservada' };
  if (TRANSFERENCIA.test(texto)) {
    return { natureza: 'transferencia', motivo: 'Descrição indica transferência entre contas próprias' };
  }

  const temAplicacao = APLICACAO.test(texto);
  const temResgate = RESGATE.test(texto);
  if (temAplicacao || temResgate) {
    if (valor < 0 && temAplicacao) return { natureza: 'aplicacao', motivo: 'Débito com termo de aplicação financeira' };
    if (valor > 0 && temResgate) return { natureza: 'resgate', motivo: 'Crédito com termo de resgate de aplicação' };
    return {
      natureza: valor < 0 ? 'debito_revisar' : 'credito_revisar',
      motivo: 'Termo de aplicação/resgate não confere com o sinal do valor',
    };
  }

  if (valor > 0) {
    if (RECEITA.test(texto) && !NAO_RECEITA.test(texto)) {
      return { natureza: 'receita', motivo: 'Crédito com evidência de recebimento' };
    }
    return { natureza: 'credito_revisar', motivo: 'Crédito sem evidência de recebimento' };
  }
  if (valor < 0) return { natureza: 'despesa', motivo: 'Débito sem evidência de aplicação ou transferência' };
  return { natureza: 'debito_revisar', motivo: 'Valor zerado' };
}

export function naturezaMovimento(lancamento) {
  return classificarNaturezaBancaria(lancamento).natureza;
}

// Natureza da movimentação financeira (aplicação, resgate, transferência) sem confundir com despesa/receita.
export const rotuloNatureza = {
  aplicacao: 'Aplicação financeira',
  resgate: 'Resgate de aplicação',
  transferencia: 'Transferência interna',
  receita: 'Receita',
  despesa: 'Despesa',
};

// Sugestão de correção: só propõe troca quando a classificação atual está vazia
// ou claramente incompatível com a evidência do texto e do sinal.
export function sugestaoCorrecao(lancamento, rotuloCategoria = {}) {
  const { natureza, motivo } = classificarNaturezaBancaria(lancamento);
  const alvo = ALVO[natureza];
  if (!alvo) return null;

  const atual = lancamento.categoria || '';
  const correto = atual === alvo.categoria;
  if (correto) {
    const falta = !lancamento.origem_compra || (lancamento.tipo_compra || '') !== alvo.tipo_compra;
    return falta ? { natureza, motivo, categoria: atual, origem_compra: lancamento.origem_compra || alvo.origem_compra, tipo_compra: alvo.tipo_compra } : null;
  }

  const vazio = !atual;
  let substituivel = vazio;
  if (natureza === 'receita') {
    substituivel = substituivel || CATEGORIAS_DESPESA.includes(atual) || lancamento.tipo_compra === 'despesas' || /^3\./.test(rotuloCategoria[atual] || '');
  } else if (natureza === 'transferencia') {
    substituivel = substituivel || (!CATEGORIAS_MOVIMENTO_FINANCEIRO.includes(atual) && atual !== 'pro_labore' && atual !== 'saque' && (CATEGORIAS_DESPESA.includes(atual) || atual === 'recebimento' || (TIPOS_GASTO.includes(lancamento.tipo_compra) && lancamento.tipo_compra !== 'pro_labore')));
  } else {
    substituivel = substituivel || !CATEGORIAS_MOVIMENTO_FINANCEIRO.includes(atual);
  }
  if (!substituivel) return null;
  return { natureza, motivo, ...alvo };
}

// Crédito ainda classificado como despesa, sem evidência suficiente para corrigir sozinho.
export function creditoEmDespesaSemEvidencia(lancamento, rotuloCategoria = {}) {
  if ((lancamento?.valor || 0) <= 0) return false;
  if (classificarNaturezaBancaria(lancamento).natureza !== 'credito_revisar') return false;
  return CATEGORIAS_DESPESA.includes(lancamento.categoria) || lancamento.tipo_compra === 'despesas' || /^3\./.test(rotuloCategoria[lancamento.categoria] || '');
}