import { extrairTermoChave } from './autoCategorizacao';

// Lançamento ainda não classificado: sem conta analítica, na conta genérica
// "Outras despesas" ou sem natureza econômica definida.
export function ePendenteClassificacao(lancamento) {
  if (!lancamento) return false;
  if (!lancamento.categoria) return true;
  if (lancamento.categoria === 'outro') return true;
  // Movimentações financeiras não têm natureza de gasto por definição.
  if (['aplicacoes', 'resgates', 'transferencia', 'interno'].includes(lancamento.categoria)) return false;
  return !lancamento.tipo_compra;
}

// Histórico por descrição: categoria mais usada nos lançamentos já classificados.
export function construirHistorico(lancamentos = []) {
  const contagens = new Map();
  lancamentos.forEach(l => {
    if (!l.categoria || l.categoria === 'outro' || !l.tipo_compra) return;
    const termo = extrairTermoChave(l.descricao);
    if (!termo) return;
    const atual = contagens.get(termo) || { categorias: {}, total: 0, exemplo: l.descricao };
    atual.categorias[l.categoria] = (atual.categorias[l.categoria] || 0) + 1;
    atual.total += 1;
    contagens.set(termo, atual);
  });

  const historico = new Map();
  contagens.forEach((valor, termo) => {
    const [categoria, quantidade] = Object.entries(valor.categorias).sort((a, b) => b[1] - a[1])[0];
    historico.set(termo, { categoria, quantidade, total: valor.total, exemplo: valor.exemplo });
  });
  return historico;
}

// Agrupa os pendentes pela mesma descrição-chave e anexa a sugestão do histórico.
export function agruparPendentes(lancamentos = [], historico = new Map()) {
  const grupos = new Map();
  lancamentos.filter(ePendenteClassificacao).forEach(l => {
    const termo = extrairTermoChave(l.descricao) || l.descricao || l.id;
    const grupo = grupos.get(termo) || { termo, itens: [] };
    grupo.itens.push(l);
    grupos.set(termo, grupo);
  });

  return [...grupos.values()]
    .map(grupo => {
      const evidencia = historico.get(grupo.termo);
      return {
        ...grupo,
        sugestao: evidencia?.categoria || null,
        evidencia: evidencia ? `${evidencia.quantidade} de ${evidencia.total} lançamentos iguais` : null,
      };
    })
    .sort((a, b) => (b.sugestao ? 1 : 0) - (a.sugestao ? 1 : 0) || b.itens.length - a.itens.length);
}