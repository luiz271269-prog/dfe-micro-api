const TIPOS = ['ItemCompra', 'DespesaOperacional', 'ObraReforma'];
// Consulta limitada à página atual e às permissões do usuário, nunca ao service role.
export async function documentosFatura(db, lancamentos, admin) {
  const ids = lancamentos.map(l => l.id);
  if (!ids.length) return { porLancamento: {}, parcial: false };
  const trilhas = admin ? await db.VinculoCartao.filter({ lancamento_cartao_id: { $in: ids }, fase: 'confirmado' }, { limit: 100, sort: '-created_date' }) : { items: [], has_more: false };
  const paginas = await Promise.all(TIPOS.map(tipo => {
    const refs = trilhas.items.filter(v => v.entidade_tipo === tipo).map(v => v.entidade_id);
    const query = { $or: [{ lancamento_cartao_id: { $in: ids } }, ...(refs.length ? [{ id: { $in: refs } }] : []), ...(tipo === 'ItemCompra' ? [{ id: { $in: lancamentos.map(l => l.item_compra_id).filter(Boolean) } }] : [])] };
    return db[tipo].filter(query, { limit: 100, sort: '-created_date' });
  }));
  const porLancamento = Object.fromEntries(ids.map(id => [id, []]));
  paginas.forEach((pagina, indice) => pagina.items.forEach(doc => {
    const tipo = TIPOS[indice];
    const vinculados = trilhas.items.filter(v => v.entidade_tipo === tipo && v.entidade_id === doc.id);
    const referencias = new Set(vinculados.map(v => v.lancamento_cartao_id));
    if (ids.includes(doc.lancamento_cartao_id)) referencias.add(doc.lancamento_cartao_id);
    if (tipo === 'ItemCompra') lancamentos.filter(l => l.item_compra_id === doc.id).forEach(l => referencias.add(l.id));
    referencias.forEach(id => porLancamento[id]?.push({
      id: doc.id, entidade: tipo, descricao: doc.descricao_produto || doc.descricao || doc.fornecedor || 'Documento',
      numero: doc.numero_nota || '', data: doc.data_emissao || doc.data, natureza: doc.tipo_compra || '',
      vinculo: vinculados.some(v => v.lancamento_cartao_id === id) ? 'VinculoCartao confirmado' : 'Referência direta legada',
    }));
  }));
  return { porLancamento, parcial: trilhas.has_more || paginas.some(p => p.has_more) };
}