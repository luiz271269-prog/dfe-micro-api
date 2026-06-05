import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import forge from 'npm:node-forge@1.3.1';

function maskCnpj(c) {
  const d = (c || '').replace(/\D/g, '');
  if (d.length !== 14) return c || '';
  return `${d.substr(0,2)}.${d.substr(2,3)}.${d.substr(5,3)}/****-${d.substr(12,2)}`;
}

function extractCnpjFromCert(cert) {
  // OID 2.16.76.1.3.3 = CNPJ no subjectAltName (ICP-Brasil)
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
  // Fallback: CN
  try {
    const cn = cert.subject.getField('CN')?.value || '';
    const m = cn.match(/(\d{14})/);
    if (m) return m[1];
  } catch { /* noop */ }
  return null;
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

    const senha = Deno.env.get(cert.senha_secret_name);
    if (!senha) {
      await base44.entities.CertificadoDigitalNFe.update(certificado_id, {
        status_validacao: 'erro',
        ultimo_erro: `Secret "${cert.senha_secret_name}" não configurado.`,
      });
      return Response.json({
        ok: false,
        error: `Secret "${cert.senha_secret_name}" não está configurado. Configure no painel do Base44 antes de validar.`,
      });
    }

    // Baixar PFX do storage privado via signed URL
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
      file_uri: cert.file_uri,
      expires_in: 300,
    });
    const resp = await fetch(signed_url);
    if (!resp.ok) throw new Error(`Falha ao baixar PFX: HTTP ${resp.status}`);
    const pfxBuffer = new Uint8Array(await resp.arrayBuffer());

    // Abrir PFX
    const p12Der = forge.util.binary.raw.encode(pfxBuffer);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);
    } catch (_e) {
      await base44.entities.CertificadoDigitalNFe.update(certificado_id, {
        status_validacao: 'invalido',
        ultimo_erro: 'Senha incorreta ou arquivo .pfx inválido.',
      });
      await base44.entities.LogSyncSEFAZ.create({
        empresa,
        data_execucao: new Date().toISOString(),
        duracao_ms: Date.now() - startedAt,
        status_final: 'erro',
        mensagem: 'Senha incorreta ou .pfx inválido',
        tipo_operacao: 'validacao_cert',
      });
      return Response.json({ ok: false, error: 'Senha incorreta ou arquivo .pfx inválido.' });
    }

    // Extrair certificado x509
    let x509cert = null;
    for (const sb of p12.safeContents) {
      for (const sBag of sb.safeBags) {
        if (sBag.cert) { x509cert = sBag.cert; break; }
      }
      if (x509cert) break;
    }
    if (!x509cert) throw new Error('Nenhum certificado x509 encontrado no PFX');

    const titular = x509cert.subject.getField('CN')?.value || '—';
    const cnpjExtraido = extractCnpjFromCert(x509cert);
    const validade = x509cert.validity.notAfter;
    const validadeISO = validade.toISOString().substring(0, 10);
    const expirado = validade.getTime() < Date.now();
    const cnpjForm = (cert.cnpj_sem_mascara || cert.cnpj || '').replace(/\D/g, '');
    const cnpjMatch = !!(cnpjExtraido && cnpjForm && cnpjExtraido === cnpjForm);

    let status_validacao = 'valido';
    let ultimo_erro = '';
    if (expirado) {
      status_validacao = 'expirado';
      ultimo_erro = `Certificado venceu em ${validadeISO}`;
    } else if (cnpjExtraido && cnpjForm && !cnpjMatch) {
      status_validacao = 'invalido';
      ultimo_erro = `CNPJ form (${maskCnpj(cnpjForm)}) diferente do CNPJ do certificado (${maskCnpj(cnpjExtraido)})`;
    }

    await base44.entities.CertificadoDigitalNFe.update(certificado_id, {
      status_validacao,
      ultimo_erro,
      titular,
      validade: validadeISO,
      cnpj_sem_mascara: cnpjExtraido || cnpjForm,
    });

    await base44.entities.LogSyncSEFAZ.create({
      empresa,
      cnpj_sem_mascara: maskCnpj(cnpjExtraido || cnpjForm),
      data_execucao: new Date().toISOString(),
      duracao_ms: Date.now() - startedAt,
      status_final: status_validacao === 'valido' ? 'ok' : 'erro',
      mensagem: status_validacao === 'valido' ? `Certificado válido — titular: ${titular}` : ultimo_erro,
      tipo_operacao: 'validacao_cert',
    });

    return Response.json({
      ok: status_validacao === 'valido',
      status_validacao,
      titular,
      cnpj_extraido: cnpjExtraido ? maskCnpj(cnpjExtraido) : null,
      validade: validadeISO,
      mensagem: status_validacao === 'valido' ? 'Certificado validado com sucesso' : ultimo_erro,
    });
  } catch (error) {
    await (async () => {
      try {
        const base44 = createClientFromRequest(req);
        await base44.entities.LogSyncSEFAZ.create({
          empresa,
          data_execucao: new Date().toISOString(),
          duracao_ms: Date.now() - startedAt,
          status_final: 'erro',
          mensagem: error.message,
          tipo_operacao: 'validacao_cert',
        });
      } catch { /* noop */ }
    })();
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});