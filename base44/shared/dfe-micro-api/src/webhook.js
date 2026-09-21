const WEBHOOK_URL = process.env.NEXUS_WEBHOOK_URL || 'https://financeiro-nexus.base44.app/functions/receberWebhookNFe';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function notificarBase44(payload) {
  const token = String(process.env.NEXUS_HUB_TOKEN || '').trim();
  if (!token) return { ok: false, motivo: 'NEXUS_HUB_TOKEN não configurado no Railway.' };

  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) return { ok: true, status: response.status };
      ultimoErro = `HTTP ${response.status}`;
    } catch (error) {
      ultimoErro = error.message;
    }
    if (tentativa < 3) await sleep(500 * (2 ** (tentativa - 1)));
  }
  return { ok: false, motivo: ultimoErro };
}