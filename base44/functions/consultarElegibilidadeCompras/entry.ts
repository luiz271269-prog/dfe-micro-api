import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { categoriasCompra, recorteCompras, motivosCompra } from '../../shared/comprasElegibilidade.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.mes || '') || typeof b.anual !== 'boolean' || typeof b.todosPeriodos !== 'boolean' || !['todos', 'NeuralTec', 'Liesch', 'pro_labore', 'condominio'].includes(b.empresa) || !['todos', 'pendente', 'receitas', 'estoque', 'fretes', 'impostos', 'despesas', 'folha', 'pro_labore', 'obras', 'financeiro', 'outro', 'fatura'].includes(b.natureza) || !Object.hasOwn(categoriasCompra, b.categoria) || (b.cursor != null && (typeof b.cursor !== 'string' || b.cursor.length > 4000))) return Response.json({ error: 'Filtros inválidos.' }, { status: 400 });
    const db = base44.entities.ItemCompra;
    const recorte = recorteCompras(b);
    const chaves = Object.keys(categoriasCompra);
    const contagens = b.natureza === 'fatura' ? chaves.map(() => 0) : await Promise.all(chaves.map(k => db.count({ $and: [recorte, categoriasCompra[k]] })));
    const resumo = Object.fromEntries(chaves.map((k, i) => [k, contagens[i]]));
    const page = b.natureza === 'fatura' ? { items: [], has_more: false } : await db.filter({ $and: [recorte, categoriasCompra[b.categoria]] }, { sort: '-data_emissao', limit: 25, ...(b.cursor ? { cursor: b.cursor } : {}) });
    const items = page.items.map(r => ({ id: r.id, descricao: r.descricao_produto, fornecedor: r.fornecedor, numero_nota: r.numero_nota, pedido: r.pedido_central_id, empresa: r.empresa, data_emissao: r.data_emissao, data_vencimento: r.data_vencimento, status_pagamento: r.status_pagamento, valor_total: r.valor_total, motivos: motivosCompra(r) }));
    return Response.json({ somente_leitura: true, resumo, total: contagens.reduce((s, n) => s + n, 0), items, has_more: !!page.has_more, next_cursor: page.next_cursor || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}