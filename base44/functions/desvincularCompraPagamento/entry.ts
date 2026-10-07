import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { desfazerCompraCartao } from '../../shared/conciliacaoCartaoDesfazer.ts';

/**
 * Desvincula um ItemCompra do pagamento associado.
 * Payload: { item_compra_id }
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { item_compra_id } = await req.json();
    if (typeof item_compra_id !== 'string' || !item_compra_id.trim() || item_compra_id.length > 200) return Response.json({ error: 'Informe uma compra válida.' }, { status: 400 });
    const db = base44.entities;
    const items = await db.ItemCompra.filter({ id: item_compra_id }, { limit: 1 });
    const compra = items.items[0];
    if (!compra) return Response.json({ error: 'ItemCompra não encontrado' }, { status: 404 });
    const cartao = await desfazerCompraCartao(db, item_compra_id, user.id);
    if (cartao) return Response.json(cartao);

    if (compra.lancamento_bancario_id) {
      await base44.asServiceRole.entities.LancamentoBancario.update(compra.lancamento_bancario_id, { item_compra_id: null });
    }
    await base44.asServiceRole.entities.ItemCompra.update(item_compra_id, {
      status_pagamento: 'nao_identificado',
      forma_pagamento: 'nao_definida',
      lancamento_cartao_id: null,
      lancamento_bancario_id: null,
      valor_pago: 0,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}