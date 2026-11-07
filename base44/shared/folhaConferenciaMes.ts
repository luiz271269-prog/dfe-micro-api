import { periodoPagamentoFolha } from './folhaCalendario.ts';
import { composicaoFolha, avaliarVinculo, resumoEvidencias, mesSeguinte } from './folhaConferencia.ts';

// Monta a conferência de uma competência a partir de dados já carregados. Somente leitura.
export function montarCompetencia(competencia, folhasMes, ctx) {
  const { vinculosPorFolha, orfaosBrutos, lancs, alocado, vistos } = ctx;
  const janela = periodoPagamentoFolha(competencia);
  const inicioRecorte = `${competencia}-01`, fimRecorte = `${mesSeguinte(competencia)}-31`;
  const totais = { liquido: 0, calculado: 0, pagamento_banco: 0, adiantamento: 0, informado: 0, manuais: 0, saldo_por_banco: 0 };
  const porTipo = {}, porCategoria = {}, porForma = {};
  const linhas = [...folhasMes].sort((x, y) => String(x.funcionario_nome).localeCompare(String(y.funcionario_nome))).map(f => {
    const comp = composicaoFolha(f);
    const vincs = (vinculosPorFolha.get(f.id) || []).map(v => avaliarVinculo(v, f, lancs.get(v.lancamento_bancario_id), alocado.get(v.lancamento_bancario_id) || 0, vistos.get(`${v.entidade_id}:${v.lancamento_bancario_id}`) > 1));
    const ev = resumoEvidencias(f, vincs);
    const alertas = [...comp.alertas];
    if (ev.pagamento_banco + ev.por_categoria.adiantamento > comp.proventos + 1) alertas.push('vinculos_excedem_proventos');
    if (f.status === 'pago' && !vincs.length) alertas.push('pago_sem_vinculo_bancario');
    if (vincs.length && (ev.informado || ev.manuais) && ev.informado !== ev.pagamento_banco) alertas.push('evidencias_concorrentes');
    const saldo = Math.max(0, comp.armazenado - ev.pagamento_banco);
    totais.liquido += comp.armazenado; totais.calculado += comp.calculado; totais.pagamento_banco += ev.pagamento_banco;
    totais.adiantamento += ev.por_categoria.adiantamento; totais.informado += ev.informado; totais.manuais += ev.manuais; totais.saldo_por_banco += saldo;
    const tipo = f.tipo || 'mensal';
    porTipo[tipo] = porTipo[tipo] || { count: 0, liquido: 0, pagamento_banco: 0 };
    porTipo[tipo].count++; porTipo[tipo].liquido += comp.armazenado; porTipo[tipo].pagamento_banco += ev.pagamento_banco;
    const forma = f.forma_pagamento || 'nao_informada';
    porForma[forma] = porForma[forma] || { count: 0, liquido: 0 };
    porForma[forma].count++; porForma[forma].liquido += comp.armazenado;
    for (const v of vincs) { porCategoria[v.categoria] = porCategoria[v.categoria] || { count: 0, valor: 0 }; porCategoria[v.categoria].count++; porCategoria[v.categoria].valor += v.valor; }
    return {
      id: f.id, funcionario_nome: f.funcionario_nome, empresa: f.empresa, tipo, status: f.status, forma_pagamento: f.forma_pagamento || null,
      data_pagamento: f.data_pagamento || null, composicao: comp, evidencias: ev, saldo_por_banco: saldo, alertas,
      vinculos: vincs, anomalias: alertas.length + vincs.reduce((s, v) => s + v.alertas.length, 0),
    };
  });
  const orfaos = orfaosBrutos.map(v => avaliarVinculo(v, null, lancs.get(v.lancamento_bancario_id), alocado.get(v.lancamento_bancario_id) || 0, false))
    .filter(v => v.data && v.data >= inicioRecorte && v.data <= fimRecorte)
    .map(v => ({ ...v, entidade_id: orfaosBrutos.find(o => o.id === v.id)?.entidade_id, alertas: ['folha_inexistente', ...v.alertas] }));
  const foraJanela = [];
  for (const l of linhas) for (const v of l.vinculos) if (v.fora_janela) foraJanela.push({ ...v, folha_id: l.id, funcionario_nome: l.funcionario_nome, empresa: l.empresa });
  return {
    competencia, janela, totais, por_tipo: porTipo, por_categoria: porCategoria, por_forma: porForma,
    folhas: linhas, orfaos, fora_janela: foraJanela, total_anomalias: linhas.reduce((s, l) => s + l.anomalias, 0) + orfaos.length,
  };
}

// Resumo compacto de um mês para a visão anual.
export function resumirCompetencia(m) {
  const vinculos = m.folhas.reduce((s, f) => s + f.vinculos.length, 0);
  const natureza = { possivel_comissao: 0, comissao_informada: 0, adiantamento: 0, nao_classificado: 0 };
  const naturezaValor = { ...natureza };
  for (const v of m.fora_janela) { natureza[v.fora_janela.natureza]++; naturezaValor[v.fora_janela.natureza] += v.valor; }
  const situacao = !m.folhas.length ? 'sem_folha' : !vinculos ? 'sem_vinculo' : m.total_anomalias ? 'com_divergencia' : 'conferido';
  return {
    competencia: m.competencia, situacao, folhas: m.folhas.length, vinculos, orfaos: m.orfaos.length,
    liquido: m.totais.liquido, pagamento_banco: m.totais.pagamento_banco, adiantamento: m.totais.adiantamento,
    saldo_por_banco: m.totais.saldo_por_banco, divergencias: m.total_anomalias,
    fora_janela: m.fora_janela.length, fora_janela_natureza: natureza, fora_janela_valor: naturezaValor,
  };
}