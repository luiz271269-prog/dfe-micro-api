import { normalizarPedidosCompra } from './centralCompras.ts';

// Mantém o contrato legado sem modificar a sincronização de outros módulos.
export function normalizarPedidosHub(pedidos) {
  const itens = [];
  const fornecedores = [];
  for (const pedido of pedidos) {
    const normalizado = normalizarPedidosCompra([pedido]);
    const moeda = String(pedido.moeda || 'BRL').toUpperCase();
    const cambio = moeda === 'BRL' ? 1 : Number(pedido.taxa_cambio);
    if (!Number.isFinite(cambio) || cambio <= 0) throw new Error(`Pedido ${pedido.numero_pedido}: informe o câmbio para converter ${moeda} em reais.`);
    const totalOriginal = normalizado.itens.reduce((s, item) => s + item.valor_total, 0);
    const total = Math.round(totalOriginal * cambio * 100) / 100;
    let saldoTotal = Math.round(total * 100);
    const pago = Math.round(Math.max(0, Number(pedido.valor_pago) || 0) * cambio * 100) / 100;
    const status = pedido.status_pagamento || (pago >= total && total > 0 ? 'pago' : pago > 0 ? 'parcial' : 'nao_identificado');
    let saldoPago = Math.round(pago * 100);
    normalizado.itens.forEach((item, index) => {
      const linha = pedido.itens?.[index];
      const ultimo = index === normalizado.itens.length - 1;
      const valorTotal = ultimo ? saldoTotal : Math.round(item.valor_total * cambio * 100);
      saldoTotal -= valorTotal;
      const valorPago = ultimo ? saldoPago : Math.round(pago * 100 * (totalOriginal > 0 ? item.valor_total / totalOriginal : 0));
      saldoPago -= valorPago;
      itens.push({ ...item,
        pedido_central_internal_id: pedido.id || '',
        data_emissao: pedido.data_pedido || pedido.data_emissao || item.data_emissao,
        data_vencimento: linha?.data_vencimento || pedido.data_vencimento || (/^\d{4}-\d{2}-\d{2}$/.test(pedido.prazo_pagamento || '') ? pedido.prazo_pagamento : ''),
        data_pagamento_informada: pedido.data_pagamento || '',
        moeda_original: moeda, taxa_cambio: cambio, valor_original: item.valor_total,
        valor_total: valorTotal / 100, valor_unitario: Math.round(item.valor_unitario * cambio * 100) / 100,
        status_pagamento: status,
        valor_pago: status === 'pago' ? valorTotal / 100 : valorPago / 100,
      });
    });
    fornecedores.push(...normalizado.fornecedores.map(f => ({ ...f, total: Math.round(f.total * cambio * 100) / 100 })));
  }
  const porFornecedor = new Map();
  for (const f of fornecedores) {
    const atual = porFornecedor.get(f.nome) || { nome: f.nome, total: 0, pedidos: 0 };
    atual.total += f.total; atual.pedidos += f.pedidos;
    porFornecedor.set(f.nome, atual);
  }
  return { itens, fornecedores: [...porFornecedor.values()].sort((a, b) => b.total - a.total) };
}