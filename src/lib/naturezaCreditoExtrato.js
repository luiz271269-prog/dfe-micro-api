// Regras de natureza dos movimentos do extrato: receitas x aplicações/resgates.
// Só sugere quando a descrição traz evidência; o sinal do valor sozinho não basta.

const norm = (t) => (t || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export const CATEGORIAS_MOVIMENTO_FINANCEIRO = ['aplicacoes', 'resgates', 'transferencia', 'interno'];

const RESGATE = /\bRESG(ATE)?\b|RESG\./;
const APLICACAO = /\bAPLIC(ACAO)?\b|APLIC\./;
const NAO_RECEITA = /DEVOLUC|ESTORNO|LIBERACAO CREDITO|EMPRESTIMO|FINANCIAMENTO|NEURALTEC|LIESCH|MESMA TITULARIDADE|TRANSF.*PROPRIA/;
const RECEITA = /LIQ\.?\s*COBRANCA|RECEBIMENTO PIX|PIX RECEBIDO|PIX_CRED|RECEB\.?\s*COB|COBRANCA SIMPLES|COBRANCAS LOTE|\bTED\b/;

export function naturezaMovimento(l) {
  const texto = norm(`${l?.descricao || ''} ${l?.detalhe || ''}`);
  if (RESGATE.test(texto)) return 'resgate';
  if (APLICACAO.test(texto)) return 'aplicacao';
  if ((l?.valor || 0) > 0 && !NAO_RECEITA.test(texto) && RECEITA.test(texto)) return 'receita';
  return null;
}

const ALVO = {
  receita: { categoria: 'recebimento', origem_compra: 'empresa', tipo_compra: 'receitas', motivo: 'Crédito com evidência de recebimento na descrição' },
  aplicacao: { categoria: 'aplicacoes', origem_compra: 'empresa', tipo_compra: 'financeiro', motivo: 'Descrição indica aplicação financeira' },
  resgate: { categoria: 'resgates', origem_compra: 'empresa', tipo_compra: 'financeiro', motivo: 'Descrição indica resgate de aplicação' },
};

// Sugestão de correção. Receitas só substituem classificações de despesa (grupo 3) ou vazias,
// preservando classificações manuais em outras contas.
export function sugestaoCorrecao(l, rotuloCategoria = {}) {
  const nat = naturezaMovimento(l);
  if (!nat) return null;
  const alvo = ALVO[nat];
  if (l.categoria === alvo.categoria && l.tipo_compra === alvo.tipo_compra) return null;
  if (nat === 'receita') {
    const rot = rotuloCategoria[l.categoria] || '';
    const emDespesa = !l.categoria || l.tipo_compra === 'despesas' || /^3\./.test(rot);
    if (!emDespesa) return null;
  }
  return { natureza: nat, ...alvo };
}

// Crédito ainda classificado como despesa, sem evidência suficiente para corrigir sozinho.
export function creditoEmDespesaSemEvidencia(l, rotuloCategoria = {}) {
  if ((l?.valor || 0) <= 0 || naturezaMovimento(l)) return false;
  return l.tipo_compra === 'despesas' || /^3\./.test(rotuloCategoria[l.categoria] || '');
}