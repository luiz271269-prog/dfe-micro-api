import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { consultarDetalheNFeMicroApi } from '../../shared/dfeMicroApi.ts';
import { ingestirDocumentoNFe } from '../../shared/nfeIngestion.ts';

function tokenValido(recebido, esperado) {
  if (!recebido || !esperado || recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let index = 0; index < recebido.length; index += 1) diff |= recebido.charCodeAt(index) ^ esperado.charCodeAt(index);
  return diff === 0;
}

export default async function(req) {
  try {
    const recebido = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const esperado = String(secrets.get('NEXUS_HUB_TOKEN') || '').trim();
    if (!tokenValido(recebido, esperado)) return Response.json({ ok: false, motivo: 'Não autorizado.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const empresa = body.empresa === 'NeuralTec' ? body.empresa : null;
    const cnpj = String(body.cnpj || '').replace(/\D/g, '');
    const chaves = [...new Set(Array.isArray(body.chaves_novas) ? body.chaves_novas : [])].filter((chave) => /^\d{44}$/.test(chave)).slice(0, 50);
    if (!empresa || !/^\d{14}$/.test(cnpj) || !chaves.length) return Response.json({ ok: false, motivo: 'Payload fiscal inválido.' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const resultados = [];
    for (const chave of chaves) {
      const detalhe = await consultarDetalheNFeMicroApi({ chave, url: secrets.get('DFE_MICRO_API_URL'), token: secrets.get('DFE_MICRO_API_TOKEN'), requestId: body.request_id });
      if (!detalhe.ok) { resultados.push({ chave, status: 'erro', motivo: detalhe.motivo }); continue; }
      resultados.push(await ingestirDocumentoNFe(base44, { documento: detalhe.documento, empresa, origem: 'real', cnpjDestinatario: cnpj }));
    }
    const novos = resultados.filter((item) => item.status === 'novo').length;
    const duplicados = resultados.filter((item) => item.status === 'duplicado').length;
    return Response.json({ ok: true, request_id: body.request_id, novos, duplicados, resultados });
  } catch (error) {
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
}