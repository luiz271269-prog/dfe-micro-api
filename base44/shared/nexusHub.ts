import { secrets } from 'base44:runtime';

const ENDPOINT = 'https://nexus-cotacoes360.base44.app/functions/nexus360Api';

// Consulta restrita a pedidos; nunca persiste dados nem aceita destinos do cliente.
export async function consultarPedidosHub() {
  const token = secrets.get('CENTRAL_COMPRAS_API_KEY') || secrets.get('centra_compras_api_key');
  const diagnostico = { endpoint: ENDPOINT, header: 'x-hub-token', entity: 'PedidoCompra', status: null };
  const falha = (motivo) => ({ ok: false, status: diagnostico.status, motivo, diagnostico, data: [] });
  if (!token) return falha('Configure a chave da Central de Compras para autorizar a consulta.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-hub-token': token },
      body: JSON.stringify({ entity: 'PedidoCompra' }), signal: controller.signal,
    });
    diagnostico.status = response.status;
    if (!response.ok) {
      if (response.status === 401) return falha('A Central de Compras recusou a chave (HTTP 401). Confira se a chave configurada aqui corresponde ao NEXUS_HUB_TOKEN do Nexus Cotações.');
      if (response.status === 403) return falha('A Central de Compras não autorizou a leitura dos pedidos (HTTP 403).');
      return falha(`A Central de Compras respondeu HTTP ${response.status}.`);
    }
    const body = await response.json();
    if (body?.ok === false || body?.error) return falha('A Central de Compras informou falha na consulta dos pedidos.');
    const data = Array.isArray(body) ? body : body?.data ?? body?.items ?? body?.results ?? body?.records;
    if (!Array.isArray(data)) return falha('Resposta da Central de Compras fora do formato esperado: lista de pedidos ausente.');
    return { ok: true, status: response.status, data, header: 'x-hub-token', diagnostico };
  } catch (error) {
    console.error('Consulta PedidoCompra:', String(error?.message || error).split(token).join('[redigido]'));
    return falha(error?.name === 'AbortError' ? 'Tempo limite de 30 segundos na consulta à Central de Compras.' : 'Não foi possível obter uma resposta válida da Central de Compras.');
  } finally {
    clearTimeout(timeout);
  }
}