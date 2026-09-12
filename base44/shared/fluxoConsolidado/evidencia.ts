// Toda linha do motor devolve valor + rastreabilidade (Gate 2: rastreabilidade obrigatória).
const MAX_IDS = 500;

export const arred = (v) => Math.round((v || 0) * 100) / 100;

export function linha(registros, extrairValor, meta = {}) {
  const valor = arred(registros.reduce((s, r) => s + (Number(extrairValor(r)) || 0), 0));
  return {
    valor,
    registros: registros.length,
    ids: registros.slice(0, MAX_IDS).map((r) => r.id),
    ...meta,
  };
}

export const mesDe = (data) => (data || '').slice(0, 7);
export const noMes = (data, mes) => mesDe(data) === mes;

export function perimetroDaConta(conta) {
  const c = (conta || '').toLowerCase();
  if (c.startsWith('neuraltec')) return 'NeuralTec';
  if (c.startsWith('liesch')) return 'Liesch';
  return 'nao_classificado';
}

export function dentroPerimetro(empresa, perimetro) {
  if (perimetro === 'grupo') return true;
  return (empresa || 'NeuralTec') === perimetro; // decisão 6: empresa vazia → NeuralTec (emissora padrão)
}