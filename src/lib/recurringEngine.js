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
  if (regra.conta_bancaria && regra.conta_bancaria !== lancamento.conta_bancaria) return { match: false };
  const frequencia = regra.frequencia || 'mensal';
  if (frequencia === 'semanal') {
    if (!regra.data_inicio || !lancamento.data) return { match: false };
    const dias = Math.round((Date.parse(`${lancamento.data}T12:00:00Z`) - Date.parse(`${regra.data_inicio}T12:00:00Z`)) / 86400000);
    if (!Number.isFinite(dias) || dias < 0 || dias % 7 !== 0) return { match: false };
  } else {
    const intervalo = { mensal: 1, trimestral: 3, anual: 12 }[frequencia];
    if (!intervalo || (intervalo > 1 && !regra.mes_inicio)) return { match: false };
    if (regra.mes_inicio) {
      const [ano, mes] = (lancamento.data || '').slice(0, 7).split('-').map(Number);
      const [inicioAno, inicioMes] = regra.mes_inicio.split('-').map(Number);
      const distancia = (ano - inicioAno) * 12 + mes - inicioMes;
      if (!Number.isFinite(distancia) || distancia < 0 || distancia % intervalo !== 0) return { match: false };
    }
  }
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
export { descobrirFixas as aprenderPadroes } from '@/components/recorrentes/fixasEngine';