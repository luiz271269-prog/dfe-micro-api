import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { lancamento_cartao_id } = await req.json().catch(() => ({}));
    if (!lancamento_cartao_id) return Response.json({ error: 'Informe o lançamento do cartão' }, { status: 400 });
    const db = base44.entities;
    const item = await db.LancamentoCartao.get(lancamento_cartao_id).catch(() => null);
    if (!item) return Response.json({ error: 'Lançamento não encontrado' }, { status: 404 });
    const classificacao = { ...(item.origem_compra ? { origem_compra: item.origem_compra } : {}), ...(item.tipo_compra ? { tipo_compra: item.tipo_compra } : {}) };
    const [despesas, comprasDiretas, obras] = await Promise.all([
      db.DespesaOperacional.filter({ lancamento_cartao_id }),
      db.ItemCompra.filter({ lancamento_cartao_id }),
      db.ObraReforma.filter({ lancamento_cartao_id }),
    ]);
    const compras = [...comprasDiretas];
    if (item.item_compra_id && !compras.some(c => c.id === item.item_compra_id)) {
      const compra = await db.ItemCompra.get(item.item_compra_id).catch(() => null);
      if (compra) compras.push(compra);
    }
    if (!Object.keys(classificacao).length) return Response.json({ success: true, filhos_atualizados: 0 });
    const grupos = [['DespesaOperacional', despesas], ['ItemCompra', compras], ['ObraReforma', obras]];
    const afetados = [];
    for (const [nome, registros] of grupos) {
      if (registros.length) await db[nome].bulkUpdate(registros.map(r => ({ id: r.id, ...classificacao })));
      registros.forEach(r => afetados.push({ tipo: nome, id: r.id }));
    }
    for (const alvo of afetados) {
      const vinculos = await db.VinculoExtrato.filter({ entidade_tipo: alvo.tipo, entidade_id: alvo.id });
      if (vinculos.length) await db.VinculoExtrato.bulkUpdate(vinculos.map(v => ({ id: v.id, ...classificacao })));
    }
    return Response.json({ success: true, filhos_atualizados: afetados.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}