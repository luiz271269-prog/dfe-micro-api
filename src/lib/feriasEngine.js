// Motor de cálculo de férias (regras CLT):
// - Período aquisitivo: cada 12 meses a partir da admissão.
// - Período concessivo: 12 meses após o fim do aquisitivo. Passado o limite → dobra.
// - Cada registro de férias (não cancelado) consome o período aquisitivo mais antigo.

function addYears(dateStr, years) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function calcularFimGozo(inicio, dias) {
  if (!inicio || !dias) return '';
  return addDays(inicio, dias - 1);
}

// Situação consolidada de férias de um funcionário
export function calcularSituacaoFerias(func, feriasDoFunc) {
  const hoje = new Date().toISOString().slice(0, 10);
  if (!func.data_admissao) {
    return { periodosCompletos: 0, gozados: 0, pendentes: 0, saldoDias: 0, status: 'sem_dados' };
  }

  // Períodos aquisitivos completos até hoje
  let periodosCompletos = 0;
  while (addYears(func.data_admissao, periodosCompletos + 1) <= hoje) periodosCompletos++;

  const validas = feriasDoFunc.filter((f) => f.status !== 'cancelada');
  const gozados = validas.length;
  const pendentes = Math.max(0, periodosCompletos - gozados);
  const saldoDias = pendentes * 30;

  // Próximo período pendente mais antigo
  let status = 'em_dia';
  let aquisitivoFim = null;
  let limiteConcessivo = null;
  let diasParaLimite = null;

  if (pendentes > 0) {
    aquisitivoFim = addYears(func.data_admissao, gozados + 1);
    limiteConcessivo = addYears(aquisitivoFim, 1);
    diasParaLimite = Math.floor(
      (new Date(limiteConcessivo + 'T00:00:00') - new Date(hoje + 'T00:00:00')) / 86400000
    );
    if (diasParaLimite < 0) status = 'vencida';
    else if (diasParaLimite <= 90) status = 'atencao';
  }

  const emGozo = validas.some((f) => f.data_inicio_gozo <= hoje && f.data_fim_gozo >= hoje && f.status !== 'concluida');
  const proximaFerias = validas
    .filter((f) => f.data_inicio_gozo > hoje)
    .sort((a, b) => a.data_inicio_gozo.localeCompare(b.data_inicio_gozo))[0] || null;

  return { periodosCompletos, gozados, pendentes, saldoDias, aquisitivoFim, limiteConcessivo, diasParaLimite, status, emGozo, proximaFerias };
}

export const FERIAS_STATUS_CONFIG = {
  planejada: { label: 'Planejada', color: 'bg-blue-100 text-blue-700' },
  em_gozo: { label: 'Em Gozo', color: 'bg-purple-100 text-purple-700' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', color: 'bg-slate-100 text-slate-500' },
};

export const SITUACAO_CONFIG = {
  em_dia: { label: 'Em dia', color: 'bg-green-100 text-green-700' },
  atencao: { label: 'Atenção', color: 'bg-yellow-100 text-yellow-700' },
  vencida: { label: 'Vencida (risco de dobra)', color: 'bg-red-100 text-red-700' },
  sem_dados: { label: 'Sem admissão', color: 'bg-slate-100 text-slate-500' },
};