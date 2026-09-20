const JANELA_MS = 60_000;
const LIMITE_POR_JANELA = 20;

let chamadas = [];

export function permitirConsulta() {
  const agora = Date.now();
  chamadas = chamadas.filter((instante) => agora - instante < JANELA_MS);

  if (chamadas.length >= LIMITE_POR_JANELA) {
    const retryAfter = Math.max(1, Math.ceil((JANELA_MS - (agora - chamadas[0])) / 1000));
    return { ok: false, retryAfter };
  }

  chamadas.push(agora);
  return { ok: true, retryAfter: 0 };
}