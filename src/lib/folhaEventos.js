// Vocabulário e cálculo dos eventos da folha (proventos/descontos).
// Campos fixos (horas_extras, comissao, desconto_*) + eventos avulsos (array `eventos`).

export const PRESETS_PROVENTO = ['Bônus', 'Vale Alimentação', 'Vale Transporte', 'Gratificação', 'Reembolso', 'Outros Ganhos'];
export const PRESETS_DESCONTO = ['Falta', 'Adiantamento', 'Compras Empresa', 'Plano de Saúde', 'Empréstimo', 'Outros Descontos'];

export const CAMPOS_PROVENTO = [
  ['horas_extras', 'Horas Extras'],
  ['comissao', 'Comissão'],
];
export const CAMPOS_DESCONTO = [
  ['desconto_inss', 'INSS'],
  ['desconto_irrf', 'IRRF'],
  ['desconto_vt', 'Vale Transporte (desc.)'],
  ['desconto_vr', 'Vale Refeição (desc.)'],
  ['outros_descontos', 'Outros Descontos (fixo)'],
];

const n = (v) => parseFloat(v) || 0;

export function somaEventos(eventos = [], tipo) {
  return (eventos || []).filter(e => e.tipo === tipo).reduce((s, e) => s + n(e.valor), 0);
}

// Totais de uma folha: proventos = bruto + fixos + eventos provento; descontos = fixos + eventos desconto.
export function calcularTotaisFolha(f) {
  const proventosFixos = CAMPOS_PROVENTO.reduce((s, [k]) => s + n(f[k]), 0);
  const descontosFixos = CAMPOS_DESCONTO.reduce((s, [k]) => s + n(f[k]), 0);
  const proventosEventos = somaEventos(f.eventos, 'provento');
  const descontosEventos = somaEventos(f.eventos, 'desconto');
  const proventos = proventosFixos + proventosEventos;
  const descontos = descontosFixos + descontosEventos;
  return {
    proventos, descontos, proventosEventos, descontosEventos,
    liquido: n(f.salario_bruto) + proventos - descontos,
  };
}

export function competenciaAnterior(comp) {
  const [y, m] = comp.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}