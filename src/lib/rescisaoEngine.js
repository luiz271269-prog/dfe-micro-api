// Pré-cálculo de verbas rescisórias (CLT):
// - Saldo de salário: dias trabalhados no mês do desligamento
// - Aviso prévio (Lei 12.506): 30 dias + 3 por ano completo, máx. 90 (indenizado; acordo = 50%)
// - Férias vencidas + 1/3: saldo de dias em aberto (devidas em qualquer tipo)
// - Férias proporcionais + 1/3 e 13º proporcional: fração ≥ 15 dias conta como mês
// - Multa FGTS: 40% sem justa causa · 20% acordo · 0% demais

export const TIPOS_RESCISAO = {
  sem_justa_causa: 'Dispensa sem justa causa',
  pedido_demissao: 'Pedido de demissão',
  justa_causa: 'Dispensa por justa causa',
  acordo: 'Acordo (CLT art. 484-A)',
};

export function anosCompletos(dataAdmissao, dataFim) {
  const a = new Date(dataAdmissao + 'T00:00:00');
  const f = new Date(dataFim + 'T00:00:00');
  let anos = f.getFullYear() - a.getFullYear();
  if (f.getMonth() < a.getMonth() || (f.getMonth() === a.getMonth() && f.getDate() < a.getDate())) anos--;
  return Math.max(0, anos);
}

function mesesComFracao(inicioStr, fimStr) {
  const i = new Date(inicioStr + 'T00:00:00');
  const f = new Date(fimStr + 'T00:00:00');
  let meses = (f.getFullYear() - i.getFullYear()) * 12 + (f.getMonth() - i.getMonth());
  const diasFracao = f.getDate() - i.getDate() + 1;
  if (diasFracao >= 15) meses += 1;
  else if (diasFracao < 0 && meses > 0) meses -= 0; // fração negativa já descontada pelo cálculo de meses
  return Math.max(0, Math.min(12, meses));
}

const r2 = (v) => Math.round(v * 100) / 100;

export function mesesCompletos(dataAdmissao, dataFim) {
  if (!dataAdmissao || !dataFim) return 0;
  const a = new Date(dataAdmissao + 'T00:00:00');
  const f = new Date(dataFim + 'T00:00:00');
  let meses = (f.getFullYear() - a.getFullYear()) * 12 + f.getMonth() - a.getMonth();
  if (f.getDate() < a.getDate()) meses--;
  return Math.max(0, meses);
}

export function calcularRescisao({ salarioBase, dataAdmissao, dataDesligamento, tipo, avisoPrevio, saldoFgts, saldoFeriasDias, feriasPendentesDias, feriasDobradasDias }) {
  const salario = salarioBase || 0;
  const diaria = salario / 30;
  const d = new Date(dataDesligamento + 'T00:00:00');

  const saldoSalario = r2(diaria * d.getDate());

  const anos = dataAdmissao ? anosCompletos(dataAdmissao, dataDesligamento) : 0;
  const diasAviso = Math.min(90, 30 + 3 * anos);
  let avisoValor = 0;
  if (avisoPrevio === 'indenizado') {
    if (tipo === 'sem_justa_causa') avisoValor = r2(diaria * diasAviso);
    else if (tipo === 'acordo') avisoValor = r2((diaria * diasAviso) / 2);
  }

  const diasPendentes = feriasPendentesDias ?? saldoFeriasDias ?? 0;
  const diasDobrados = Math.min(diasPendentes, feriasDobradasDias || 0);
  const diasSimples = Math.max(0, diasPendentes - diasDobrados);
  const feriasVencidas = r2((diasSimples + diasDobrados * 2) * diaria * (4 / 3));

  // Férias proporcionais: meses do período aquisitivo em curso
  let feriasProporcionais = 0;
  let mesesFeriasProp = 0;
  if (dataAdmissao && tipo !== 'justa_causa') {
    const inicioAquisitivo = new Date(dataAdmissao + 'T00:00:00');
    inicioAquisitivo.setFullYear(inicioAquisitivo.getFullYear() + anos);
    mesesFeriasProp = mesesComFracao(inicioAquisitivo.toISOString().slice(0, 10), dataDesligamento);
    feriasProporcionais = r2((mesesFeriasProp / 12) * salario * (4 / 3));
  }

  // 13º proporcional: conta apenas os meses trabalhados no ano, com fração >= 15 dias.
  let decimoTerceiro = 0;
  let mesesDecimo = 0;
  if (tipo !== 'justa_causa') {
    const inicioAno = `${d.getFullYear()}-01-01`;
    const inicioDecimo = dataAdmissao && dataAdmissao > inicioAno ? dataAdmissao : inicioAno;
    mesesDecimo = mesesComFracao(inicioDecimo, dataDesligamento);
    decimoTerceiro = r2((mesesDecimo / 12) * salario);
  }

  let multaFgts = 0;
  if (tipo === 'sem_justa_causa') multaFgts = r2((saldoFgts || 0) * 0.4);
  else if (tipo === 'acordo') multaFgts = r2((saldoFgts || 0) * 0.2);

  const totalBruto = r2(saldoSalario + avisoValor + feriasVencidas + feriasProporcionais + decimoTerceiro + multaFgts);

  return { saldoSalario, diasAviso, avisoValor, feriasVencidas, feriasProporcionais, mesesFeriasProp, decimoTerceiro, mesesDecimo, multaFgts, totalBruto, tempoCasaMeses: mesesCompletos(dataAdmissao, dataDesligamento), feriasPendentesDias: diasPendentes, feriasDobradasDias: diasDobrados };
}