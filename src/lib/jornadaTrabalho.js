export const DIAS_JORNADA = [['seg', 'Segunda'], ['ter', 'Terça'], ['qua', 'Quarta'], ['qui', 'Quinta'], ['sex', 'Sexta'], ['sab', 'Sábado'], ['dom', 'Domingo']];
const minutos = hora => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora || '') ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null;
export const formatarHoras = valor => `${Math.floor(valor / 60)}h${String(Math.round(valor % 60)).padStart(2, '0')}`;
export function calcularJornadaDia(dia) {
  if (!dia?.ativo) return { minutos: 0, erro: null };
  const entrada = minutos(dia.entrada), saida = minutos(dia.saida), intervalo = Number(dia.intervalo_minutos ?? 0);
  if (entrada === null || saida === null) return { minutos: 0, erro: 'Preencha entrada e saída.' };
  if (saida <= entrada) return { minutos: 0, erro: 'A saída deve ser posterior à entrada.' };
  if (!Number.isFinite(intervalo) || intervalo < 0 || intervalo >= saida - entrada) return { minutos: 0, erro: 'O intervalo deve ser menor que o período de trabalho.' };
  return { minutos: saida - entrada - intervalo, erro: null };
}
export function resumoJornada(form) {
  const dias = (form.jornada_trabalho || []).filter(d => d.ativo).map(d => ({ ...d, ...calcularJornadaDia(d) }));
  const referenciaDiaria = Number(form.jornada_referencia_diaria ?? 8), referenciaSemanal = Number(form.jornada_referencia_semanal ?? 44);
  const erro = dias.find(d => d.erro)?.erro || (dias.length && (!(referenciaDiaria > 0) || !(referenciaSemanal > 0)) ? 'Informe referências de horas maiores que zero.' : null);
  const total = dias.reduce((s, d) => s + d.minutos, 0);
  return { dias, total, erro, referenciaDiaria, referenciaSemanal, reducaoSemanal: Math.max(0, referenciaSemanal * 60 - total) };
}
export function dadosJornadaSalvos(form) {
  const resumo = resumoJornada(form);
  if (resumo.erro) throw new Error(resumo.erro);
  return { data_fichamento: form.data_fichamento || null, jornada_trabalho: (form.jornada_trabalho || []).filter(d => d.ativo).map(d => ({ dia: d.dia, ativo: true, entrada: d.entrada, saida: d.saida, intervalo_minutos: Number(d.intervalo_minutos || 0) })), jornada_referencia_diaria: resumo.referenciaDiaria, jornada_referencia_semanal: resumo.referenciaSemanal };
}