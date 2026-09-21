import { createServer } from 'node:http';
import { autorizado } from './auth.js';
import { permitirConsulta } from './rateLimit.js';
import { distribuirDFe, manifestarCiencia } from './sefaz.js';
import { enriquecerDocZip } from './parser.js';
import { gerarDanfeHtml } from './danfe.js';
import { notificarBase44 } from './webhook.js';
import { iniciarAgendador } from './scheduler.js';

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

const CACHE_MAX = 500;
const MAX_OUTPUT_BYTES = 24 * 1024 * 1024;
const cacheNotas = new Map();
let sessaoFiscal = null;

function guardarNota(documento) {
  cacheNotas.delete(documento.dados_estruturados.chave_acesso);
  cacheNotas.set(documento.dados_estruturados.chave_acesso, documento);
  while (cacheNotas.size > CACHE_MAX) cacheNotas.delete(cacheNotas.keys().next().value);
}

async function processarDistribuicao(config, requestId) {
  const resultado = await distribuirDFe(config);
  if (resultado.cstat !== 138 || !resultado.docZips?.length) return { ...resultado, requestId, webhook: null };

  const enriquecidos = [];
  const chavesNovas = [];
  let tamanho = 0;
  for (const docZip of resultado.docZips.slice(0, 50)) {
    const enriquecido = enriquecerDocZip(docZip);
    const chave = enriquecido.dados_estruturados.chave_acesso;
    let manifestacao = null;
    if (chave) {
      try { manifestacao = await manifestarCiencia({ ...config, chave }); }
      catch (error) { manifestacao = { ok: false, cstat: null, xMotivo: error.message, evento: '210210' }; }
    }
    const documento = {
      nsu: enriquecido.nsu, schema: enriquecido.schema, data: enriquecido.data,
      xml_base64: enriquecido.xml_base64,
      dados_estruturados: enriquecido.dados_estruturados,
      danfe_html: gerarDanfeHtml(enriquecido.dados_estruturados),
      manifestacao,
    };
    const bytes = Buffer.byteLength(JSON.stringify(documento));
    if (enriquecidos.length && tamanho + bytes > MAX_OUTPUT_BYTES) break;
    tamanho += bytes;
    enriquecidos.push(documento);
    if (chave) { guardarNota(documento); chavesNovas.push(chave); }
  }

  const truncado = enriquecidos.length < resultado.docZips.length;
  const ultNSU = truncado ? enriquecidos.at(-1)?.nsu : resultado.ultNSU;
  const webhook = chavesNovas.length ? await notificarBase44({ empresa: 'NeuralTec', cnpj: config.cnpj, chaves_novas: chavesNovas, request_id: requestId }) : null;
  return { ...resultado, ultNSU, docZips: enriquecidos, paginacao: { limite: 50, truncado, proximo_ult_nsu: ultNSU }, webhook, requestId };
}

iniciarAgendador(async () => {
  if (!sessaoFiscal || Date.now() < sessaoFiscal.bloqueadoAte) return;
  const requestId = `auto_${Date.now()}`;
  const resultado = await processarDistribuicao(sessaoFiscal, requestId);
  if (resultado.ultNSU) sessaoFiscal.ultNSU = resultado.ultNSU;
  sessaoFiscal.bloqueadoAte = Date.now() + 60 * 60 * 1000;
  console.log(`[${requestId}] cStat ${resultado.cstat}, ${resultado.docZips?.length || 0} documento(s).`);
});

createServer(async (req, res) => {
  const requestId = req.headers['x-request-id'] || `dfe_${Date.now()}`;
  if (req.method === 'GET' && req.url === '/live') return json(res, 200, { ok: true });
  if (!autorizado(req)) return json(res, 401, { ok: false, motivo: 'Não autorizado.', requestId });

  if (req.method === 'GET' && req.url === '/health') return json(res, 200, {
    ok: true, servico: 'nexus-dfe-neuraltec', certificado_origem: 'base44_request',
    cnpj_configurado: CNPJ_NEURALTEC.length === 14, webhook_configurado: Boolean(process.env.NEXUS_HUB_TOKEN),
    agendamento_ativo: Boolean(sessaoFiscal), cache_notas: cacheNotas.size, requestId,
  });

  const detalhe = req.method === 'GET' ? req.url?.match(/^\/dfe\/nota\/(\d{44})$/) : null;
  if (detalhe) {
    const documento = cacheNotas.get(detalhe[1]);
    return documento ? json(res, 200, { ok: true, documento, requestId }) : json(res, 404, { ok: false, motivo: 'NF-e não localizada no cache transitório. Execute nova distribuição.', requestId });
  }
  if (req.method !== 'POST' || req.url !== '/dfe/distribuicao') return json(res, 404, { ok: false, motivo: 'Rota não encontrada.', requestId });

  const limite = permitirConsulta();
  if (!limite.ok) { res.setHeader('Retry-After', String(limite.retryAfter)); return json(res, 429, { ok: false, motivo: 'Limite temporário de consultas atingido.', requestId }); }

  try {
    const body = await lerJson(req);
    const cnpj = String(body.cnpj || '').replace(/\D/g, '');
    const ambiente = body.ambiente === 'homologacao' ? 'homologacao' : 'producao';
    const ultNSU = String(body.ultNSU || '').padStart(15, '0');
    const certificadoPfxBase64 = String(body.certificado_pfx_base64 || '');
    const certificadoSenha = String(body.certificado_senha || '');
    const certificadoBytes = Buffer.byteLength(certificadoPfxBase64, 'base64');
    if (body.empresa !== 'NeuralTec' || cnpj !== CNPJ_NEURALTEC) return json(res, 403, { ok: false, motivo: 'Serviço restrito à NeuralTec.', requestId });
    if (!/^\d{14}$/.test(cnpj) || !/^\d{15}$/.test(ultNSU)) return json(res, 400, { ok: false, motivo: 'CNPJ ou NSU inválido.', requestId });
    if (!certificadoPfxBase64 || !certificadoSenha || !certificadoBytes || certificadoBytes > MAX_PFX_BYTES) return json(res, 400, { ok: false, motivo: 'Certificado privado ausente ou inválido.', requestId });

    const config = { cnpj, ambiente, ultNSU, certificadoPfxBase64, certificadoSenha };
    const resultado = await processarDistribuicao(config, requestId);
    sessaoFiscal = { ...config, ultNSU: resultado.ultNSU || ultNSU, bloqueadoAte: Date.now() + 60 * 60 * 1000 };
    return json(res, 200, resultado);
  } catch (error) {
    console.error(`[${requestId}]`, error.message);
    return json(res, 502, { ok: false, motivo: error.message, docZips: [], requestId });
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Nexus DFe ouvindo na porta ${PORT}`));