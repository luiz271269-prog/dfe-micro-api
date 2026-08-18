// Allowlist estática dos segredos de senha de certificado digital (.pfx).
// Nunca ler Deno.env com nome vindo de requisição/banco — apenas chaves desta lista.
const CERT_SECRETS = {
  CERT_PFX_NEURALTEC: () => Deno.env.get('CERT_PFX_NEURALTEC'),
  CERT_PFX_LIESCH: () => Deno.env.get('CERT_PFX_LIESCH'),
};

// Normaliza o nome recebido e retorna a senha só se estiver na allowlist.
export function getCertSecret(name) {
  const key = String(name || '').trim().replace(/[^A-Z0-9_]/gi, '');
  const getter = Object.prototype.hasOwnProperty.call(CERT_SECRETS, key) ? CERT_SECRETS[key] : null;
  return { key, senha: getter ? (getter() || null) : null, permitido: !!getter };
}