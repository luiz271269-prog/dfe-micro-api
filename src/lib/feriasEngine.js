// Motor de cálculo de férias (regras CLT):
// - Período aquisitivo: cada 12 meses a partir da admissão → direito a 30 dias.
// - Período concessivo: 12 meses após o fim do aquisitivo. Passado o limite → dobra.
// - Contabilidade em DIAS: férias em dias picados descontam do saldo do período
//   aquisitivo mais antigo em aberto (o que está vencendo primeiro).

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

// Situação consolidada de férias de um funcionário (contagem em dias)
export function calcularSituacaoFerias(func, feriasDoFunc) {
  const hoje = new Date().toISOString().slice(0, 10);
  if (!func.data_admissao) {
    return { periodosCompletos: 0, gozados: 0, pendentes: 0, diasDireito: 0, diasUsados: 0, saldoDias: 0, status: 'sem_dados' };
  }

  // Períodos aquisitivos completos até hoje
  let periodosCompletos = 0;
  while (addYears(func.data_admissao, periodosCompletos + 1) <= hoje) periodosCompletos++;

  const validas = feriasDoFunc.filter((f) => f.status !== 'cancelada');
  const diasUsados = validas.reduce((s, f) => s + (f.dias_gozo || 0) + (f.dias_abono || 0), 0);
  const diasDireito = periodosCompletos * 30;
  const saldoDias = Math.max(0, diasDireito - diasUsados);

  // Períodos totalmente quitados (30 dias consumidos = 1 período)
  const gozados = Math.min(periodosCompletos, Math.floor(diasUsados / 30));
  const pendentes = periodosCompletos - gozados;

  // Período aquisitivo mais antigo ainda em aberto (mesmo que parcialmente gozado)
  let status = 'em_dia';
  let aquisitivoFim = null;
  let limiteConcessivo = null;
  let diasParaLimite = null;

  if (saldoDias > 0) {
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

  return { periodosCompletos, gozados, pendentes, diasDireito, diasUsados, saldoDias, aquisitivoFim, limiteConcessivo, diasParaLimite, status, emGozo, proximaFerias };
}

// Detalhamento por período aquisitivo (30 dias/ano) com alocação FIFO dos gozos:
// cada gozo registrado abate do período mais antigo em aberto, permitindo ver
// retroativas (períodos vencidos) e quando/quanto foi pago em cada período.
export function calcularPeriodosAquisitivos(func, feriasDoFunc) {
  if (!func.data_admissao) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  const validas = (feriasDoFunc || [])
    .filter((f) => f.status !== 'cancelada')
    .sort((a, b) => (a.data_inicio_gozo || '').localeCompare(b.data_inicio_gozo || ''));
  const gozos = validas.map((f) => ({ ...f, restante: (f.dias_gozo || 0) + (f.dias_abono || 0) }));

  const periodos = [];
  let n = 0;
  while (true) {
    const inicio = addYears(func.data_admissao, n);
    const fimExclusivo = addYears(func.data_admissao, n + 1);
    const fim = addDays(fimExclusivo, -1);
    if (fimExclusivo > hoje) {
      // Período aquisitivo em curso: direito proporcional (~2,5 dias/mês)
      const meses = Math.floor((new Date(hoje + 'T00:00:00') - new Date(inicio + 'T00:00:00')) / (30.44 * 86400000));
      periodos.push({ inicio, fim, emCurso: true, diasDireito: 30, diasProporcionais: Math.min(30, Math.floor(meses * 2.5)), diasUsados: 0, saldo: null, status: 'em_curso', pagamentos: [] });
      break;
    }
    const limiteConcessivo = addYears(fim, 1);
    let usados = 0;
    const pagamentos = [];
    for (const g of gozos) {
      if (usados >= 30) break;
      if (g.restante <= 0) continue;
      const aloc = Math.min(30 - usados, g.restante);
      g.restante -= aloc;
      usados += aloc;
      pagamentos.push({
        dias: aloc,
        inicio_gozo: g.data_inicio_gozo,
        fim_gozo: g.data_fim_gozo,
        data_pagamento: g.data_pagamento || null,
        valor_pago: g.valor_pago || null,
        abono: (g.dias_abono || 0) > 0,
      });
    }
    const saldo = 30 - usados;
    let status = 'quitado';
    if (saldo > 0) {
      if (limiteConcessivo < hoje) status = 'vencido';
      else if (usados > 0) status = 'parcial';
      else status = 'em_aberto';
    }
    periodos.push({ inicio, fim, limiteConcessivo, diasDireito: 30, diasUsados: usados, saldo, status, pagamentos });
    n++;
  }
  return periodos;
}

export const PERIODO_STATUS_CONFIG = {
  quitado: { label: 'Quitado', color: 'bg-green-100 text-green-700' },
  parcial: { label: 'Parcial', color: 'bg-blue-100 text-blue-700' },
  em_aberto: { label: 'Em aberto', color: 'bg-yellow-100 text-yellow-700' },
  vencido: { label: 'RETROATIVA (vencida — dobra)', color: 'bg-red-100 text-red-700' },
  em_curso: { label: 'Em curso', color: 'bg-slate-100 text-slate-600' },
};

// Simulação de custo de férias (adiantamento) e abono pecuniário
// - Férias: (salário/30 × dias de gozo) + 1/3 constitucional
// - Abono: (salário/30 × dias vendidos) + 1/3 sobre o abono
// - FGTS (8%) incide sobre férias + 1/3 (não sobre o abono) — custo do empregador
export function simularCustoFerias(salarioBase, diasGozo, diasAbono) {
  const diaria = (salarioBase || 0) / 30;
  const valorFerias = diaria * (diasGozo || 0);
  const tercoFerias = valorFerias / 3;
  const valorAbono = diaria * (diasAbono || 0);
  const tercoAbono = valorAbono / 3;
  const totalPagamento = valorFerias + tercoFerias + valorAbono + tercoAbono;
  const fgts = (valorFerias + tercoFerias) * 0.08;
  return {
    diaria,
    valorFerias,
    tercoFerias,
    valorAbono,
    tercoAbono,
    totalPagamento,
    fgts,
    custoTotalEmpregador: totalPagamento + fgts,
  };
}

// CLT art. 145: pagamento até 2 dias antes do início do gozo
export function dataLimitePagamento(dataInicioGozo) {
  if (!dataInicioGozo) return '';
  return addDays(dataInicioGozo, -2);
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