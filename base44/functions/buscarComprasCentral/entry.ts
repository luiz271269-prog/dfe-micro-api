import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchCentralCompras } from '../../shared/centralCompras.ts';

/**
 * buscarComprasCentral — leitura pura (read-only) dos Pedidos de Compra
 * da Central de Compras. Nada é persistido localmente.
 *
 * Retorna:
 *  - itens: linhas achatadas (um item de pedido por linha) prontas para a tabela
 *  - fornecedores: agregação { nome, total, pedidos }
 *  - pedidos_count, header_usado
 */

const CATEGORIAS = ['notebook','tablet','smartphone','componente','memoria','armazenamento','periferico','software','rede','outro'];

function normalizarCategoria(valor) {
  const v = (valor || '').toString().toLowerCase().trim();
  return CATEGORIAS.includes(v) ? v : 'outro';
}

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
          ? 'A Central de Compras recusou a chave de API (403). Habilite o acesso via API no app Nexus Cotações (Dashboard → API) e confirme a chave em CENTRAL_COMPRAS_API_KEY.'
          : `A Central de Compras respondeu HTTP ${resultado.status}.`,
        itens: [],
        fornecedores: [],
      });
    }

    const pedidos = resultado.data;
    const itens = [];
    const agg = new Map();

    for (const p of pedidos) {
      const fornecedor = (p.fornecedor_nome || p.fornecedor || 'Sem fornecedor').trim();
      const data = p.data_pedido || p.created_date?.slice(0, 10) || '';
      const chave = fornecedor.toLowerCase();
      const atual = agg.get(chave) || { nome: fornecedor, total: 0, pedidos: 0 };
      atual.total += p.valor_total || 0;
      atual.pedidos += 1;
      agg.set(chave, atual);

      const linhas = Array.isArray(p.itens) && p.itens.length > 0 ? p.itens : null;
      if (linhas) {
        linhas.forEach((it, idx) => {
          const qtd = it.quantidade || 1;
          const unit = it.valor_unitario ?? (it.valor_total ? it.valor_total / qtd : null);
          itens.push({
            id: `${p.id || p.numero_pedido}-${idx}`,
            pedido: p.numero_pedido || '',
            data_emissao: data,
            descricao_produto: it.descricao || it.produto || `Item ${idx + 1}`,
            fornecedor,
            categoria_produto: normalizarCategoria(it.categoria),
            quantidade: qtd,
            valor_unitario: unit,
            valor_total: it.valor_total ?? (unit ? unit * qtd : 0),
            numero_nota: p.nota_fiscal_numero || '',
            status_pagamento: p.status_pagamento || '',
          });
        });
      } else {
        itens.push({
          id: p.id || p.numero_pedido,
          pedido: p.numero_pedido || '',
          data_emissao: data,
          descricao_produto: `Pedido ${p.numero_pedido || ''}`.trim(),
          fornecedor,
          categoria_produto: 'outro',
          quantidade: 1,
          valor_unitario: p.valor_total || null,
          valor_total: p.valor_total || 0,
          numero_nota: p.nota_fiscal_numero || '',
          status_pagamento: p.status_pagamento || '',
        });
      }
    }

    return Response.json({
      ok: true,
      header_usado: resultado.header,
      pedidos_count: pedidos.length,
      itens,
      fornecedores: [...agg.values()].sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    console.error('buscarComprasCentral erro:', error);
    return Response.json({ ok: false, motivo: error.message, itens: [], fornecedores: [] }, { status: 500 });
  }
}