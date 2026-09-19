import { createServer } from 'node:http';
import { autorizado } from './auth.js';
import { distribuirDFe } from './sefaz.js';

const PORT = Number(process.env.PORT || 3000);
const CNPJ_NEURALTEC = (process.env.CNPJ_NEURALTEC || '').replace(/\D/g, '');
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

async function lerJson(req) {
  let texto = '';
  for await (const chunk of req) {
    texto += chunk;
    if (texto.length > 10000) throw new Error('Payload excede o limite permitido.');
  }
  return texto ? JSON.parse(texto) : {};
}

createServer(async (req, res) => {
  const requestId = req.headers['x-request-id'] || `dfe_${Date.now()}`;
  if (!autorizado(req)) return json(res, 401, { ok: false, motivo: 'Não autorizado.', requestId });

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      servico: 'nexus-dfe-neuraltec',
      certificado_configurado: Boolean(process.env.CERT_PFX_BASE64 && process.env.CERT_PFX_PASSWORD),
      cnpj_configurado: CNPJ_NEURALTEC.length === 14,
      requestId,
    });
  }

  if (req.method !== 'POST' || req.url !== '/dfe/distribuicao') {
    return json(res, 404, { ok: false, motivo: 'Rota não encontrada.', requestId });
  }

  try {
    const body = await lerJson(req);
    const cnpj = String(body.cnpj || '').replace(/\D/g, '');
    const ambiente = body.ambiente === 'homologacao' ? 'homologacao' : 'producao';
    const ultNSU = String(body.ultNSU || '').padStart(15, '0');

    if (body.empresa !== 'NeuralTec' || cnpj !== CNPJ_NEURALTEC) {
      return json(res, 403, { ok: false, motivo: 'Serviço restrito à NeuralTec.', requestId });
    }
    if (!/^\d{14}$/.test(cnpj) || !/^\d{15}$/.test(ultNSU)) {
      return json(res, 400, { ok: false, motivo: 'CNPJ ou NSU inválido.', requestId });
    }

    const resultado = await distribuirDFe({ cnpj, ambiente, ultNSU });
    return json(res, 200, { ...resultado, requestId });
  } catch (error) {
    console.error(`[${requestId}]`, error.message);
    return json(res, 502, { ok: false, motivo: error.message, docZips: [], requestId });
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Nexus DFe ouvindo na porta ${PORT}`));