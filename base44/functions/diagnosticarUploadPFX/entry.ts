// Diagnóstico mínimo: só baixa o arquivo do storage privado e devolve metadados.
// NÃO tenta abrir PFX, NÃO usa senha. Serve para isolar: o arquivo chegou ao backend?
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function hex(bytes, n = 8) {
  return Array.from(bytes.slice(0, n)).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const steps = [];
  function step(name, ok, detail = {}) {
    steps.push({ name, ok, t_ms: Date.now() - t0, ...detail });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, etapa: 'auth', motivo: 'Unauthorized' }, { status: 401 });
    step('auth', true, { user_id: user.id });

    const body = await req.json().catch(() => ({}));
    const { file_uri } = body || {};

    if (!file_uri) {
      step('recebeu_file_uri', false);
      return Response.json({ ok: false, etapa: 'recebeu_file_uri', motivo: 'file_uri ausente no body', steps }, { status: 400 });
    }
    step('recebeu_file_uri', true, { file_uri });

    // 1. Gerar signed URL (escopo do usuário — arquivo privado pertence a ele)
    let signed_url;
    try {
      const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 60 });
      signed_url = r?.signed_url;
      if (!signed_url) throw new Error('signed_url vazio');
      step('signed_url', true, { signed_url_preview: String(signed_url).slice(0, 80) + '...' });
    } catch (e) {
      step('signed_url', false, { erro: String(e?.message || e) });
      return Response.json({ ok: false, etapa: 'signed_url', motivo: String(e?.message || e), steps }, { status: 500 });
    }

    // 2. Baixar bytes
    let pfxBuffer;
    try {
      const resp = await fetch(signed_url);
      if (!resp.ok) {
        step('download', false, { http: resp.status });
        return Response.json({ ok: false, etapa: 'download', motivo: `HTTP ${resp.status}`, steps }, { status: 502 });
      }
      pfxBuffer = new Uint8Array(await resp.arrayBuffer());
      step('download', true, { bytes: pfxBuffer.length, http: resp.status });
    } catch (e) {
      step('download', false, { erro: String(e?.message || e) });
      return Response.json({ ok: false, etapa: 'download', motivo: String(e?.message || e), steps }, { status: 500 });
    }

    // 3. Inspecionar bytes — PFX/P12 começa com SEQUENCE (0x30) em DER
    const primeiroByte = pfxBuffer.length > 0 ? pfxBuffer[0] : null;
    const tem_assinatura_der = primeiroByte === 0x30; // ASN.1 SEQUENCE
    const tamanho_kb = (pfxBuffer.length / 1024).toFixed(2);
    const tamanho_suspeito = pfxBuffer.length < 2500;

    step('inspecao_bytes', true, {
      bytes: pfxBuffer.length,
      tamanho_kb: `${tamanho_kb} KB`,
      primeiro_byte_hex: primeiroByte !== null ? `0x${primeiroByte.toString(16).padStart(2, '0')}` : null,
      primeiros_8_bytes: hex(pfxBuffer, 8),
      tem_assinatura_der_asn1: tem_assinatura_der,
      tamanho_suspeito,
    });

    return Response.json({
      ok: true,
      etapa: 'completo',
      diagnostico: {
        bytes_baixados: pfxBuffer.length,
        tamanho_kb: `${tamanho_kb} KB`,
        primeiro_byte: primeiroByte !== null ? `0x${primeiroByte.toString(16).padStart(2, '0')}` : null,
        primeiros_8_bytes_hex: hex(pfxBuffer, 8),
        parece_pfx_valido: tem_assinatura_der && pfxBuffer.length > 500,
        alerta_tamanho: tamanho_suspeito ? `Arquivo pequeno (${tamanho_kb} KB). PFX típico tem 4–15 KB. Não é prova de invalidez, mas vale conferir.` : null,
        alerta_estrutura: !tem_assinatura_der ? 'Primeiro byte não é 0x30 (ASN.1 SEQUENCE). Pode não ser um PFX/P12 binário válido — talvez seja PEM, .cer texto ou arquivo corrompido.' : null,
      },
      steps,
    });
  } catch (error) {
    step('exception', false, { erro: String(error?.message || error) });
    return Response.json({ ok: false, etapa: 'exception', motivo: String(error?.message || error), steps }, { status: 500 });
  }
});