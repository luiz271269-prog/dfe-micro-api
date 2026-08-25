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