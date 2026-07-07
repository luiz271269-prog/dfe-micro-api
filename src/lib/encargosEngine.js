// Cálculo de encargos da folha (estimativas pelas tabelas vigentes)
// INSS: tabela progressiva por faixas · FGTS: 8% sobre o bruto (custo do empregador)

const FAIXAS_INSS = [
  { ate: 1518.00, aliquota: 0.075 },
  { ate: 2793.88, aliquota: 0.09 },
  { ate: 4190.83, aliquota: 0.12 },
  { ate: 8157.41, aliquota: 0.14 },
];

export function calcularINSS(brutoTotal) {
  const base = Math.min(brutoTotal || 0, FAIXAS_INSS[FAIXAS_INSS.length - 1].ate);
  let inss = 0;
  let anterior = 0;
  for (const faixa of FAIXAS_INSS) {
    if (base <= anterior) break;
    const parcela = Math.min(base, faixa.ate) - anterior;
    inss += parcela * faixa.aliquota;
    anterior = faixa.ate;
  }
  return Math.round(inss * 100) / 100;
}

export function calcularFGTS(brutoTotal) {
  return Math.round((brutoTotal || 0) * 0.08 * 100) / 100;
}