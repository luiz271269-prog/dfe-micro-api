import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { consultarPedidosHub } from '../../shared/nexusHub.ts';
import { normalizarPedidosHub } from '../../shared/normalizarPedidosHub.ts';

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

    const resultado = await consultarPedidosHub();
    if (!resultado.ok) {
      return Response.json({
        ok: false,
        status: resultado.status,
        motivo: resultado.motivo,
        diagnostico: resultado.diagnostico,
        itens: [],
        fornecedores: [],
      });
    }

    const pedidos = resultado.data;
    const { itens, fornecedores } = normalizarPedidosHub(pedidos);

    return Response.json({
      ok: true,
      header_usado: resultado.header,
      pedidos_count: pedidos.length,
      pedidos_referencias: pedidos.flatMap((p) => [p.id, p.numero_pedido].filter(Boolean)),
      diagnostico: resultado.diagnostico,
      itens,
      fornecedores,
    });
  } catch (error) {
    console.error('buscarComprasCentral erro:', error);
    return Response.json({ ok: false, motivo: error.message, itens: [], fornecedores: [] }, { status: 500 });
  }
}