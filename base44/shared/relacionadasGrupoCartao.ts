import { carregarGrupoCartao, estabelecimentoChave, estabelecimentoGenerico, parcelaDe, CAMPOS_GRUPO_CARTAO } from './grupoCartaoRevisao.ts';

export const ESCOPOS_RELACIONADAS = ['parcelas', 'mesmo_mes', 'outros_meses'];
export const LIMITE_RELACIONADAS = 150;

// Outras compras do mesmo estabelecimento do grupo, separadas em: parcelas da mesma compra, mesmo mês e outros meses.
export async function carregarRelacionadas(db, grupo, registros) {
  const chave = estabelecimentoChave(grupo.estabelecimento);
  const parcelasGrupo = registros.map(r => ({ parcela: parcelaDe({ estabelecimento: grupo.estabelecimento, observacao: r.observacao }), valor: Number(r.valor || 0) })).filter(x => x.parcela);
  const resultado = { generico: estabelecimentoGenerico(chave), parcela: parcelasGrupo[0]?.parcela || null, escopos: { parcelas: [], mesmo_mes: [], outros_meses: [] } };
  const palavras = chave.split(' ').filter(Boolean).slice(0, 3);
  if (!palavras.length) return resultado;
  // Busca ampla no servidor (tolera acentos); a igualdade exata do estabelecimento é conferida abaixo.
  const padrao = palavras.map(p => p.replace(/[aeioucn]/g, '.')).join('.*');
  const pagina = await db.LancamentoCartao.filter({ estabelecimento: { $regex: padrao, $options: 'i' }, valor: { $gt: 0 }, observacao: { $not: { $regex: 'Não faz parte', $options: 'i' } } }, { limit: 500, fields: ['fatura_id', 'estabelecimento', ...CAMPOS_GRUPO_CARTAO] });
  if (pagina.has_more) throw new Error('Há compras demais com este nome para analisar em conjunto. Classifique este estabelecimento mês a mês.');
  const proprios = new Set(registros.map(r => r.id));
  const outras = pagina.items.filter(l => !proprios.has(l.id) && estabelecimentoChave(l.estabelecimento) === chave);
  if (!outras.length) return resultado;
  const faturas = await db.FaturaCartao.filter({ id: { $in: [...new Set([grupo.fatura_id, ...outras.map(l => l.fatura_id)])] } }, { limit: 500, fields: ['mes_referencia', 'conta_cartao_id'] });
  const fatMap = new Map(faturas.items.map(f => [f.id, f]));
  const fatGrupo = fatMap.get(grupo.fatura_id);
  if (!fatGrupo) return resultado;
  for (const l of outras) {
    const fat = fatMap.get(l.fatura_id);
    if (!fat) continue;
    const parcela = parcelaDe(l);
    const mesmaCompra = parcela && l.fatura_id !== grupo.fatura_id && fat.conta_cartao_id === fatGrupo.conta_cartao_id && parcelasGrupo.some(g => g.parcela.total === parcela.total && Math.abs(g.valor - Number(l.valor || 0)) <= 0.1);
    const escopo = mesmaCompra ? 'parcelas' : fat.mes_referencia === fatGrupo.mes_referencia ? 'mesmo_mes' : 'outros_meses';
    resultado.escopos[escopo].push({ ...l, mes: fat.mes_referencia, conta_cartao_id: fat.conta_cartao_id });
  }
  return resultado;
}

// Resumo somente leitura para a tela decidir onde aplicar a mesma classificação.
export async function analisarRelacionadas(db, grupo) {
  const registros = await carregarGrupoCartao(db, grupo);
  const [analise, cards] = await Promise.all([carregarRelacionadas(db, grupo, registros), db.ContaCartao.list({ limit: 100, fields: ['nome'] })]);
  const nomes = new Map(cards.items.map(c => [c.id, c.nome]));
  const escopos = Object.fromEntries(ESCOPOS_RELACIONADAS.map(escopo => {
    const itens = analise.escopos[escopo];
    return [escopo, { quantidade: itens.length, valor: itens.reduce((s, l) => s + Number(l.valor || 0), 0), meses: [...new Set(itens.map(l => l.mes))].sort(), cartoes: [...new Set(itens.map(l => nomes.get(l.conta_cartao_id) || l.conta_cartao_id))].sort() }];
  }));
  return { success: true, generico: analise.generico, parcela: analise.parcela ? `${String(analise.parcela.numero).padStart(2, '0')}/${String(analise.parcela.total).padStart(2, '0')}` : null, limite: LIMITE_RELACIONADAS, escopos };
}