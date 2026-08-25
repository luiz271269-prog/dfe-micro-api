// Integração com a Central de Compras (app Base44 irmão — cotações e ordens de compra).
// A chave preferencialmente vem do secret CENTRAL_COMPRAS_API_KEY (configurar na branch
// principal, em Dashboard → Settings → Environment Variables). Enquanto o secret não
// existir, usa a chave informada pelo proprietário do app.
import { secrets } from 'base44:runtime';

export const CENTRAL_COMPRAS_APP_ID = '69c530ac2befe8eafb45b38d';
export const CENTRAL_COMPRAS_API_BASE = `https://app.base44.com/api/apps/${CENTRAL_COMPRAS_APP_ID}/entities`;

const FALLBACK_KEY = '05144fd16725437eb63a8c60f1c8a7e6';

export function getCentralComprasKey() {
  try {
    return secrets.get('CENTRAL_COMPRAS_API_KEY') || FALLBACK_KEY;
  } catch {
    return FALLBACK_KEY;
  }
}