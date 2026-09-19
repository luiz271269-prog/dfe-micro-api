import { timingSafeEqual } from 'node:crypto';

export function autorizado(request) {
  const recebido = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const esperado = process.env.DFE_API_TOKEN || '';
  if (!recebido || !esperado) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}