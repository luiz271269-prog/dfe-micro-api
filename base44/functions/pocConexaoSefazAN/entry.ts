import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import forge from 'npm:node-forge@1.3.1';
import { getCertSecret } from '../../shared/certSecrets.ts';

const ENDPOINT_PROD = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const ENDPOINT_HOM = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

function maskCnpj(cnpj) {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/****-${d.slice(12,14)}`;
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const body = await req.json();
    const { certificado_id } = body || {};
    if (!certificado_id) return Response.json({ ok: false, motivo: 'certificado_id obrigatório' }, { status: 400 });

    const certs = await base44.asServiceRole.entities.CertificadoDigitalNFe.filter({ id: certificado_id });
    const cdoc = certs?.[0];
    if (!cdoc) return Response.json({ ok: false, motivo: 'Certificado não encontrado' }, { status: 404 });
    if (cdoc.status_validacao !== 'valido') {
      return Response.json({
        ok: false,
        motivo: `Certificado precisa estar com status "valido" para rodar a POC (atual: ${cdoc.status_validacao})`
      }, { status: 400 });
    }

    // Resolve a senha apenas via allowlist estática — nunca acesso dinâmico ao env
    const { key: secretNameNormalizado, senha, permitido } = getCertSecret(cdoc.senha_secret_name);
    if (!permitido || !senha) {
      return Response.json({
        ok: false,
        motivo: `Secret "${secretNameNormalizado}" ${permitido ? 'não configurado no runtime' : 'não é um secret de certificado permitido'}`,
      }, { status: 400 });
    }

    const endpoint = cdoc.ambiente === 'producao' ? ENDPOINT_PROD : ENDPOINT_HOM;

    // 1. Baixar PFX e validar senha/estrutura (PFX → PEM)
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: cdoc.file_uri, expires_in: 60 });
    const pfxResp = await fetch(signed_url);
    if (!pfxResp.ok) return Response.json({ ok: false, motivo: `Falha ao baixar PFX: HTTP ${pfxResp.status}` }, { status: 500 });
    const pfxBuffer = new Uint8Array(await pfxResp.arrayBuffer());

    try {
      const p12Der = forge.util.binary.raw.encode(pfxBuffer);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);
      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
      const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
                  || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
      if (!certBag || !keyBag) return Response.json({ ok: false, motivo: 'PFX sem certificado ou chave privada' }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, motivo: `Falha ao extrair PFX→PEM: ${e.message}` }, { status: 400 });
    }

    // 2. mTLS direto não é suportado no runtime de backend functions do Base44 → Plano B
    const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
      request_id: `poc_${Date.now()}`,
      empresa: cdoc.empresa,
      cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
      data_execucao: new Date().toISOString(),
      duracao_ms: Date.now() - t0,
      status_final: 'erro',
      mensagem: 'Cliente HTTP mTLS indisponível no runtime — necessário Plano B (micro-API externa Node + mTLS). PFX e senha validados com sucesso.',
      endpoint,
    });
    return Response.json({
      ok: false,
      plano_b_necessario: true,
      motivo: 'O runtime do Base44 não expõe cliente HTTP mTLS — não dá pra fazer mTLS direto daqui. PFX e senha foram validados com sucesso.',
      proximo_passo: 'Subir micro-API Node em Cloud Run / Railway / VPS que receba a chamada do Base44, abra o PFX, faça mTLS e devolva o XML.',
      empresa: cdoc.empresa,
      cnpj_mascarado: maskCnpj(cdoc.cnpj_sem_mascara),
      ambiente: cdoc.ambiente,
      endpoint,
      duracao_ms: Date.now() - t0,
      log_id: log.id,
    });
  } catch (error) {
    console.error('pocConexaoSefazAN erro:', error);
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
});