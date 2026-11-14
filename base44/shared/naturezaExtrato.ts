// Natureza dos lançamentos bancários: sinal do valor + evidência no texto.
// Aplicações, resgates e transferências internas não são receita nem despesa operacional.
// Espelho desta regra no cliente: src/lib/naturezaCreditoExtrato.js

export type NaturezaBancaria =
  | 'receita'
  | 'despesa'
  | 'aplicacao'
  | 'resgate'
  | 'transferencia'
  | 'credito_revisar'
  | 'debito_revisar';

export interface ClassificacaoNatureza {
  natureza: NaturezaBancaria;
  motivo: string;
}

export interface AjusteNatureza extends ClassificacaoNatureza {
  patch: Record<string, string>;
}

const normalizar = (texto: unknown) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const APLICACAO =
  /\bAPLIC(ACAO|ACOES|AR|ADO|ADA)?\b|\bCDB\b|\bRDB\b|\bLCI\b|\bLCA\b|\bTESOURO DIRETO\b|\bPOUPANCA\b|\bCOFRINHO\b/;
const RESGATE = /\bRESG(ATE|AR|ADO|ADA)?\b/;
const TRANSFERENCIA =
  /TRANSF(ERENCIA|ERIR)? ENTRE CONTAS|ENTRE CONTAS (PROPRIAS|DA MESMA)|MESMA TITULARIDADE|TRANSFERENCIA PROPRIA|CONTA PROPRIA/;
const RECEITA =
  /LIQ COBRANCA|COBRANCA SIMPLES|RECEBIMENTO PIX|PIX RECEBIDO|PIX CRED|RECEB COB|BOLETO RECEBIDO|\bTED\b/;
const NAO_RECEITA =
  /DEVOLUC|ESTORNO|LIBERACAO DE CREDITO|EMPRESTIMO|FINANCIAMENTO|APORTE|CAPITAL SOCIAL|TRANSF|MESMA TITULARIDADE|NEURALTEC|LIESCH/;

export const CATEGORIAS_MOVIMENTO = ['aplicacoes', 'resgates', 'transferencia', 'interno'];

const CATEGORIAS_DESPESA = new Set([
  'despesa_operacional', 'outro', 'fornecedor', 'administrativas', 'comerciais', 'tecnologia',
  'transporte', 'seguro', 'combustivel', 'fretes_compras_vendas', 'servicos_diretamente_vinculados',
  'equipamentos', 'moveis', 'infraestrutura', 'obras_reforma', 'tarifas', 'juros', 'tributo',
  'das', 'tributos_vendas', 'tributos_folha', 'salarios_comissoes', 'beneficios',
  'rescisoes_contrato', 'financeiro', 'estoque', 'produtos',
]);

const TIPOS_GASTO = new Set(['despesas', 'estoque', 'impostos', 'folha', 'obras', 'pro_labore', 'fretes']);

const ALVO: Record<string, { categoria: string; origem_compra: string; tipo_compra: string }> = {
  receita: { categoria: 'recebimento', origem_compra: 'empresa', tipo_compra: 'receitas' },
  aplicacao: { categoria: 'aplicacoes', origem_compra: 'empresa', tipo_compra: 'financeiro' },
  resgate: { categoria: 'resgates', origem_compra: 'empresa', tipo_compra: 'financeiro' },
  transferencia: { categoria: 'transferencia', origem_compra: 'empresa', tipo_compra: 'financeiro' },
};

export function classificarNaturezaBancaria(registro: any): ClassificacaoNatureza {
  const valor = Number(registro?.valor || 0);
  const categoria = String(registro?.categoria || '');
  const texto = normalizar(`${registro?.descricao || ''} ${registro?.detalhe || ''}`);

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
    if (valor < 0 && temAplicacao) {
      return { natureza: 'aplicacao', motivo: 'Débito com termo de aplicação financeira' };
    }
    if (valor > 0 && temResgate) {
      return { natureza: 'resgate', motivo: 'Crédito com termo de resgate de aplicação' };
    }
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
  if (valor < 0) {
    return { natureza: 'despesa', motivo: 'Débito sem evidência de aplicação ou transferência' };
  }
  return { natureza: 'debito_revisar', motivo: 'Valor zerado' };
}

function montarPatch(registro: any, alvo: { categoria: string; origem_compra: string; tipo_compra: string }) {
  const patch: Record<string, string> = {};
  if (String(registro?.categoria || '') !== alvo.categoria) patch.categoria = alvo.categoria;
  if (!registro?.origem_compra || registro.origem_compra === 'pessoal') patch.origem_compra = alvo.origem_compra;
  if (patch.categoria || String(registro?.tipo_compra || '') !== alvo.tipo_compra) patch.tipo_compra = alvo.tipo_compra;
  return patch;
}

// Ajuste aplicado na importação: preenche o vazio e corrige apenas classificações
// claramente incompatíveis com a evidência de movimentação financeira.
export function ajustarNaturezaImportacao(registro: any): AjusteNatureza {
  const resultado = classificarNaturezaBancaria(registro);
  const alvo = ALVO[resultado.natureza];
  if (!alvo) return { ...resultado, patch: {} };

  const atual = String(registro?.categoria || '');
  const tipoAtual = String(registro?.tipo_compra || '');
  const vazio = !atual;
  const correto = atual === alvo.categoria;
  const incompativel =
    resultado.natureza === 'receita'
      ? CATEGORIAS_DESPESA.has(atual)
      : resultado.natureza === 'transferencia'
        ? !CATEGORIAS_MOVIMENTO.includes(atual) && atual !== 'pro_labore' && atual !== 'saque' &&
          (CATEGORIAS_DESPESA.has(atual) || atual === 'recebimento' || (TIPOS_GASTO.has(tipoAtual) && tipoAtual !== 'pro_labore'))
        : !CATEGORIAS_MOVIMENTO.includes(atual);

  if (!vazio && !correto && !incompativel) return { ...resultado, patch: {} };
  return { ...resultado, patch: montarPatch(registro, alvo) };
}