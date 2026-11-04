import { consultarPedidosCentral } from './centralComprasConsulta.ts';

// Transporte único: API direta de entidades, com o token centra_compras_api_key.
// Mantém o contrato de leitura dos consumidores.
export async function fetchCentralCompras(entityName) {
  if (entityName !== 'PedidoCompra') {
    throw new Error('A integração da Central de Compras permite apenas PedidoCompra.');
  }
  return consultarPedidosCentral();
}

const CATEGORIAS = ['notebook','tablet','smartphone','componente','memoria','armazenamento','periferico','software','rede','outro'];

export function normalizarFormaPagamento(valor = '') {
  const v = String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/cartao|visa|master|elo|amex|mercadopago/.test(v)) return 'cartao';
  if (/pix/.test(v)) return 'banco_pix';
  if (/boleto|duplicata|prazo|soft\s*\d+\s*dias|\bdd\w*\b|^\d{2}\/\d{2}\/\d{4}$|^b\d+c/.test(v)) return 'banco_boleto';
  if (/sem juros|\b\d+x\b/.test(v)) return 'cartao';
  if (/deposito|\bdep\b|transferencia|conta corrente|dpcc|ted/.test(v)) return 'banco_transferencia';
  if (/dinheiro|especie|al contado/.test(v)) return 'dinheiro';
  return 'nao_definida';
}

const categoria = (valor) => {
  const v = (valor || '').toString().toLowerCase().trim();
  return CATEGORIAS.includes(v) ? v : 'outro';
};

export function normalizarPedidosCompra(pedidos = []) {
  const itens = [];
  const fornecedores = new Map();
  for (const p of pedidos) {
    const fornecedor = (p.fornecedor_nome || p.fornecedor || 'Sem fornecedor').trim();
    const data = p.data_pedido || p.created_date?.slice(0, 10) || '';
    const atual = fornecedores.get(fornecedor.toLowerCase()) || { nome: fornecedor, total: 0, pedidos: 0 };
    atual.total += Number(p.valor_total) || 0;
    atual.pedidos += 1;
    fornecedores.set(fornecedor.toLowerCase(), atual);
    const linhas = Array.isArray(p.itens) && p.itens.length ? p.itens : [{}];
    linhas.forEach((it, idx) => {
      const quantidade = Number(it.quantidade) || 1;
      const valorUnitario = it.valor_unitario ?? (it.valor_total ? Number(it.valor_total) / quantidade : p.valor_total || 0);
      itens.push({
        id: `${p.id || p.numero_pedido || 'pedido'}-${idx}`,
        pedido: p.numero_pedido || '', pedido_central_id: p.numero_pedido || p.id || '',
        data_emissao: data, descricao_produto: it.descricao || it.produto || `Pedido ${p.numero_pedido || ''}`.trim(),
        fornecedor, empresa: p.empresa || '', tipo_compra: 'estoque', categoria_produto: categoria(it.categoria),
        quantidade, valor_unitario: Number(valorUnitario) || 0,
        valor_total: Number(it.valor_total ?? (Number(valorUnitario) * quantidade)) || 0,
        numero_nota: p.nota_fiscal_numero || '', status_pagamento: p.status_pagamento || '',
        forma_pagamento: normalizarFormaPagamento(p.condicao_pagamento || p.forma_pagamento),
        condicao_pagamento: p.condicao_pagamento || p.forma_pagamento || '',
      });
    });
  }
  return { itens, fornecedores: [...fornecedores.values()].sort((a, b) => b.total - a.total) };
}