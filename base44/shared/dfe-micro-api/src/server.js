import { createServer } from 'node:http';
import { autorizado } from './auth.js';
import { permitirConsulta } from './rateLimit.js';
import { distribuirDFe } from './sefaz.js';

const PORT = Number(process.env.PORT || 3000);
const CNPJ_NEURALTEC = (process.env.CNPJ_NEURALTEC || '').replace(/\D/g, '');
const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024;
const MAX_PFX_BYTES = 2 * 1024 * 1024;
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

async function lerJson(req) {
  let texto = '';
  for await (const chunk of req) {
    texto += chunk;
    if (Buffer.byteLength(texto) > MAX_PAYLOAD_BYTES) throw new Error('Payload excede o limite de 3 MB.');
  }
  return texto ? JSON.parse(texto) : {};
}

createServer(async (req, res) => {
  const requestId = req.headers['x-request-id'] || `dfe_${Date.now()}`;
  // Sonda pública do Railway: somente disponibilidade, sem dados fiscais.
  if (req.method === 'GET' && req.url === '/live') {
    return json(res, 200, { ok: true });
  }
  if (!autorizado(req)) return json(res, 401, { ok: false, motivo: 'Não autorizado.', requestId });

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      servico: 'nexus-dfe-neuraltec',
      certificado_origem: 'base44_request',
      cnpj_configurado: CNPJ_NEURALTEC.length === 14,
      requestId,
    });
  }

  if (req.method !== 'POST' || req.url !== '/dfe/distribuicao') {
    return json(res, 404, { ok: false, motivo: 'Rota não encontrada.', requestId });
  }

  const limite = permitirConsulta();
  if (!limite.ok) {
    res.setHeader('Retry-After', String(limite.retryAfter));
    return json(res, 429, { ok: false, motivo: 'Limite temporário de consultas atingido.', requestId });
  }

  try {
    const body = await lerJson(req);
    const cnpj = String(body.cnpj || '').replace(/\D/g, '');
    const ambiente = body.ambiente === 'homologacao' ? 'homologacao' : 'producao';
    const ultNSU = String(body.ultNSU || '').padStart(15, '0');
    const certificadoPfxBase64 = String(body.certificado_pfx_base64 || '');
    const certificadoSenha = String(body.certificado_senha || '');
    const certificadoBytes = Buffer.byteLength(certificadoPfxBase64, 'base64');

    if (body.empresa !== 'NeuralTec' || cnpj !== CNPJ_NEURALTEC) {
      return json(res, 403, { ok: false, motivo: 'Serviço restrito à NeuralTec.', requestId });
    }
    if (!/^\d{14}$/.test(cnpj) || !/^\d{15}$/.test(ultNSU)) {
      return json(res, 400, { ok: false, motivo: 'CNPJ ou NSU inválido.', requestId });
    }
    if (!certificadoPfxBase64 || !certificadoSenha || !certificadoBytes || certificadoBytes > MAX_PFX_BYTES) {
      return json(res, 400, { ok: false, motivo: 'Certificado privado ausente ou inválido.', requestId });
    }

    const resultado = await distribuirDFe({
      cnpj,
      ambiente,
      ultNSU,
      certificadoPfxBase64,
      certificadoSenha,
    });
    return json(res, 200, { ...resultado, requestId });
  } catch (error) {
    console.error(`[${requestId}]`, error.message);
    return json(res, 502, { ok: false, motivo: error.message, docZips: [], requestId });
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Nexus DFe ouvindo na porta ${PORT}`));