import { createClient } from 'npm:@base44/sdk@0.8.59';
import { secrets } from 'base44:runtime';

const APP_ID = '69c530ac2befe8eafb45b38d';

// Acesso direto, somente leitura, restrito aos pedidos da Central de Compras.
export async function consultarPedidosCentral() {
  const token = secrets.get('centra_compras_api_key');
  const diagnostico = { app_id: APP_ID, header: 'Authorization: Bearer', entity: 'PedidoCompra', status: null };
  const falha = (motivo) => ({ ok: false, status: diagnostico.status, motivo, diagnostico, data: [] });
  if (!token) return falha('Configure centra_compras_api_key com um token de acesso que permita ler os pedidos da Central de Compras.');
  try {
    const central = createClient({ appId: APP_ID, headers: { Authorization: `Bearer ${token}` } });
    const data = [];
    let cursor;
    for (let pagina = 0; pagina < 20; pagina++) {
      const resultado = await central.entities.PedidoCompra.list({ sort: '-created_date', limit: 500, ...(cursor ? { cursor } : {}) });
      if (!resultado || !Array.isArray(resultado.items)) return falha('A Central de Compras retornou uma lista de pedidos em formato inesperado.');
      data.push(...resultado.items);
      if (!resultado.has_more) {
        diagnostico.status = 200;
        return { ok: true, status: 200, data, header: 'Authorization: Bearer', diagnostico };
      }
      if (!resultado.next_cursor || resultado.next_cursor === cursor) return falha('A Central de Compras não informou uma continuação válida da consulta.');
      cursor = resultado.next_cursor;
    }
    return falha('A consulta excedeu 10.000 pedidos. Nenhuma lista parcial foi utilizada.');
  } catch (error) {
    diagnostico.status = Number(error?.status || error?.response?.status) || null;
    if (diagnostico.status === 401) return falha('A Central de Compras recusou o token Bearer de centra_compras_api_key (HTTP 401). Confira se o segredo contém um token de acesso válido para o aplicativo informado.');
    if (diagnostico.status === 403) return falha('O token de centra_compras_api_key não tem permissão de leitura dos pedidos da Central de Compras (HTTP 403).');
    if (diagnostico.status === 404) return falha('O aplicativo ou a entidade PedidoCompra não foi encontrado na Central de Compras (HTTP 404).');
    return falha(`Não foi possível consultar diretamente a Central de Compras${diagnostico.status ? ` (HTTP ${diagnostico.status})` : ''}.`);
  }
}