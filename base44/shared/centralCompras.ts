// Integração com a Central de Compras (app Base44 irmão — cotações e ordens de compra).
// A chave vem exclusivamente do secret CENTRAL_COMPRAS_API_KEY.
import { secrets } from 'base44:runtime';

export const CENTRAL_COMPRAS_APP_ID = '69c530ac2befe8eafb45b38d';
export const CENTRAL_COMPRAS_API_BASE = `https://app.base44.com/api/apps/${CENTRAL_COMPRAS_APP_ID}/entities`;

export function getCentralComprasKey() {
  const key = secrets.get('CENTRAL_COMPRAS_API_KEY');
  if (!key) throw new Error('Secret CENTRAL_COMPRAS_API_KEY não configurado');
  return key;
}

/**
 * Busca uma entidade na Central de Compras testando os formatos de header
 * aceitos pela API do Base44 (api_key, x-api-key, Authorization Bearer).
 * Retorna { ok, status, data, header } — header indica qual formato funcionou.
 */
export async function fetchCentralCompras(entityName, query = 'limit=500') {
  const key = getCentralComprasKey();
  const url = `${CENTRAL_COMPRAS_API_BASE}/${entityName}?${query}`;
  const tentativas = [
    { nome: 'api_key', headers: { api_key: key } },
    { nome: 'x-api-key', headers: { 'x-api-key': key } },
    { nome: 'bearer', headers: { Authorization: `Bearer ${key}` } },
  ];

  let ultimoStatus = 0;
  for (const t of tentativas) {
    const res = await fetch(url, { headers: { ...t.headers, 'Content-Type': 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      const data = Array.isArray(json) ? json : (json.results || json.data || []);
      return { ok: true, status: res.status, data, header: t.nome };
    }
    ultimoStatus = res.status;
  }
  return { ok: false, status: ultimoStatus, data: [], header: null };
}

const CATEGORIAS = ['notebook','tablet','smartphone','componente','memoria','armazenamento','periferico','software','rede','outro'];
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
      });
    });
  }
  return { itens, fornecedores: [...fornecedores.values()].sort((a, b) => b.total - a.total) };
}