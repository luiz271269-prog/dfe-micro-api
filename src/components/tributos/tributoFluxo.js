export function competenciaAnterior(mes) {
  const [ano,numero]=String(mes||'').split('-').map(Number);
  return ano&&numero ? new Date(Date.UTC(ano,numero-2,1)).toISOString().slice(0,7) : '';
}
export function empresaDaConta(conta='') {
  const liesch=/liesch|37101/i.test(conta);const neural=/neuraltec|36092/i.test(conta);
  return liesch!==neural ? liesch?'Liesch':'NeuralTec' : '';
}
export function saldoGuia(t) {
  return Math.max(0,(Math.round(Number(t.valor_original||0)*100)+Math.round(Number(t.juros_multa||0)*100)-Math.round(Number(t.valor_pago||0)*100))/100);
}