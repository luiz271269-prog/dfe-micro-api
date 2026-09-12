// Bridge Operação → Caixa. Cada ajuste é a diferença competência × caixa da mesma natureza.
// Fechar aritmeticamente ≠ conciliado: o status vem do loopR.ts.
import { arred } from './evidencia.ts';

export function construirBridge(operacao, caixa) {
  const ajustes = [
    { chave: 'receita', rotulo: 'Faturado × recebido', valor: arred(caixa.recebimentos.valor - operacao.faturamento.valor), competencia: operacao.faturamento.valor, caixa: caixa.recebimentos.valor },
    { chave: 'compras', rotulo: 'Compras (estimativa) × compras e faturas pagas', valor: arred(operacao.cmvEstimado.valor + caixa.pagamentos.compras.valor + caixa.pagamentos.cartao.valor), competencia: -operacao.cmvEstimado.valor, caixa: arred(caixa.pagamentos.compras.valor + caixa.pagamentos.cartao.valor), observacao: 'Sem ajuste de estoque: o operacional já usa compras (decisão 2).' },
    { chave: 'tributos', rotulo: 'Tributos competência × pagos', valor: arred(operacao.tributos.valor + caixa.pagamentos.tributos.valor), competencia: -operacao.tributos.valor, caixa: caixa.pagamentos.tributos.valor },
    { chave: 'folha', rotulo: 'Folha competência × paga', valor: arred(operacao.folha.valor + caixa.pagamentos.folha.valor), competencia: -operacao.folha.valor, caixa: caixa.pagamentos.folha.valor },
    { chave: 'despesas', rotulo: 'Despesas reconhecidas × pagas', valor: arred(operacao.despesas.valor + caixa.pagamentos.despesas.valor), competencia: -operacao.despesas.valor, caixa: caixa.pagamentos.despesas.valor },
    { chave: 'retiradas', rotulo: 'Pró-labore e retiradas', valor: arred(caixa.retiradas.proLabore.valor + caixa.retiradas.pessoal.valor), competencia: 0, caixa: arred(caixa.retiradas.proLabore.valor + caixa.retiradas.pessoal.valor) },
    { chave: 'investimentos', rotulo: 'Obras / investimentos', valor: caixa.investimentos.valor, competencia: 0, caixa: caixa.investimentos.valor },
    { chave: 'financeiros', rotulo: 'Financeiros não operacionais', valor: caixa.financeiros.valor, competencia: 0, caixa: caixa.financeiros.valor },
    { chave: 'transferencias', rotulo: 'Transferências fora do perímetro', valor: caixa.transferenciasForaPerimetro.valor, competencia: 0, caixa: caixa.transferenciasForaPerimetro.valor },
    { chave: 'nao_classificado', rotulo: 'Diferença não classificada — requer Loop-R', valor: caixa.naoClassificado.valor, competencia: 0, caixa: caixa.naoClassificado.valor, requerLoopR: true },
  ];
  const somaAjustes = arred(ajustes.reduce((s, a) => s + a.valor, 0));
  const residual = arred(caixa.resultado - (operacao.resultado + somaAjustes));
  return { de: operacao.resultado, ajustes, somaAjustes, para: caixa.resultado, residual, fechado: Math.abs(residual) < 0.01 };
}