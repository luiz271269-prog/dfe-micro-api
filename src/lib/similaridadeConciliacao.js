function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b\d{6,}\b/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(valor) {
  return new Set(normalizar(valor).split(' ').filter(t => t.length >= 3));
}

function scoreTexto(a, b) {
  const ta = tokens(a); const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let comuns = 0;
  ta.forEach(t => { if (tb.has(t)) comuns += 1; });
  return comuns / Math.max(ta.size, tb.size);
}

function diferencaDias(a, b) {
  if (!a || !b) return 999;
  return Math.abs((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
}

export function scoreSimilaridadeConciliacao(obrigacao, lancamento) {
  const esperado = Math.abs(obrigacao?.valor || 0);
  const realizado = Math.abs(lancamento?.valor || 0);
  const percentual = esperado ? Math.abs(esperado - realizado) / esperado : 1;
  const valor = percentual <= 0.001 ? 55 : percentual <= 0.01 ? 50 : percentual <= 0.05 ? 35 : percentual <= 0.1 ? 20 : 0;
  const dias = diferencaDias(obrigacao?.data_vencimento, lancamento?.data);
  const data = dias === 0 ? 25 : dias <= 3 ? 22 : dias <= 7 ? 16 : dias <= 15 ? 10 : dias <= 30 ? 5 : 0;
  const textoObrigacao = `${obrigacao?.descricao || ''} ${obrigacao?.fornecedor || ''}`;
  const textoLancamento = `${lancamento?.descricao || ''} ${lancamento?.detalhe || ''}`;
  return Math.round(valor + data + scoreTexto(textoObrigacao, textoLancamento) * 20);
}

export function ordenarPorSimilaridade(itens, alvo, lado) {
  return [...itens].sort((a, b) => {
    const scoreA = lado === 'obrigacao' ? scoreSimilaridadeConciliacao(a, alvo) : scoreSimilaridadeConciliacao(alvo, a);
    const scoreB = lado === 'obrigacao' ? scoreSimilaridadeConciliacao(b, alvo) : scoreSimilaridadeConciliacao(alvo, b);
    return scoreB - scoreA;
  });
}