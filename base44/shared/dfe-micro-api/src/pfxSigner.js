import { execFile } from 'node:child_process';
import { createHash, createSign } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const compact = (pem) => pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '');

export async function assinarInfEvento(infEvento, eventoId, pfxBase64, senha) {
  const dir = await mkdtemp(join(tmpdir(), 'nexus-dfe-'));
  const pfxPath = join(dir, 'cert.pfx');
  const senhaPath = join(dir, 'senha.txt');
  const pemPath = join(dir, 'cert.pem');
  try {
    await writeFile(pfxPath, Buffer.from(pfxBase64, 'base64'), { mode: 0o600 });
    await writeFile(senhaPath, senha, { mode: 0o600 });
    await chmod(senhaPath, 0o600);
    await execFileAsync('openssl', ['pkcs12', '-in', pfxPath, '-nodes', '-passin', `file:${senhaPath}`, '-out', pemPath], { timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
    const pem = await readFile(pemPath, 'utf8');
    const privateKey = pem.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/)?.[0];
    const certificate = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
    if (!privateKey || !certificate) throw new Error('PFX sem chave privada ou certificado utilizável.');

    const digestValue = createHash('sha1').update(infEvento).digest('base64');
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${eventoId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
    const signer = createSign('RSA-SHA1');
    signer.update(signedInfo);
    signer.end();
    const signatureValue = signer.sign(privateKey, 'base64');
    return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo.replace(' xmlns="http://www.w3.org/2000/09/xmldsig#"', '')}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${compact(certificate)}</X509Certificate></X509Data></KeyInfo></Signature>`;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}