import { scoreSimilaridadeConciliacao } from '@/lib/similaridadeConciliacao';

export const LIMITE_PROVAVEL = 70;
export const LIMITE_POSSIVEL = 50;

// Compara cada débito com as contas em aberto por valor, data e descrição/fornecedor.
// Cada conta é sugerida para um único débito (o de maior compatibilidade). Somente leitura.
export function compararDebitosComContas(debitos, obrigacoes) {
  const pares = [];
  debitos.forEach(d => obrigacoes.forEach(o => {
    const score = scoreSimilaridadeConciliacao(o, d);
    if (score >= LIMITE_POSSIVEL) pares.push({ d, o, score });
  }));
  pares.sort((a, b) => b.score - a.score);

  const porDebito = new Map();
  const usadas = new Set();
  pares.forEach(({ d, o, score }) => {
    const chave = `${o.entidade_tipo}-${o.entidade_id}`;
    if (porDebito.has(d.id) || usadas.has(chave)) return;
    porDebito.set(d.id, { conta: o, score, diferenca: Math.abs(Math.abs(d.valor || 0) - (o.valor || 0)) });
    usadas.add(chave);
  });

  const linhas = debitos.map(d => ({ debito: d, ...(porDebito.get(d.id) || {}) }));
  return {
    provaveis: linhas.filter(l => l.score >= LIMITE_PROVAVEL),
    possiveis: linhas.filter(l => l.conta && l.score < LIMITE_PROVAVEL),
    semPar: linhas.filter(l => !l.conta),
  };
}