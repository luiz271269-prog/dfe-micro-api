function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const valor = new Date(data + 'T00:00:00Z');
  return !Number.isNaN(valor.getTime()) && valor.toISOString().slice(0, 10) === data;
}
export function impedimentoAdmissao(func, competencia, datas = []) {
  if (!dataValida(func?.data_admissao)) return 'Informe uma data de admissão válida no cadastro antes de lançar eventos.';
  if (competencia !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia || '')) return 'Competência inválida.';
    if (competencia < func.data_admissao.slice(0, 7)) return `Não é permitido lançar folha ou eventos anteriores à admissão (${func.data_admissao}).`;
  }
  if (!Array.isArray(datas) || datas.length > 10) return 'Datas do evento inválidas.';
  for (const data of datas) {
    if (!dataValida(data)) return 'Informe datas válidas para o evento.';
    if (data < func.data_admissao) return `Não é permitido lançar eventos anteriores à admissão (${func.data_admissao}).`;
  }
  return null;
}