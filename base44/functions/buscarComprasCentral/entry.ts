import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { consultarPedidosCentral } from '../../shared/centralComprasConsulta.ts';
import { normalizarPedidosHub } from '../../shared/normalizarPedidosHub.ts';
import { titulosComprasCentral, resumoComprasCentral } from '../../shared/titulosComprasCentral.ts';

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

    const payload = await req.json().catch(() => ({}));
    if (payload.mes !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(payload.mes)) {
      return Response.json({ ok: false, motivo: 'Mês inválido. Use YYYY-MM.' }, { status: 400 });
    }
    const formas = ['all', 'cartao', 'banco_pix', 'banco_boleto', 'banco_transferencia', 'dinheiro', 'nao_definida'];
    if (payload.forma_pagamento !== undefined && !formas.includes(payload.forma_pagamento)) return Response.json({ ok: false, motivo: 'Forma de pagamento inválida.' }, { status: 400 });
    const periodo = payload.mes ? (payload.anual === true ? payload.mes.slice(0, 4) : payload.mes) : '';
    const resultado = await consultarPedidosCentral();
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
    const normalizado = normalizarPedidosHub(pedidos);
    const itens = periodo ? normalizado.itens.filter((item) => (item.data_vencimento || item.data_emissao || '').startsWith(periodo)) : normalizado.itens;
    const fornecedores = normalizado.fornecedores;
    const documentosPeriodo = titulosComprasCentral(pedidos, normalizado.itens).filter(doc => !periodo || (doc.data_vencimento || doc.data_emissao || '').startsWith(periodo));
    const documentos = documentosPeriodo.filter(doc => !payload.forma_pagamento || payload.forma_pagamento === 'all' || doc.forma_pagamento === payload.forma_pagamento);

    return Response.json({
      ok: true,
      header_usado: resultado.header,
      pedidos_count: pedidos.length,
      pedidos_referencias: pedidos.flatMap((p) => [p.id, p.numero_pedido].filter(Boolean)),
      diagnostico: resultado.diagnostico,
      itens,
      fornecedores,
      documentos,
      resumo: resumoComprasCentral(documentosPeriodo),
      resumo_filtrado: resumoComprasCentral(documentos),
    });
  } catch (error) {
    console.error('buscarComprasCentral erro:', error);
    return Response.json({ ok: false, motivo: error.message, itens: [], fornecedores: [] }, { status: 500 });
  }
}