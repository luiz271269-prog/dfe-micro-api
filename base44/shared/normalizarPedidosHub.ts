import { normalizarPedidosCompra } from './centralCompras.ts';

// Mantém o contrato legado sem modificar a sincronização de outros módulos.
export function normalizarPedidosHub(pedidos) {
  const itens = [];
  const fornecedores = [];
  for (const pedido of pedidos) {
    const normalizado = normalizarPedidosCompra([pedido]);
    const total = normalizado.itens.reduce((s, item) => s + item.valor_total, 0);
    const pago = Math.max(0, Number(pedido.valor_pago) || 0);
    const status = pedido.status_pagamento || (pago >= total && total > 0 ? 'pago' : pago > 0 ? 'parcial' : 'nao_identificado');
    let saldoPago = Math.round(pago * 100);
    normalizado.itens.forEach((item, index) => {
      const linha = pedido.itens?.[index];
      const valorPago = index === normalizado.itens.length - 1 ? saldoPago : Math.round(pago * 100 * (total > 0 ? item.valor_total / total : 0));
      saldoPago -= valorPago;
      itens.push({ ...item,
        pedido_central_internal_id: pedido.id || '',
        data_emissao: pedido.data_emissao || item.data_emissao,
        data_vencimento: linha?.data_vencimento || pedido.data_vencimento || '',
        status_pagamento: status,
        valor_pago: status === 'pago' ? item.valor_total : valorPago / 100,
      });
    });
    fornecedores.push(...normalizado.fornecedores);
  }
  const porFornecedor = new Map();
  for (const f of fornecedores) {
    const atual = porFornecedor.get(f.nome) || { nome: f.nome, total: 0, pedidos: 0 };
    atual.total += f.total; atual.pedidos += f.pedidos;
    porFornecedor.set(f.nome, atual);
  }
  return { itens, fornecedores: [...porFornecedor.values()].sort((a, b) => b.total - a.total) };
}