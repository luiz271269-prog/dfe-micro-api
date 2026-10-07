import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { vincularCompraCartao } from '../../shared/vincularCompraCartao.ts';

/**
 * Vincula um ItemCompra a um LancamentoCartao ou LancamentoBancario.
 * Marca ambos os lados — evita dupla contagem nos relatórios.
 *
 * Payload: { item_compra_id, tipo: 'cartao'|'banco', ref_id }
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json();
    const { item_compra_id, tipo, ref_id } = payload;
    if (![item_compra_id, ref_id].every(id => typeof id === 'string' && id.trim().length > 0 && id.length <= 200) || !['cartao', 'banco'].includes(tipo) || (payload.automatico !== undefined && typeof payload.automatico !== 'boolean')) {
      return Response.json({ error: 'Informe a compra, o lançamento e o tipo cartao ou banco válidos.' }, { status: 400 });
    }
    const db = base44.entities;
    const item = await db.ItemCompra.filter({ id: item_compra_id }, { limit: 1 });
    const compra = item.items[0];
    if (!compra) return Response.json({ error: 'ItemCompra não encontrado' }, { status: 404 });
    if (tipo === 'cartao') return Response.json(await vincularCompraCartao(db, compra, ref_id, user.id, payload));
    const updateCompra = {
      status_pagamento: 'pago',
      valor_pago: compra.valor_total,
    };

    if (tipo === 'banco') {
      updateCompra.forma_pagamento = 'banco_pix';
      updateCompra.lancamento_bancario_id = ref_id;
      await base44.asServiceRole.entities.LancamentoBancario.update(ref_id, { item_compra_id });
    } else {
      return Response.json({ error: 'tipo deve ser cartao ou banco' }, { status: 400 });
    }

    await base44.asServiceRole.entities.ItemCompra.update(item_compra_id, updateCompra);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}