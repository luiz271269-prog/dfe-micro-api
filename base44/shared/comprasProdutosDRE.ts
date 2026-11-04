import { normalizarPedidosHub } from './normalizarPedidosHub.ts';

// Leitura apenas: competência usa a aquisição integral, nunca o saldo a pagar.
export function comprasProdutosDRE(comprasLocais, pedidos) {
  const referencias = new Set(pedidos.flatMap(p => [p.id, p.numero_pedido].filter(Boolean)));
  const locais = comprasLocais.filter(c =>
    (!c.tipo_compra || c.tipo_compra === 'estoque') &&
    !referencias.has(c.pedido_central_id) && !referencias.has(c.pedido_central_internal_id)
  );
  const ativos = pedidos.filter(p => !/cancelad/i.test(p.status || ''));
  const portal = normalizarPedidosHub(ativos).itens.map(item => ({
    ...item,
    data_emissao: item.data_criacao_ordem,
    descricao_produto: `${item.pedido_central_id} · ${item.fornecedor} · ${item.descricao_produto}`,
    origem_cmv: 'Central de Compras (consulta online)',
  }));
  return [...locais, ...portal];
}