import { itemTitulo, norm } from './evidenciaFinanceira.ts';
import { direcaoBanco } from './direcaoFinanceira.ts';

export const centavos = v => Math.round(Number(v || 0) * 100);
export const saldoTitulo = t => (centavos(t.valor_titulo) - centavos(t.valor_pago)) / 100;
export const saldoCredito = c => (centavos(c.valor) - centavos(c.valor_conciliado)) / 100;
export const dias = (a, b) => a && b ? Math.abs((Date.parse(a) - Date.parse(b)) / 86400000) : Infinity;
export const janelaParcela = 7;
export const padraoCobranca = 'LIQ[.]?\\s*COBRAN';
export const padraoPix = '\\bPIX\\b';
const lote = new RegExp(padraoCobranca, 'i'), pix = new RegExp(padraoPix, 'i');
export const ehLote = c => lote.test(c.descricao || '');
export const ehPix = c => pix.test(c.descricao || '');
const contaSicredi = c => /sicredi/i.test(c.conta_bancaria || '') || /(?:^|\D)36092\s*-?\s*2(?:\D|$)/.test(c.conta_bancaria || '');
export const origemCredito = c => ehLote(c) ? (contaSicredi(c) ? 'sicredi' : null) : ehPix(c) ? 'pix' : null;
export const creditoLivre = c => direcaoBanco(c) === 'entrada' && !c.alerta_duplicidade && !c.duplicidade_ref && c.status_conciliacao !== 'conciliado' && saldoCredito(c) > 0;
export const nomeNoExtrato = (cliente, descricao) => {
  const palavras = s => String(s || '').split(/[^\p{L}\p{N}]+/u).map(norm).filter(p => /^[A-Z]{4,}$/.test(p) && !['LTDA','COMERCIO','INDUSTRIA','EMPRESA','RECEBIMENTO','PAGAMENTO'].includes(p));
  const extrato = new Set(palavras(descricao));
  return palavras(cliente).some(p => extrato.has(p));
};

// Um lote pode agregar vários boletos. Não atribuímos seu saldo a uma parcela
// quando um pagamento do relatório ainda pode explicar parte do crédito.
export function sobrepoeRelatorio(c, ev) {
  if (!ev.data || c.data < ev.data || dias(c.data, ev.data) > 3 || centavos(ev.valor) > centavos(saldoCredito(c))) return false;
  if (origemCredito(c) === 'sicredi') return true;
  return centavos(ev.valor) === centavos(saldoCredito(c)) && nomeNoExtrato(ev.contraparte, c.descricao);
}

export function sugerirParcelasExtrato(c, titulos) {
  const origem = origemCredito(c), saldo = centavos(saldoCredito(c));
  if (!origem || !creditoLivre(c)) return [];
  return titulos.filter(t => ['em_aberto', 'vencido'].includes(t.status)
      && (origem !== 'sicredi' || t.canal_cobranca?.toLowerCase() === 'sicredi') && centavos(saldoTitulo(t)) === saldo)
    .map(t => ({ ...itemTitulo(t), saldo: saldoTitulo(t), diff_dias: dias(t.data_vencimento, c.data), nome_compativel: nomeNoExtrato(t.cliente, c.descricao) }))
    .filter(t => t.diff_dias <= janelaParcela)
    .sort((a, b) => a.diff_dias - b.diff_dias || Number(b.nome_compativel) - Number(a.nome_compativel) || a.id.localeCompare(b.id));
}