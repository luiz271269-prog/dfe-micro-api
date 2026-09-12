// Regime de caixa — Caixa da Operação e Resultado de Caixa (decisões 11, 13, 14).
import { linha, noMes, arred } from './evidencia.ts';

const soma = (itens) => arred(itens.reduce((s, i) => s + (i.valor || 0), 0));

export function calcularCaixa(lancamentos, mes) {
  const doMes = lancamentos.filter((l) => noMes(l.data, mes));
  const por = (classe, sub) => doMes.filter((l) => l.classe === classe && (!sub || l.sub === sub));
  const L = (itens, rotulo) => linha(itens, (l) => l.valor, { entidade: 'LancamentoBancario', regime: 'caixa', rotulo });

  const recebimentos = L(por('recebimento'), 'Recebimentos operacionais');
  const pagamentos = {
    compras: L(por('pagamento_operacional', 'compras'), 'Compras pagas'),
    cartao: L(por('pagamento_operacional', 'cartao'), 'Faturas de cartão pagas'),
    tributos: L(por('pagamento_operacional', 'tributos'), 'Impostos pagos'),
    folha: L(por('pagamento_operacional', 'folha'), 'Folha paga'),
    despesas: L(por('pagamento_operacional', 'despesas'), 'Despesas pagas'),
  };
  const totalPagamentos = soma(Object.values(pagamentos));
  const caixaOperacao = arred(recebimentos.valor + totalPagamentos); // pagamentos são negativos

  const retiradas = {
    proLabore: L(por('retirada', 'pro_labore'), 'Pró-labore'),
    pessoal: L(por('retirada', 'pessoal'), 'Retiradas pessoais'),
  };
  const investimentos = L(por('investimento'), 'Obras / investimentos');
  const financeiros = L(por('financeiro'), 'Financeiros (tarifas, juros, empréstimos, estornos)');
  const aplicacoes = L(por('aplicacao'), 'Aplicações / resgates (caixa e equivalentes — decisão 6)');
  const transferenciasForaPerimetro = L(por('transferencia'), 'Transferências não neutralizadas');
  const transferenciasNeutralizadas = L(por('transferencia_neutralizada'), 'Transferências internas neutralizadas');
  const naoClassificado = L(por('nao_classificado'), 'Movimento não classificado — requer Loop-R');

  const resultado = arred(
    caixaOperacao + soma(Object.values(retiradas)) + investimentos.valor + financeiros.valor + aplicacoes.valor
    + transferenciasForaPerimetro.valor + naoClassificado.valor,
  );
  const movimentoTotal = soma(doMes.filter((l) => l.classe !== 'transferencia_neutralizada'));

  return {
    recebimentos, pagamentos, totalPagamentos, caixaOperacao, retiradas, investimentos, financeiros, aplicacoes,
    transferenciasForaPerimetro, transferenciasNeutralizadas, naoClassificado, resultado, movimentoTotal,
    lancamentosMes: doMes.length,
  };
}