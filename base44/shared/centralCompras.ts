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