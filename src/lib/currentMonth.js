/**
 * Retorna o mês corrente no formato "YYYY-MM" no fuso horário do usuário.
 * Usado para inicializar o estado `selectedMonth` em todas as telas com navegação mensal,
 * garantindo que ao entrar a tela mostre o mês atual em vez de um mês fixo hard-coded.
 */
export function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}