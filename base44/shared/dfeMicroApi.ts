export async function consultarSaudeDFeMicroApi({ url, token, requestId }) {
  if (!url || !token) {
    return { ok: false, endpoint: url || null, motivo: 'Micro-API DFe não configurada.' };
  }

  const endpoint = `${url.replace(/\/$/, '')}/health`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Id': requestId,
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, endpoint, http_status: response.status, motivo: body?.motivo || `Health-check respondeu HTTP ${response.status}` };
    }
    return { ok: true, endpoint, http_status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      motivo: error?.name === 'AbortError'
        ? 'Timeout de 10s no health-check da micro-API DFe.'
        : `Falha no health-check da micro-API DFe: ${error.message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function consultarDistribuicaoDFeMicroApi({
  empresa,
  cnpj,
  ambiente,
  ultNSU,
  requestId,
  url,
  token,
}) {
  if (!url || !token) {
    return {
      ok: false,
      motivo: 'Micro-API DFe não configurada.',
      endpoint: url || null,
    };
  }

  const endpoint = `${url.replace(/\/$/, '')}/dfe/distribuicao`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({ empresa, cnpj, ambiente, ultNSU }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body) {
      return {
        ok: false,
        cstat: body?.cstat ?? null,
        xMotivo: body?.xMotivo ?? null,
        ultNSU: body?.ultNSU ?? null,
        maxNSU: body?.maxNSU ?? null,
        docZips: [],
        endpoint,
        http_status: response.status,
        motivo: body?.motivo || `Micro-API respondeu HTTP ${response.status}`,
      };
    }

    const cstat = Number(body.cstat);
    if (!Number.isFinite(cstat) || !Array.isArray(body.docZips)) {
      return {
        ok: false,
        cstat: null,
        xMotivo: null,
        ultNSU: null,
        maxNSU: null,
        docZips: [],
        endpoint,
        http_status: response.status,
        motivo: 'Resposta da micro-API fora do contrato fiscal.',
      };
    }

    return {
      ok: body.ok === true,
      cstat,
      xMotivo: body.xMotivo ?? null,
      ultNSU: body.ultNSU ?? null,
      maxNSU: body.maxNSU ?? null,
      docZips: body.docZips,
      endpoint,
      http_status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      cstat: null,
      xMotivo: null,
      ultNSU: null,
      maxNSU: null,
      docZips: [],
      endpoint,
      motivo: error?.name === 'AbortError'
        ? 'Timeout de 30s na micro-API DFe.'
        : `Falha no transporte da micro-API DFe: ${error.message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}