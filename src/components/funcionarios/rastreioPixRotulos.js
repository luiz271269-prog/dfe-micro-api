export const SITUACAO_RASTREIO = {
  quitada: { label: 'Quitada', cls: 'bg-green-100 text-green-700' },
  pago_a_maior: { label: 'Pago a maior', cls: 'bg-purple-100 text-purple-700' },
  a_confirmar: { label: 'A confirmar', cls: 'bg-sky-100 text-sky-700' },
  a_vencer: { label: 'A vencer', cls: 'bg-slate-100 text-slate-700' },
  parcial_a_vencer: { label: 'Parcial · a vencer', cls: 'bg-slate-100 text-slate-700' },
  parcial: { label: 'Parcial vencida', cls: 'bg-yellow-100 text-yellow-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
  cobertura_insuficiente: { label: 'Cobertura insuficiente', cls: 'bg-amber-100 text-amber-800' },
};

export const CLASSIFICACAO_AUDITORIA = {
  correto: { label: 'Correto (5º–7º dia útil)', cls: 'bg-green-100 text-green-800 border-green-200' },
  correto_fora_janela: { label: 'Pago fora da janela', cls: 'bg-teal-100 text-teal-800 border-teal-200' },
  candidato_sem_vinculo: { label: 'PIX candidato s/ vínculo', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  possivel_duplicidade: { label: 'Possível duplicidade', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
  revisar: { label: 'Revisar vínculo / tipo', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  parcial: { label: 'Pagamento parcial', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  cobertura_insuficiente: { label: 'Extrato ausente no período', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  sem_evidencia: { label: 'Sem evidência de PIX', cls: 'bg-red-100 text-red-800 border-red-200' },
};

export const TIPO_PIX = {
  salario: { label: 'Salário (5º–7º DU)', color: 'bg-green-100 text-green-700' },
  comissao: { label: 'Comissão', color: 'bg-blue-100 text-blue-700' },
  complemento: { label: 'Complemento', color: 'bg-teal-100 text-teal-700' },
  adiantamento: { label: 'Vale (mês trab.)', color: 'bg-yellow-100 text-yellow-800' },
  adiantamento_em_dia_salario: { label: 'Marcado vale no 5º DU', color: 'bg-orange-100 text-orange-800' },
  a_confirmar: { label: 'A confirmar', color: 'bg-sky-100 text-sky-700' },
  suspeito: { label: 'Valor incompatível', color: 'bg-red-100 text-red-700' },
  baixa_manual: { label: 'Baixa manual (evidência ind.)', color: 'bg-indigo-100 text-indigo-700' },
  outro_beneficiario: { label: 'Outro beneficiário', color: 'bg-red-100 text-red-700' },
  nao_pix: { label: 'Não é PIX nominal', color: 'bg-red-100 text-red-700' },
};

export const ACAO_PLANO_CORRECAO = {
  vincular_pix_quinto_dia: { label: 'Vincular PIX do 5º dia útil', badge: 'bg-sky-100 text-sky-800' },
  reclassificar_vale_para_salario: { label: 'Reclassificar vínculo de Vale → Salário', badge: 'bg-orange-100 text-orange-800' },
  realocar_competencia: { label: 'Realocar PIX para competência correta', badge: 'bg-amber-100 text-amber-800' },
  desvincular_outro_beneficiario: { label: 'Revisar vínculo de outro beneficiário / ATM', badge: 'bg-red-100 text-red-800' },
  sinalizar_baixa_manual_duplicada: { label: 'Baixa manual em duplicidade / mês trocado', badge: 'bg-purple-100 text-purple-800' },
  aguardar_extrato: { label: 'Importar extrato do mês de pagamento', badge: 'bg-slate-100 text-slate-700' },
};