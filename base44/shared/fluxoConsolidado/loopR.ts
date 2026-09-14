// Loop-R: escada de certificação nao_verificavel → divergente → em_conciliacao → conciliado.
// "fechado" nunca é derivado automaticamente: só um FechamentoFinanceiro (Fase 5) pode certificar.
import { arred } from './evidencia.ts';

const TOLERANCIA_POR_CONTA = 0.01;

export function avaliarLoopR({ caixa, bridge, posicao, sourceStatus, lancamentosMes, operacao }) {
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
    semSaldoExtrato: {
      registros: posicao.porConta.reduce((s, c) => s + c.semSaldoExtrato.registros, 0),
      valor: arred(posicao.porConta.reduce((s, c) => s + c.semSaldoExtrato.valor, 0)),
    },
    contasNaoVerificaveis: posicao.porConta.filter((c) => !c.verificavel).map((c) => c.conta),
    lacunasExtrato: posicao.porConta.flatMap((c) => (c.lacunasExtrato || []).map((g) => ({ conta: c.conta, ...g }))),
    foraDaCadeia: {
      registros: posicao.porConta.reduce((s, c) => s + (c.foraDaCadeia?.registros || 0), 0),
      valor: arred(posicao.porConta.reduce((s, c) => s + (c.foraDaCadeia?.valor || 0), 0)),
    },
    pendenteEmpresa: operacao?.pendenteEmpresa || { registros: 0, valor: 0 },
  };

  const pendencias = caixa.naoClassificado.registros > 0 || !bridge.fechado || indicadores.pendenteEmpresa.registros > 0;
  let status;
  if (!posicao.verificavel || carregadas < fontes.length) status = 'nao_verificavel';
  else if (abs(posicao.diferencaBancaria) > tolerancia) status = 'divergente';
  else if (pendencias) status = 'em_conciliacao';
  else status = 'conciliado';

  const motivos = [];
  if (indicadores.pendenteEmpresa.registros) motivos.push(`${indicadores.pendenteEmpresa.registros} registros sem empresa definida (R$ ${indicadores.pendenteEmpresa.valor}) — não certificáveis por perímetro.`);
  if (!posicao.verificavel) motivos.push(`Saldo inicial ou final não verificável: ${indicadores.contasNaoVerificaveis.join(', ') || 'nenhuma conta com saldo'}.`);
  if (indicadores.semSaldoExtrato.registros) motivos.push(`${indicadores.semSaldoExtrato.registros} lançamentos sem saldo de extrato (R$ ${indicadores.semSaldoExtrato.valor}) — possível duplicidade com o extrato importado.`);
  if (indicadores.foraDaCadeia.registros) motivos.push(`${indicadores.foraDaCadeia.registros} lançamentos do extrato fora da cadeia de saldos (R$ ${indicadores.foraDaCadeia.valor}) — débitos agendados importados em duplicidade.`);
  for (const g of indicadores.lacunasExtrato) motivos.push(`Extrato ${g.conta} incompleto entre ${g.de} e ${g.ate}: falta importar R$ ${g.valor}.`);
  if (carregadas < fontes.length) motivos.push(`Fontes incompletas: ${indicadores.fontesIncompletas.join(', ')}`);
  if (abs(posicao.diferencaBancaria) > tolerancia) motivos.push(`Saldo inicial + resultado de caixa difere do banco em R$ ${posicao.diferencaBancaria}.`);
  if (caixa.naoClassificado.registros) motivos.push(`${caixa.naoClassificado.registros} lançamentos não classificados (R$ ${caixa.naoClassificado.valor}).`);
  if (!bridge.fechado) motivos.push(`Bridge não fecha: residual R$ ${bridge.residual}.`);

  return { status, indicadores, motivos };
}