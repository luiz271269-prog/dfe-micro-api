export const SITUACAO_RASTREIO = {
  quitada: { label: 'Quitada', cls: 'bg-green-100 text-green-700' },
  pago_a_maior: { label: 'Pago a maior', cls: 'bg-purple-100 text-purple-700' },
  a_confirmar: { label: 'A confirmar', cls: 'bg-sky-100 text-sky-700' },
  a_vencer: { label: 'A vencer', cls: 'bg-slate-100 text-slate-700' },
  parcial_a_vencer: { label: 'Parcial · a vencer', cls: 'bg-slate-100 text-slate-700' },
  parcial: { label: 'Parcial vencida', cls: 'bg-yellow-100 text-yellow-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
};

export const TIPO_PIX = {
  salario: { label: 'Salário', color: 'bg-green-100 text-green-700' },
  comissao: { label: 'Comissão', color: 'bg-blue-100 text-blue-700' },
  complemento: { label: 'Complemento', color: 'bg-teal-100 text-teal-700' },
  adiantamento: { label: 'Vale', color: 'bg-yellow-100 text-yellow-800' },
  a_confirmar: { label: 'A confirmar', color: 'bg-sky-100 text-sky-700' },
  suspeito: { label: 'Valor incompatível', color: 'bg-red-100 text-red-700' },
  baixa_manual: { label: 'Baixa manual', color: 'bg-indigo-100 text-indigo-700' },
  outro_beneficiario: { label: 'Outro beneficiário', color: 'bg-red-100 text-red-700' },
};