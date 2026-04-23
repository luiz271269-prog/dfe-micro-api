/**
 * Motor de Despesas Recorrentes
 * - Dado um lançamento bancário (débito), encontra a regra que melhor casa.
 * - Calcula desvio de valor vs. esperado e sinaliza divergências.
 * - Também "aprende" sugerindo novas regras a partir de débitos repetidos no histórico.
 */

function normalize(str) {
  return (str || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Testa se um lançamento bancário casa com uma regra.
 * Retorna { match: bool, desvioPercentual, status: 'ok' | 'divergente' | 'sem_match' }
 */
export function aplicarRegra(lancamento, regra) {
  if (!regra.is_ativa) return { match: false };
  const desc = normalize(lancamento.descricao + ' ' + (lancamento.detalhe || ''));
  const padrao = normalize(regra.padrao_descricao);

  // Match por descrição: cada palavra do padrão (len>2) deve aparecer na descrição
  const palavras = padrao.split(' ').filter(p => p.length > 2);
  const descBate = palavras.length > 0 && palavras.every(p => desc.includes(p));
  if (!descBate) return { match: false };

  const valorLanc = Math.abs(lancamento.valor);
  const desvio = regra.valor_esperado > 0
    ? ((valorLanc - regra.valor_esperado) / regra.valor_esperado) * 100
    : 0;
  const tolerancia = regra.tolerancia_percentual ?? 5;
  const divergente = Math.abs(desvio) > tolerancia;

  return {
    match: true,
    desvioPercentual: desvio,
    valorEsperado: regra.valor_esperado,
    valorReal: valorLanc,
    status: divergente ? 'divergente' : 'ok',
    regra,
  };
}

/**
 * Para uma lista de débitos, retorna array com { lancamento, match } para cada um que casou com alguma regra.
 */
export function detectarRecorrentes(lancamentos, regras) {
  const debitos = lancamentos.filter(l => l.valor < 0);
  const resultados = [];
  for (const lanc of debitos) {
    for (const regra of regras) {
      const r = aplicarRegra(lanc, regra);
      if (r.match) {
        resultados.push({ lancamento: lanc, ...r });
        break; // primeira regra que casa ganha
      }
    }
  }
  return resultados;
}

/**
 * Aprende padrões: agrupa débitos com descrição similar e valor próximo (±10%)
 * que aparecem em ≥2 meses diferentes. Retorna sugestões de regras.
 */
export function aprenderPadroes(lancamentos, regrasExistentes = []) {
  const debitos = lancamentos.filter(l => l.valor < 0);
  const existentes = regrasExistentes.map(r => normalize(r.padrao_descricao));

  // Agrupa por "chave" = 3 primeiras palavras significativas da descrição
  const grupos = {};
  for (const l of debitos) {
    const desc = normalize(l.descricao);
    const palavras = desc.split(' ').filter(p => p.length > 3).slice(0, 3);
    if (palavras.length < 1) continue;
    const chave = palavras.join(' ');
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(l);
  }

  const sugestoes = [];
  for (const [chave, lancs] of Object.entries(grupos)) {
    if (lancs.length < 2) continue;
    // Ignora se já existe regra que cobre esta chave
    if (existentes.some(e => chave.includes(e) || e.includes(chave))) continue;

    // Meses distintos
    const meses = new Set(lancs.map(l => (l.data || '').slice(0, 7)));
    if (meses.size < 2) continue;

    const valores = lancs.map(l => Math.abs(l.valor));
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const maxDesvio = Math.max(...valores.map(v => Math.abs(v - media) / media * 100));
    // Só sugere se valores são consistentes (desvio < 20%)
    if (maxDesvio > 20) continue;

    // Dia do mês mais frequente
    const dias = lancs.map(l => parseInt((l.data || '').slice(8, 10), 10)).filter(Boolean);
    const diaMediano = dias.sort((a, b) => a - b)[Math.floor(dias.length / 2)] || 1;

    sugestoes.push({
      nome: chave.slice(0, 40),
      padrao_descricao: chave,
      valor_esperado: Math.round(media * 100) / 100,
      tolerancia_percentual: Math.max(5, Math.ceil(maxDesvio)),
      dia_vencimento: diaMediano,
      ocorrencias: lancs.length,
      meses_distintos: meses.size,
      amostra: lancs.slice(0, 3).map(l => ({ data: l.data, valor: l.valor, descricao: l.descricao })),
    });
  }

  return sugestoes.sort((a, b) => b.ocorrencias - a.ocorrencias);
}