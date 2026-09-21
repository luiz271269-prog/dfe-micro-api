import https from 'node:https';
import { assinarInfEvento } from './pfxSigner.js';

const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;

const ENDPOINTS = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const tag = (xml, nome) => xml.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)<\\/${nome}>`, 'i'))?.[1]?.trim() || null;
const atributo = (texto, nome) => texto.match(new RegExp(`${nome}="([^"]+)"`, 'i'))?.[1] || null;

function envelope({ cnpj, ambiente, ultNSU }) {
  const tpAmb = ambiente === 'homologacao' ? '2' : '1';
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb><cUFAutor>91</cUFAutor><CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${ultNSU}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

function interpretar(xml) {
  const docZips = [...xml.matchAll(/<docZip\b([^>]*)>([\s\S]*?)<\/docZip>/gi)].map((item) => ({
    nsu: atributo(item[1], 'NSU'),
    schema: atributo(item[1], 'schema'),
    data: item[2].replace(/\s/g, ''),
  }));
  const cstatTexto = tag(xml, 'cStat');
  const cstat = cstatTexto === null ? null : Number(cstatTexto);
  return {
    ok: [137, 138, 656].includes(cstat),
    cstat: Number.isFinite(cstat) ? cstat : null,
    xMotivo: tag(xml, 'xMotivo'),
    ultNSU: tag(xml, 'ultNSU'),
    maxNSU: tag(xml, 'maxNSU'),
    docZips,
  };
}

export async function distribuirDFe({ cnpj, ambiente, ultNSU, certificadoPfxBase64, certificadoSenha }) {
  const endpoint = ENDPOINTS[ambiente];
  const pfx = Buffer.from(certificadoPfxBase64 || '', 'base64');
  const passphrase = certificadoSenha || '';
  if (!endpoint || !pfx.length || !passphrase) throw new Error('Certificado fiscal não recebido do Base44.');

  const payload = envelope({ cnpj, ambiente, ultNSU });
  const url = new URL(endpoint);
  const xml = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      pfx,
      passphrase,
      minVersion: 'TLSv1.2',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    }, (res) => {
      let body = '';
      let totalBytes = 0;
      let excedeuLimite = false;
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (excedeuLimite) return;
        totalBytes += Buffer.byteLength(chunk);
        if (totalBytes > MAX_RESPONSE_BYTES) {
          excedeuLimite = true;
          req.destroy(new Error('Resposta da SEFAZ excedeu o limite de 25 MB.'));
          return;
        }
        body += chunk;
      });
      res.on('end', () => {
        if (excedeuLimite) return;
        return res.statusCode >= 200 && res.statusCode < 300
          ? resolve(body)
          : reject(new Error(`SEFAZ respondeu HTTP ${res.statusCode}`));
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout de 30s na SEFAZ.')));
    req.on('error', reject);
    req.end(payload);
  });

  return { ...interpretar(xml), endpoint };
}

export async function manifestarCiencia({ chave, cnpj, ambiente, certificadoPfxBase64, certificadoSenha }) {
  const tpAmb = ambiente === 'homologacao' ? '2' : '1';
  const eventoId = `ID210210${chave}01`;
  const dhEvento = new Date().toISOString();
  const infEvento = `<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${eventoId}"><cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento>`;
  const assinatura = await assinarInfEvento(infEvento, eventoId, certificadoPfxBase64, certificadoSenha);
  const evento = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${infEvento}${assinatura}</evento>`;
  const lote = String(Date.now()).slice(-15).padStart(15, '0');
  const payload = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><nfeDadosMsg><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${lote}</idLote>${evento}</envEvento></nfeDadosMsg></nfeRecepcaoEvento></soap12:Body></soap12:Envelope>`;
  const endpoint = ambiente === 'homologacao' ? 'https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx' : 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx';
  const url = new URL(endpoint);
  const resposta = await new Promise((resolve, reject) => {
    const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', pfx: Buffer.from(certificadoPfxBase64, 'base64'), passphrase: certificadoSenha, minVersion: 'TLSv1.2', headers: { 'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"', 'Content-Length': Buffer.byteLength(payload) }, timeout: 30000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) req.destroy(new Error('Resposta de manifestação excedeu 25 MB.')); });
      res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(body) : reject(new Error(`SEFAZ manifestação HTTP ${res.statusCode}`)));
    });
    req.on('timeout', () => req.destroy(new Error('Timeout de 30s na manifestação.')));
    req.on('error', reject);
    req.end(payload);
  });
  const statuses = [...resposta.matchAll(/<cStat>(\d+)<\/cStat>/gi)].map((match) => Number(match[1]));
  const motivos = [...resposta.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/gi)].map((match) => match[1]);
  const cstat = statuses.at(-1) ?? null;
  return { ok: [135, 136, 573].includes(cstat), cstat, xMotivo: motivos.at(-1) || null, evento: '210210' };
}