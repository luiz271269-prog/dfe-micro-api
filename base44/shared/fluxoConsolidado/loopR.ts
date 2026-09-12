// Loop-R: status (fechado | conciliado | divergente | nao_verificavel) + 4 indicadores separados.
import { arred } from './evidencia.ts';

const TOLERANCIA_POR_CONTA = 0.01;

export function avaliarLoopR({ caixa, bridge, posicao, sourceStatus, lancamentosMes }) {
  const abs = (v) => Math.abs(v || 0);
  const movimentadoAbs = lancamentosMes.filter((l) => l.classe !== 'transferencia_neutralizada').reduce((s, l) => s + abs(l.valor), 0);
  const classificadoAbs = lancamentosMes.filter((l) => !['nao_classificado', 'transferencia_neutralizada'].includes(l.classe)).reduce((s, l) => s + abs(l.valor), 0);
  const fontes = Object.entries(sourceStatus);
  const carregadas = fontes.filter(([, s]) => s.status === 'carregada').length;
  const tolerancia = arred(TOLERANCIA_POR_CONTA * Math.max(1, posicao.porConta.length));

  const indicadores = {
    coberturaClassificacao: movimentadoAbs ? arred((classificadoAbs / movimentadoAbs) * 100) : null,
    naoClassificadoValor: caixa.naoClassificado.valor,
    naoClassificadoRegistros: caixa.naoClassificado.registros,
    completudeFontes: `${carregadas}/${fontes.length}`,
    fontesIncompletas: fontes.filter(([, s]) => s.status !== 'carregada').map(([n, s]) => `${n}:${s.status}`),
    diferencaBancaria: posicao.diferencaBancaria,
    residualBridge: bridge.residual,
    tolerancia,
  };

  let status;
  if (!posicao.verificavel || carregadas < fontes.length) status = 'nao_verificavel';
  else if (abs(posicao.diferencaBancaria) > tolerancia) status = 'divergente';
  else if (bridge.fechado && caixa.naoClassificado.registros === 0) status = 'conciliado';
  else status = 'fechado';

  const motivos = [];
  if (!posicao.verificavel) motivos.push('Saldo inicial ou final não verificável em alguma conta.');
  if (carregadas < fontes.length) motivos.push(`Fontes incompletas: ${indicadores.fontesIncompletas.join(', ')}`);
  if (abs(posicao.diferencaBancaria) > tolerancia) motivos.push(`Saldo inicial + resultado de caixa difere do banco em R$ ${posicao.diferencaBancaria}.`);
  if (caixa.naoClassificado.registros) motivos.push(`${caixa.naoClassificado.registros} lançamentos não classificados (R$ ${caixa.naoClassificado.valor}).`);
  if (!bridge.fechado) motivos.push(`Bridge não fecha: residual R$ ${bridge.residual}.`);

  return { status, indicadores, motivos };
}