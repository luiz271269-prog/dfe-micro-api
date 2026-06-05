import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import forge from 'npm:node-forge@1.3.1';

const ENDPOINTS = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

function maskCnpj(c) {
  const d = (c || '').replace(/\D/g, '');
  if (d.length !== 14) return c || '';
  return `${d.substr(0,2)}.${d.substr(2,3)}.${d.substr(5,3)}/****-${d.substr(12,2)}`;
}

function extractCnpjFromCert(cert) {
  try {
    const ext = cert.extensions?.find(e => e.name === 'subjectAltName');
    if (ext?.altNames) {
      for (const alt of ext.altNames) {
        if (alt.value) {
          const m = String(alt.value).match(/\d{14}/);
          if (m) return m[0];
        }
      }
    }
  } catch { /* noop */ }
  try {
    const cn = cert.subject.getField('CN')?.value || '';
    const m = cn.match(/(\d{14})/);
    if (m) return m[1];
  } catch { /* noop */ }
  return null;
}

function montarEnvelope({ tpAmb, cUFAutor, CNPJ, ultNSU }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeDistDFeInteresse>
      <nfe:nfeDadosMsg>
        <distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUFAutor}</cUFAutor>
          <CNPJ>${CNPJ}</CNPJ>
          <distNSU><ultNSU>${String(ultNSU).padStart(15, '0')}</ultNSU></distNSU>
        </distDFeInt>
      </nfe:nfeDadosMsg>
    </nfe:nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;
}

function parseResposta(xml) {
  const m = (re) => { const r = xml.match(re); return r ? r[1] : null; };
  return {
    cStat: parseInt(m(/<cStat>(\d+)<\/cStat>/) || '0', 10) || null,
    xMotivo: m(/<xMotivo>([^<]+)<\/xMotivo>/),
    ultNSU: m(/<ultNSU>(\d+)<\/ultNSU>/),
    maxNSU: m(/<maxNSU>(\d+)<\/maxNSU>/),
    dhResp: m(/<dhResp>([^<]+)<\/dhResp>/),
  };
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  let empresa = 'NeuralTec';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { certificado_id } = body;
    if (!certificado_id) return Response.json({ error: 'certificado_id obrigatório' }, { status: 400 });

    const cert = await base44.entities.CertificadoDigitalNFe.get(certificado_id);
    if (!cert) return Response.json({ error: 'Certificado não encontrado' }, { status: 404 });
    empresa = cert.empresa;
    if (cert.status_validacao !== 'valido') {
      return Response.json({ ok: false, error: 'Valide o certificado primeiro (status atual: ' + cert.status_validacao + ')' });
    }

    const senha = Deno.env.get(cert.senha_secret_name);
    if (!senha) return Response.json({ ok: false, error: `Secret "${cert.senha_secret_name}" ausente.` });

    // 1. Baixar PFX
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
      file_uri: cert.file_uri,
      expires_in: 300,
    });
    const resp = await fetch(signed_url);
    if (!resp.ok) throw new Error(`Falha ao baixar PFX: HTTP ${resp.status}`);
    const pfxBuffer = new Uint8Array(await resp.arrayBuffer());

    // 2. PFX → PEM
    const p12Der = forge.util.binary.raw.encode(pfxBuffer);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

    let x509cert = null;
    let privateKey = null;
    for (const sb of p12.safeContents) {
      for (const sBag of sb.safeBags) {
        if (sBag.cert) x509cert = sBag.cert;
        if (sBag.key) privateKey = sBag.key;
      }
    }
    if (!x509cert || !privateKey) throw new Error('PFX sem cert ou chave privada');

    const certPem = forge.pki.certificateToPem(x509cert);
    const keyPem = forge.pki.privateKeyToPem(privateKey);
    const cnpjUso = extractCnpjFromCert(x509cert) || (cert.cnpj_sem_mascara || '').replace(/\D/g, '');
    if (!cnpjUso || cnpjUso.length !== 14) throw new Error('CNPJ inválido extraído do certificado');

    // 3. Cliente mTLS (Deno unstable API)
    let httpClient;
    try {
      httpClient = Deno.createHttpClient({ certChain: certPem, privateKey: keyPem });
    } catch (e) {
      throw new Error(`mTLS não suportado neste runtime: ${e.message}. Plano B (micro-API externa) será necessário.`);
    }

    // 4. SOAP envelope (cUFAutor 42 = SC)
    const envelope = montarEnvelope({
      tpAmb: cert.ambiente === 'producao' ? '1' : '2',
      cUFAutor: '42',
      CNPJ: cnpjUso,
      ultNSU: '0',
    });

    // 5. POST mTLS
    const url = ENDPOINTS[cert.ambiente];
    const sefazResp = await fetch(url, {
      method: 'POST',
      client: httpClient,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
      },
      body: envelope,
    });

    const responseXml = await sefazResp.text();
    try { httpClient.close?.(); } catch { /* noop */ }

    const { cStat, xMotivo, ultNSU, maxNSU, dhResp } = parseResposta(responseXml);

    // 137 = sem documentos · 138 = documentos localizados · ambos = SUCESSO da conexão
    const conexaoOk = sefazResp.ok && (cStat === 137 || cStat === 138);
    // 656 = consumo indevido (cooldown SEFAZ)
    const rateLimit = cStat === 656;

    await base44.entities.LogSyncSEFAZ.create({
      empresa,
      cnpj_sem_mascara: maskCnpj(cnpjUso),
      data_execucao: new Date().toISOString(),
      duracao_ms: Date.now() - startedAt,
      cstat: cStat || 0,
      nsu_inicial: '000000000000000',
      nsu_final: ultNSU || '',
      max_nsu_servidor: maxNSU || '',
      status_final: conexaoOk ? 'poc' : (rateLimit ? 'bloqueado_consumo' : 'erro'),
      mensagem: xMotivo || `HTTP ${sefazResp.status}`,
      detalhes: (responseXml || '').substring(0, 4000),
      tipo_operacao: 'poc_conexao',
    });

    return Response.json({
      ok: conexaoOk,
      http_status: sefazResp.status,
      cStat,
      xMotivo,
      ultNSU,
      maxNSU,
      dhResp,
      endpoint: url,
      cnpj_usado: maskCnpj(cnpjUso),
      response_preview: (responseXml || '').substring(0, 1500),
      diagnostico: conexaoOk
        ? '✓ mTLS funcionou. Conexão fiscal estabelecida sem XMLDSig. Pode avançar para Fase 1.1.'
        : rateLimit
          ? '⚠ Consumo indevido (cooldown SEFAZ de 1h). Tente novamente depois.'
          : `✗ Falha. cStat=${cStat}. Analise o XML de resposta abaixo.`,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      await base44.entities.LogSyncSEFAZ.create({
        empresa,
        data_execucao: new Date().toISOString(),
        duracao_ms: Date.now() - startedAt,
        status_final: 'erro',
        mensagem: error.message,
        tipo_operacao: 'poc_conexao',
      });
    } catch { /* noop */ }
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});