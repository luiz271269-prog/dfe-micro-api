import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

/**
 * Vincula um ItemCompra a um LancamentoCartao ou LancamentoBancario.
 * Marca ambos os lados — evita dupla contagem nos relatórios.
 *
 * Payload: { item_compra_id, tipo: 'cartao'|'banco', ref_id }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { item_compra_id, tipo, ref_id } = await req.json();
    if (!item_compra_id || !tipo || !ref_id) {
      return Response.json({ error: 'Parâmetros obrigatórios: item_compra_id, tipo, ref_id' }, { status: 400 });
    }

    const item = await base44.asServiceRole.entities.ItemCompra.filter({ id: item_compra_id });
    if (!item?.[0]) return Response.json({ error: 'ItemCompra não encontrado' }, { status: 404 });

    const compra = item[0];
    const updateCompra = {
      status_pagamento: 'pago',
      valor_pago: compra.valor_total,
    };

    if (tipo === 'cartao') {
      updateCompra.forma_pagamento = 'cartao';
      updateCompra.lancamento_cartao_id = ref_id;
      await base44.asServiceRole.entities.LancamentoCartao.update(ref_id, { item_compra_id });
    } else if (tipo === 'banco') {
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
});