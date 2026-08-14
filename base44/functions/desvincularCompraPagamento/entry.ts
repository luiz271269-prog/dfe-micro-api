import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

/**
 * Desvincula um ItemCompra do pagamento associado.
 * Payload: { item_compra_id }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { item_compra_id } = await req.json();
    const items = await base44.asServiceRole.entities.ItemCompra.filter({ id: item_compra_id });
    const compra = items?.[0];
    if (!compra) return Response.json({ error: 'ItemCompra não encontrado' }, { status: 404 });

    if (compra.lancamento_cartao_id) {
      await base44.asServiceRole.entities.LancamentoCartao.update(compra.lancamento_cartao_id, { item_compra_id: null });
    }
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
});