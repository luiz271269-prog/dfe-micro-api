/**
 * Motor de cruzamento Compra (ItemCompra) × Pagamento (Banco / Cartão).
 *
 * Objetivo: evitar dupla contagem — toda compra deve ter uma única forma de pagamento
 * identificada (cartão ou banco) e o lançamento correspondente deve ser marcado com item_compra_id.
 *
 * Regra de match (scoring, menor = melhor):
 *   - Valor: diferença absoluta ≤ 0.50
 *   - Data: lançamento entre [data_emissao] e [data_emissao + 60 dias]
 *   - Fornecedor: match textual (word-overlap)
 *
 * Retorna candidatos ordenados por confiança.
 */

function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function matchFornecedor(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (shorter.length >= 5 && longer.includes(shorter)) return 0.9;
  const wordA = na.split(' ').find(w => w.length >= 4);
  const wordB = nb.split(' ').find(w => w.length >= 4);
  if (wordA && wordB && (na.includes(wordB) || nb.includes(wordA))) return 0.7;
  return 0;
}

function diffDias(d1, d2) {
  return Math.abs((new Date(d1) - new Date(d2)) / 86400000);
}

/**
 * Para uma compra, retorna candidatos de pagamento ordenados por confiança.
 * candidatos: [{ tipo: 'cartao'|'banco', ref, score, motivo }]
 */
export function acharPagamentosParaCompra(compra, { lancamentosBanco = [], lancamentosCartao = [] }, maxDias = 60) {
  const candidatos = [];
  const valor = compra.valor_total || 0;

  // Cartão
  for (const l of lancamentosCartao) {
    if (l.item_compra_id) continue; // já vinculado
    const diffValor = Math.abs((l.valor || 0) - valor);
    if (diffValor > 0.50) continue;
    const dd = diffDias(l.data_lancamento, compra.data_emissao);
    if (dd > maxDias) continue;
    const forn = matchFornecedor(compra.fornecedor, l.estabelecimento);
    if (forn === 0 && diffValor > 0.01) continue; // sem fornecedor → exige valor exato
    const score = dd * 1 + diffValor * 100 - forn * 30;
    candidatos.push({ tipo: 'cartao', ref: l, score, motivo: `Valor ${diffValor < 0.01 ? 'exato' : '≈'} · ${Math.round(dd)}d após emissão · fornecedor ${forn > 0.8 ? 'exato' : forn > 0 ? 'parcial' : '—'}` });
  }

  // Banco (apenas débitos)
  for (const l of lancamentosBanco) {
    if (l.item_compra_id) continue;
    if ((l.valor || 0) >= 0) continue;
    const diffValor = Math.abs(Math.abs(l.valor) - valor);
    if (diffValor > 0.50) continue;
    const dd = diffDias(l.data, compra.data_emissao);
    if (dd > maxDias) continue;
    const forn = matchFornecedor(compra.fornecedor, l.descricao);
    if (forn === 0 && diffValor > 0.01) continue;
    const score = dd * 1 + diffValor * 100 - forn * 30;
    candidatos.push({ tipo: 'banco', ref: l, score, motivo: `Valor ${diffValor < 0.01 ? 'exato' : '≈'} · ${Math.round(dd)}d após emissão · fornecedor ${forn > 0.8 ? 'exato' : forn > 0 ? 'parcial' : '—'}` });
  }

  return candidatos.sort((a, b) => a.score - b.score);
}

/**
 * Classifica a confiança do match.
 * Alta: score < 5 (data quase igual, valor exato, fornecedor exato)
 * Média: score < 30
 * Baixa: resto
 */
export function nivelConfianca(score) {
  if (score < 5) return 'alta';
  if (score < 30) return 'media';
  return 'baixa';
}

/**
 * Detecta possíveis duplicidades em lançamentos bancários.
 * Dois lançamentos são suspeitos de duplicidade se:
 *   - mesmo valor (diff < 0.01)
 *   - mesma conta
 *   - fornecedor/descrição similar
 *   - intervalo entre datas ≤ janelaDias (default 5d)
 */
export function detectarDuplicidadeBanco(novoLanc, lancamentosExistentes, janelaDias = 5) {
  const candidatos = [];
  for (const ex of lancamentosExistentes) {
    if (ex.id === novoLanc.id) continue;
    if (Math.abs((ex.valor || 0) - (novoLanc.valor || 0)) > 0.01) continue;
    if (ex.conta_bancaria !== novoLanc.conta_bancaria) continue;
    const dd = diffDias(ex.data, novoLanc.data);
    if (dd > janelaDias) continue;
    const forn = matchFornecedor(ex.descricao, novoLanc.descricao);
    if (forn < 0.5) continue;
    candidatos.push({ ref: ex, diffDias: dd, similaridade: forn });
  }
  return candidatos.sort((a, b) => a.diffDias - b.diffDias);
}