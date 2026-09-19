function validarConfiguracao(url, token) {
  const invalida = { ok: false, endpoint: null, motivo: 'DFE_MICRO_API_URL inválida: informe a URL HTTPS real do serviço publicado no Render, sem usuário, senha, parâmetros ou /health. Não use senha ou token neste campo.' };
  if (typeof url !== 'string' || !url.trim()) return invalida;
  let parsed;
  try { parsed = new URL(url.trim()); } catch { return invalida; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return invalida;
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, endpoint: null, motivo: 'Configure DFE_MICRO_API_TOKEN com o mesmo token DFE_API_TOKEN do Render.' };
  }
  return { ok: true, baseUrl: parsed.origin };
}

export async function consultarSaudeDFeMicroApi({ url, token, requestId }) {
  const config = validarConfiguracao(url, token);
  if (!config.ok) return config;

  const endpoint = `${config.baseUrl}/health`;
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
    if (body?.ok !== true || body?.servico !== 'nexus-dfe-neuraltec') {
      return { ok: false, endpoint, http_status: response.status, motivo: 'O endereço respondeu, mas não é uma resposta válida da micro-API DFe NeuralTec.' };
    }
    if (body.certificado_configurado !== true || body.cnpj_configurado !== true) {
      return { ok: false, endpoint, http_status: response.status, motivo: 'Micro-API online, mas a configuração fiscal está incompleta: confira CNPJ_NEURALTEC, CERT_PFX_BASE64 e CERT_PFX_PASSWORD no Render.' };
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
  const config = validarConfiguracao(url, token);
  if (!config.ok) return config;

  const endpoint = `${config.baseUrl}/dfe/distribuicao`;
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