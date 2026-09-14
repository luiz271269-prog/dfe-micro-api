// Orquestrador do motor consolidado (Gate 2). Puro: recebe dados, devolve resultados com evidências.
import { normalizarCaixa } from './normalizarCaixa.ts';
import { calcularOperacao } from './operacao.ts';
import { calcularCaixa } from './caixa.ts';
import { construirBridge } from './bridge.ts';
import { calcularPosicao } from './posicao.ts';
import { avaliarLoopR } from './loopR.ts';
import { calcularAberto } from './aberto.ts';
import { diagnosticarCachesConciliacao } from './conciliacaoCache.ts';
import { noMes } from './evidencia.ts';

const mesAnterior = (mes, n) => {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// série mensal compacta (mês atual + n anteriores) — mesma engine, sem evidências
export function calcularHistorico({ dados, mes, perimetro, hoje, meses = 6 }) {
  return Array.from({ length: meses }, (_, i) => mesAnterior(mes, meses - 1 - i)).map((m) => {
    const lanc = normalizarCaixa(dados, perimetro, hoje);
    const op = calcularOperacao(dados, m, perimetro);
    const cx = calcularCaixa(lanc, m);
    const pos = calcularPosicao(dados, m, perimetro, hoje, cx.resultado);
    return { mes: m, faturamento: op.faturamento.valor, resultadoOperacao: op.resultado, resultadoCaixa: cx.resultado, saldoFinal: pos.saldoFinal, custosFixos: op.custosFixos.valor };
  });
}

export function calcularConsolidado({ dados, sourceStatus, mes, perimetro = 'grupo', hoje }) {
  const lancamentos = normalizarCaixa(dados, perimetro, hoje);
  const operacao = calcularOperacao(dados, mes, perimetro);
  const caixa = calcularCaixa(lancamentos, mes);
  const bridge = construirBridge(operacao, caixa);
  const posicao = calcularPosicao(dados, mes, perimetro, hoje, caixa.resultado);
  const lancamentosMes = lancamentos.filter((l) => noMes(l.data, mes));
  const conciliacaoCache = diagnosticarCachesConciliacao(dados.LancamentoBancario, dados.VinculoExtrato);
  const loopR = avaliarLoopR({ caixa, bridge, posicao, sourceStatus, lancamentosMes, operacao, conciliacaoCache });
  const aberto = calcularAberto(dados, mes, perimetro, hoje);

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
    operacao, caixa, bridge, posicao, loopR, aberto, conciliacaoCache, sourceStatus,
  };
}