// Orquestrador do motor consolidado (Gate 2). Puro: recebe dados, devolve resultados com evidências.
import { normalizarCaixa } from './normalizarCaixa.ts';
import { calcularOperacao } from './operacao.ts';
import { calcularCaixa } from './caixa.ts';
import { construirBridge } from './bridge.ts';
import { calcularPosicao } from './posicao.ts';
import { avaliarLoopR } from './loopR.ts';
import { noMes } from './evidencia.ts';

export function calcularConsolidado({ dados, sourceStatus, mes, perimetro = 'grupo', hoje }) {
  const lancamentos = normalizarCaixa(dados, perimetro, hoje);
  const operacao = calcularOperacao(dados, mes, perimetro);
  const caixa = calcularCaixa(lancamentos, mes);
  const bridge = construirBridge(operacao, caixa);
  const posicao = calcularPosicao(dados, mes, perimetro, hoje, caixa.resultado);
  const lancamentosMes = lancamentos.filter((l) => noMes(l.data, mes));
  const loopR = avaliarLoopR({ caixa, bridge, posicao, sourceStatus, lancamentosMes });

  return {
    mes, perimetro, hoje,
    executivo: {
      saldoAtual: posicao.saldoFinal,
      faturamento: operacao.faturamento.valor,
      resultadoOperacao: operacao.resultado,
      margemOperacional: operacao.margemOperacional,
      caixaOperacao: caixa.caixaOperacao,
      resultadoCaixa: caixa.resultado,
      diferencaOperacaoCaixa: Math.round((caixa.resultado - operacao.resultado) * 100) / 100,
      custosFixos: operacao.custosFixos.valor,
    },
    operacao, caixa, bridge, posicao, loopR, sourceStatus,
  };
}