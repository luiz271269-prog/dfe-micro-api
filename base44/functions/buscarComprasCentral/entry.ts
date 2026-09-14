import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchCentralCompras, normalizarPedidosCompra } from '../../shared/centralCompras.ts';

/**
 * buscarComprasCentral — leitura pura (read-only) dos Pedidos de Compra
 * da Central de Compras. Nada é persistido localmente.
 *
 * Retorna:
 *  - itens: linhas achatadas (um item de pedido por linha) prontas para a tabela
 *  - fornecedores: agregação { nome, total, pedidos }
 *  - pedidos_count, header_usado
 */

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const resultado = await fetchCentralCompras('PedidoCompra', 'limit=500');
    if (!resultado.ok) {
      return Response.json({
        ok: false,
        status: resultado.status,
        motivo: resultado.status === 403
          ? 'A Central de Compras recusou a autenticação ou o acesso da chave pessoal aos pedidos (403).'
          : `A Central de Compras respondeu HTTP ${resultado.status}.`,
        diagnostico: resultado.diagnostico,
        itens: [],
        fornecedores: [],
      });
    }

    const pedidos = resultado.data;
    const { itens, fornecedores } = normalizarPedidosCompra(pedidos);

    return Response.json({
      ok: true,
      header_usado: resultado.header,
      pedidos_count: pedidos.length,
      itens,
      fornecedores,
    });
  } catch (error) {
    console.error('buscarComprasCentral erro:', error);
    return Response.json({ ok: false, motivo: error.message, itens: [], fornecedores: [] }, { status: 500 });
  }
}