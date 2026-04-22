/**
 * Motor de conciliação automática — apenas SUGERE vínculos.
 * Não altera dados. A decisão final é sempre humana.
 *
 * Regras:
 * - Valores devem bater EXATAMENTE (diferença < R$ 0,02)
 * - Data do extrato deve estar dentro de ±3 dias da data de referência do título/NF
 * - Score composto: valor (60) + data (30) + texto (10) = 100
 * - Limiar de auto-sugestão: score ≥ 70
 */

export const JANELA_DIAS = 3;
export const TOLERANCIA_VALOR = 0.02;
export const SCORE_MINIMO = 70;

function diffDias(d1, d2) {
  if (!d1 || !d2) return 999;
  return Math.abs((new Date(d1) - new Date(d2)) / 86400000);
}

function scoreData(dias) {
  if (dias === 0) return 30;
  if (dias <= 1) return 25;
  if (dias <= 2) return 18;
  if (dias <= JANELA_DIAS) return 12;
  return 0;
}

function scoreTexto(descricao, alvo) {
  if (!descricao || !alvo) return 0;
  const desc = descricao.toUpperCase();
  const palavras = alvo.toUpperCase().split(/\s+/).filter(w => w.length > 3);
  const matches = palavras.filter(w => desc.includes(w)).length;
  if (matches >= 2) return 10;
  if (matches === 1) return 6;
  return 0;
}

/**
 * Sugere vínculos para um crédito bancário:
 * - procura TituloCobranca em_aberto com valor exato e data de vencimento próxima
 * - procura NotaFiscal com valor exato e data de emissão próxima
 */
export function sugerirVinculosParaCredito(lanc, { titulos, notas }) {
  const sugestoes = [];

  titulos.filter(t => t.status === 'em_aberto').forEach(t => {
    const diffValor = Math.abs(t.valor_titulo - lanc.valor);
    if (diffValor > TOLERANCIA_VALOR) return;
    const dias = diffDias(t.data_vencimento, lanc.data);
    if (dias > JANELA_DIAS) return;
    const s = 60 + scoreData(dias) + scoreTexto(lanc.descricao, t.cliente);
    sugestoes.push({ tipo: 'TituloCobranca', objeto: t, score: s, dias, label: `${t.cliente} · ${t.nosso_numero || ''}` });
  });

  notas.filter(n => n.status !== 'pago').forEach(n => {
    const diffValor = Math.abs(n.valor_total - lanc.valor);
    if (diffValor > TOLERANCIA_VALOR) return;
    const dias = diffDias(n.data_emissao, lanc.data);
    if (dias > JANELA_DIAS) return;
    const s = 60 + scoreData(dias) + scoreTexto(lanc.descricao, n.cliente);
    sugestoes.push({ tipo: 'NotaFiscal', objeto: n, score: s, dias, label: `${n.cliente} · NF-${n.numero}` });
  });

  return sugestoes.sort((a, b) => b.score - a.score);
}

/**
 * Gera todas as sugestões do mês para revisão em lote.
 * Retorna array com: { lancamento, sugestoes[], melhor, confianca }
 */
export function gerarSugestoesMes({ lancamentos, titulos, notas }) {
  const creditos = lancamentos.filter(l => l.valor > 0 && l.categoria === 'recebimento');
  return creditos.map(l => {
    const sugestoes = sugerirVinculosParaCredito(l, { titulos, notas });
    const melhor = sugestoes[0] || null;
    let confianca = 'sem_match';
    if (melhor) {
      if (melhor.score >= 90) confianca = 'alta';
      else if (melhor.score >= SCORE_MINIMO) confianca = 'media';
      else confianca = 'baixa';
    }
    const ambiguo = sugestoes.length >= 2 && Math.abs(sugestoes[0].score - sugestoes[1].score) < 5;
    return { lancamento: l, sugestoes, melhor, confianca, ambiguo };
  });
}