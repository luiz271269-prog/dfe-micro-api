import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { fatura_id, dry_run = false } = await req.json().catch(() => ({}));
    const db = base44.entities;
    const alvo = fatura_id ? await db.FaturaCartao.get(fatura_id).catch(() => null) : null;
    if (fatura_id && !alvo) return Response.json({ error: 'Fatura não encontrada' }, { status: 404 });
    const pagas = alvo ? (alvo.status === 'paga_total' ? [alvo] : []) : await db.FaturaCartao.filter({ status: 'paga_total' }, '-data_vencimento', 500);
    if (!pagas.length) return Response.json({ success: true, dry_run, faturas_processadas: 0, filhos_atualizados: 0 });
    const idsFaturas = new Set(pagas.map(f => f.id));
    const [todosItens, despesas, compras, obras] = await Promise.all([
      db.LancamentoCartao.list('id', 5000),
      db.DespesaOperacional.list('id', 5000),
      db.ItemCompra.list('id', 5000),
      db.ObraReforma.list('id', 5000),
    ]);
    const itens = todosItens.filter(i => idsFaturas.has(i.fatura_id));
    const porId = new Map(itens.map(i => [i.id, i]));
    const classificacao = item => ({ ...(item.origem_compra ? { origem_compra: item.origem_compra } : {}), ...(item.tipo_compra ? { tipo_compra: item.tipo_compra } : {}) });
    const despesasUpdate = despesas.filter(d => d.status !== 'pago' && porId.has(d.lancamento_cartao_id)).map(d => { const item = porId.get(d.lancamento_cartao_id); return { id: d.id, status: 'pago', ...classificacao(item), observacoes: `${d.observacoes ? d.observacoes + ' · ' : ''}Liquidada via pagamento da fatura do cartão` }; });
    const comprasUpdate = compras.filter(c => c.status_pagamento !== 'pago').map(c => { const item = porId.get(c.lancamento_cartao_id) || itens.find(i => i.item_compra_id === c.id); return item ? { id: c.id, status_pagamento: 'pago', valor_pago: c.valor_total || 0, ...classificacao(item) } : null; }).filter(Boolean);
    const obrasUpdate = obras.map(o => { const item = porId.get(o.lancamento_cartao_id); return item ? { id: o.id, ...classificacao(item) } : null; }).filter(o => o && Object.keys(o).length > 1);
    if (!dry_run) {
      if (despesasUpdate.length) await db.DespesaOperacional.bulkUpdate(despesasUpdate);
      if (comprasUpdate.length) await db.ItemCompra.bulkUpdate(comprasUpdate);
      if (obrasUpdate.length) await db.ObraReforma.bulkUpdate(obrasUpdate);
    }
    return Response.json({ success: true, dry_run, faturas_processadas: pagas.length, itens_cartao: itens.length, despesas_baixadas: despesasUpdate.length, compras_baixadas: comprasUpdate.length, obras_classificadas: obrasUpdate.length, filhos_atualizados: despesasUpdate.length + comprasUpdate.length + obrasUpdate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}