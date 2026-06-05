import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import forge from 'npm:node-forge@1.3.1';

const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
const ENDPOINT_PROD = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const ENDPOINT_HOM = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const COD_UF_SC = '42';

function maskCnpj(cnpj) {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/****-${d.slice(12,14)}`;
}

function buildSoapEnvelope({ cUF, tpAmb, cnpj, ultNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUF}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${ultNSU}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

function extractInfo(xml) {
  const m = (re) => { const x = xml.match(re); return x ? x[1] : null; };
  const cstat = m(/<cStat>(\d+)<\/cStat>/);
  return {
    cstat: cstat ? parseInt(cstat) : null,
    xMotivo: m(/<xMotivo>([^<]+)<\/xMotivo>/),
    ultNSU: m(/<ultNSU>(\d+)<\/ultNSU>/),
    maxNSU: m(/<maxNSU>(\d+)<\/maxNSU>/),
  };
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const body = await req.json();
    const { certificado_id, ultNSU = '000000000000000' } = body || {};
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

    const senha = Deno.env.get(cdoc.senha_secret_name);
    if (!senha) return Response.json({ ok: false, motivo: `Secret ${cdoc.senha_secret_name} não configurado` }, { status: 400 });

    const endpoint = cdoc.ambiente === 'producao' ? ENDPOINT_PROD : ENDPOINT_HOM;
    const tpAmb = cdoc.ambiente === 'producao' ? '1' : '2';

    // POC checkpoint 0: Deno.createHttpClient disponível?
    if (typeof Deno.createHttpClient !== 'function') {
      const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
        request_id: `poc_${Date.now()}`,
        empresa: cdoc.empresa,
        cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
        data_execucao: new Date().toISOString(),
        duracao_ms: Date.now() - t0,
        status_final: 'erro',
        mensagem: 'Deno.createHttpClient indisponível no runtime — necessário Plano B (micro-API externa Node + mTLS).',
        endpoint,
      });
      return Response.json({
        ok: false,
        plano_b_necessario: true,
        motivo: 'O runtime do Base44 (Deno Deploy) não expõe Deno.createHttpClient — não dá pra fazer mTLS direto daqui.',
        proximo_passo: 'Subir micro-API Node em Cloud Run / Railway / VPS que receba a chamada do Base44, abra o PFX, faça mTLS e devolva o XML.',
        log_id: log.id,
      });
    }

    // 1. Baixar PFX
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: cdoc.file_uri, expires_in: 60 });
    const pfxResp = await fetch(signed_url);
    if (!pfxResp.ok) return Response.json({ ok: false, motivo: `Falha ao baixar PFX: HTTP ${pfxResp.status}` }, { status: 500 });
    const pfxBuffer = new Uint8Array(await pfxResp.arrayBuffer());

    // 2. PFX → PEM (cert + key)
    let certPem, keyPem;
    try {
      const p12Der = forge.util.binary.raw.encode(pfxBuffer);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
      const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
                  || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];

      if (!certBag || !keyBag) return Response.json({ ok: false, motivo: 'PFX sem certificado ou chave privada' }, { status: 400 });

      certPem = forge.pki.certificateToPem(certBag.cert);
      keyPem = forge.pki.privateKeyToPem(keyBag.key);
    } catch (e) {
      return Response.json({ ok: false, motivo: `Falha ao extrair PFX→PEM: ${e.message}` }, { status: 400 });
    }

    // 3. Criar httpClient mTLS
    let client;
    try {
      client = Deno.createHttpClient({ cert: certPem, key: keyPem });
    } catch (e) {
      return Response.json({
        ok: false,
        plano_b_necessario: true,
        motivo: `Deno.createHttpClient lançou erro: ${e.message}. Necessário Plano B.`,
      }, { status: 500 });
    }

    // 4. Montar e enviar SOAP
    const envelope = buildSoapEnvelope({ cUF: COD_UF_SC, tpAmb, cnpj: cdoc.cnpj_sem_mascara, ultNSU });

    let resp, respText, httpStatus;
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': SOAP_ACTION,
        },
        body: envelope,
        client,
      });
      httpStatus = resp.status;
      respText = await resp.text();
    } catch (e) {
      const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
        request_id: `poc_${Date.now()}`,
        empresa: cdoc.empresa,
        cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
        data_execucao: new Date().toISOString(),
        duracao_ms: Date.now() - t0,
        status_final: 'erro',
        mensagem: `Falha de rede/TLS: ${e.message}`,
        endpoint,
      });
      return Response.json({ ok: false, motivo: `Erro de rede/TLS: ${e.message}`, log_id: log.id }, { status: 500 });
    }

    // 5. Parse cStat
    const parsed = extractInfo(respText);
    const sucesso = parsed.cstat === 137 || parsed.cstat === 138;

    const statusFinal = parsed.cstat === 138 ? 'ok'
      : parsed.cstat === 137 ? 'sem_novos'
      : parsed.cstat === 656 ? 'bloqueado_consumo'
      : 'erro';

    const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
      request_id: `poc_${Date.now()}`,
      empresa: cdoc.empresa,
      cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
      data_execucao: new Date().toISOString(),
      duracao_ms: Date.now() - t0,
      nsu_inicial: ultNSU,
      nsu_final: parsed.ultNSU || ultNSU,
      max_nsu_servidor: parsed.maxNSU || null,
      cstat: parsed.cstat,
      x_motivo: parsed.xMotivo,
      status_final: statusFinal,
      mensagem: `POC: HTTP ${httpStatus} · cStat=${parsed.cstat} · ${parsed.xMotivo || ''}`,
      endpoint,
    });

    let diagnostico;
    if (parsed.cstat === 138) diagnostico = '✅✅ Conexão mTLS funcionou E há documentos disponíveis. Plano A 100% viável.';
    else if (parsed.cstat === 137) diagnostico = '✅ Conexão mTLS funcionou (sem novos documentos no momento). Plano A viável.';
    else if (parsed.cstat === 656) diagnostico = '⏱️ Rate limit: CNPJ bloqueado por 1h pelo AN. Aguarde antes de tentar de novo.';
    else if (parsed.cstat === 280 || parsed.cstat === 281) diagnostico = '🔐 Certificado rejeitado pelo AN (verifique cadeia / e-CNPJ válido).';
    else if (parsed.cstat === 215) diagnostico = '⚠️ Schema inválido — pode ser que o AN exija assinatura XMLDSig.';
    else diagnostico = `⚠️ cStat ${parsed.cstat} — veja xMotivo e XML bruto.`;

    return Response.json({
      ok: sucesso,
      http_status: httpStatus,
      cstat: parsed.cstat,
      x_motivo: parsed.xMotivo,
      ult_nsu: parsed.ultNSU,
      max_nsu: parsed.maxNSU,
      empresa: cdoc.empresa,
      cnpj_mascarado: maskCnpj(cdoc.cnpj_sem_mascara),
      ambiente: cdoc.ambiente,
      endpoint,
      duracao_ms: Date.now() - t0,
      log_id: log.id,
      resposta_xml_preview: (respText || '').slice(0, 2000),
      diagnostico,
    });
  } catch (error) {
    console.error('pocConexaoSefazAN erro:', error);
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
});