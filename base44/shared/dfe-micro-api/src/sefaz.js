import https from 'node:https';

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
  const cstat = Number(tag(xml, 'cStat'));
  return {
    ok: [137, 138, 656].includes(cstat),
    cstat: Number.isFinite(cstat) ? cstat : null,
    xMotivo: tag(xml, 'xMotivo'),
    ultNSU: tag(xml, 'ultNSU'),
    maxNSU: tag(xml, 'maxNSU'),
    docZips,
  };
}

export async function distribuirDFe({ cnpj, ambiente, ultNSU }) {
  const endpoint = ENDPOINTS[ambiente];
  const pfx = Buffer.from(process.env.CERT_PFX_BASE64 || '', 'base64');
  const passphrase = process.env.CERT_PFX_PASSWORD || '';
  if (!endpoint || !pfx.length || !passphrase) throw new Error('Configuração fiscal incompleta no Railway.');

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
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => res.statusCode >= 200 && res.statusCode < 300
        ? resolve(body)
        : reject(new Error(`SEFAZ respondeu HTTP ${res.statusCode}`)));
    });
    req.on('timeout', () => req.destroy(new Error('Timeout de 30s na SEFAZ.')));
    req.on('error', reject);
    req.end(payload);
  });

  return { ...interpretar(xml), endpoint };
}