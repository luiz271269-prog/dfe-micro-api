import { getCertSecret } from './certSecrets.ts';

const MAX_PFX_BYTES = 2 * 1024 * 1024;

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 32768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function carregarCertificadoMtls(base44, certificado) {
  const { senha, permitido } = getCertSecret(certificado.senha_secret_name);
  if (!permitido || !senha) throw new Error('Senha do certificado não configurada no Base44.');

  const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
    file_uri: certificado.file_uri,
    expires_in: 60,
  });
  if (!signed_url) throw new Error('Não foi possível acessar o certificado privado.');

  const response = await fetch(signed_url);
  if (!response.ok) throw new Error(`Falha ao carregar certificado privado: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PFX_BYTES) throw new Error('Certificado vazio ou acima do limite de 2 MB.');

  return { pfxBase64: bytesToBase64(bytes), senha };
}