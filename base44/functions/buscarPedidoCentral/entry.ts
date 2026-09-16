import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchCentralCompras, normalizarPedidosCompra } from '../../shared/centralCompras.ts';

/**
 * buscarPedidoCentral — leitura pura (read-only) de UM Pedido de Compra
 * da Central de Compras pelo seu numero_pedido (oc_numero).
 * Retorna o pedido bruto completo + itens normalizados, para a tela nativa de Visão Completa.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const ocNumero = String(body?.oc_numero || body?.ocNumero || '').trim();
    if (!ocNumero) return Response.json({ ok: false, motivo: 'oc_numero é obrigatório.' }, { status: 400 });

    const resultado = await fetchCentralCompras('PedidoCompra', 'limit=500');
    if (!resultado.ok) {
      return Response.json({
        ok: false,
        status: resultado.status,
        motivo: resultado.status === 403
          ? 'A Central de Compras recusou a autenticação ou o acesso da chave pessoal aos pedidos (403).'
          : `A Central de Compras respondeu HTTP ${resultado.status}.`,
        diagnostico: resultado.diagnostico,
      });
    }

    const pedidos = resultado.data || [];
    const pedido = pedidos.find((p) => (p.numero_pedido || '') === ocNumero)
      || pedidos.find((p) => String(p.id || '') === ocNumero);

    if (!pedido) return Response.json({ ok: false, motivo: `Pedido ${ocNumero} não encontrado na Central de Compras.`, pedidos_count: pedidos.length });

    const { itens } = normalizarPedidosCompra([pedido]);

    return Response.json({
      ok: true,
      header_usado: resultado.header,
      pedido,
      itens,
    });
  } catch (error) {
    console.error('buscarPedidoCentral erro:', error);
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
}