// redeploy: 2026-06-06 (força re-injeção de secrets do runtime)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import forge from 'npm:node-forge@1.3.1';

function maskCnpj(cnpj) {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/****-${d.slice(12,14)}`;
}

function onlyDigits(s) { return (s || '').replace(/\D/g, ''); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const body = await req.json();
    const { empresa, cnpj, ambiente, file_uri, senha_secret_name, certificado_id } = body || {};

    if (!empresa || !cnpj || !file_uri || !senha_secret_name) {
      return Response.json({ ok: false, motivo: 'Campos obrigatórios: empresa, cnpj, file_uri, senha_secret_name' }, { status: 400 });
    }

    // Normaliza nome do secret (remove caracteres invisíveis e espaços que podem vir do body)
    const secretNameNormalizado = String(senha_secret_name || '').trim().replace(/[^A-Z0-9_]/gi, '');
    const senha = Deno.env.get(secretNameNormalizado);
    if (!senha) {
      const todasKeys = Object.keys(Deno.env.toObject()).sort();
      return Response.json({
        ok: false,
        motivo: `Secret "${secretNameNormalizado}" não configurado no Base44. Cadastre a senha do .pfx em Settings → Secrets.`,
        debug: { secret_recebido: senha_secret_name, secret_normalizado: secretNameNormalizado, env_keys_disponiveis: todasKeys }
      }, { status: 400 });
    }

    // 1. Baixar PFX via signed URL
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 60 });
    const pfxResp = await fetch(signed_url);
    if (!pfxResp.ok) {
      return Response.json({ ok: false, motivo: `Falha ao baixar PFX: HTTP ${pfxResp.status}` }, { status: 500 });
    }
    const pfxBuffer = new Uint8Array(await pfxResp.arrayBuffer());

    // 2. Decodificar PFX com node-forge
    let p12;
    try {
      const p12Der = forge.util.binary.raw.encode(pfxBuffer);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);
    } catch (e) {
      const msg = String(e?.message || e);
      const senhaErrada = /mac|password|invalid/i.test(msg);
      if (certificado_id) {
        try {
          await base44.asServiceRole.entities.CertificadoDigitalNFe.update(certificado_id, {
            status_validacao: 'invalido',
            ultimo_erro: senhaErrada ? 'Senha do .pfx inválida' : `Erro ao abrir PFX: ${msg}`,
            ultima_validacao: new Date().toISOString(),
          });
        } catch { /* segue */ }
      }
      return Response.json({
        ok: false,
        motivo: senhaErrada ? 'Senha do .pfx inválida (verifique o secret)' : `Erro ao decodificar PFX: ${msg}`
      }, { status: 400 });
    }

    // 3. Extrair certificado
    const certBagsResult = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBags = certBagsResult[forge.pki.oids.certBag] || [];
    if (certBags.length === 0) {
      return Response.json({ ok: false, motivo: 'Nenhum certificado encontrado dentro do PFX' }, { status: 400 });
    }
    const certificate = certBags[0].cert;

    // 4. Extrair informações do subject
    const titular = certificate.subject.getField('CN')?.value || '';
    const validade = certificate.validity.notAfter.toISOString().split('T')[0];

    // CNPJ no e-CNPJ: pode estar no CN ("NOME:CNPJ") ou em subjectAltName otherName 2.16.76.1.3.3
    let cnpjExtraido = null;
    const cnMatch = String(titular).match(/(\d{14})/);
    if (cnMatch) cnpjExtraido = cnMatch[1];
    if (!cnpjExtraido) {
      try {
        const sanExt = certificate.getExtension('subjectAltName');
        if (sanExt && sanExt.altNames) {
          for (const an of sanExt.altNames) {
            const v = String(an?.value || '');
            const m = v.match(/(\d{14})/);
            if (m) { cnpjExtraido = m[1]; break; }
          }
        }
      } catch { /* sem san */ }
    }

    // 5. Validar
    const cnpjInformado = onlyDigits(cnpj);
    const cnpjBate = cnpjExtraido && cnpjExtraido === cnpjInformado;
    const expirado = new Date(certificate.validity.notAfter) < new Date();

    let status = 'valido';
    let mensagem = '✅ Certificado validado com sucesso';
    if (expirado) {
      status = 'expirado';
      mensagem = `❌ Certificado expirou em ${validade}`;
    } else if (cnpjExtraido && !cnpjBate) {
      status = 'invalido';
      mensagem = `❌ CNPJ do certificado (${maskCnpj(cnpjExtraido)}) não bate com o CNPJ informado (${maskCnpj(cnpj)})`;
    } else if (!cnpjExtraido) {
      mensagem = '⚠️ Certificado válido, mas não foi possível extrair CNPJ do PFX. Confiando no CNPJ informado.';
    }

    // 6. Salvar/atualizar
    const dadosUpdate = {
      empresa,
      cnpj,
      cnpj_sem_mascara: cnpjInformado,
      tipo: 'A1',
      file_uri,
      senha_secret_name,
      ambiente: ambiente || 'producao',
      is_ativo: true,
      status_validacao: status,
      titular: String(titular || '').slice(0, 200),
      validade,
      ultimo_erro: status === 'valido' ? null : mensagem,
      ultima_validacao: new Date().toISOString(),
    };

    let cert;
    if (certificado_id) {
      cert = await base44.asServiceRole.entities.CertificadoDigitalNFe.update(certificado_id, dadosUpdate);
    } else {
      // Se já existe registro para essa empresa+ambiente, atualiza
      const existentes = await base44.asServiceRole.entities.CertificadoDigitalNFe.filter({ empresa, ambiente: ambiente || 'producao' });
      if (existentes && existentes.length > 0) {
        cert = await base44.asServiceRole.entities.CertificadoDigitalNFe.update(existentes[0].id, dadosUpdate);
      } else {
        cert = await base44.asServiceRole.entities.CertificadoDigitalNFe.create(dadosUpdate);
      }
    }

    return Response.json({
      ok: status === 'valido',
      status_validacao: status,
      certificado_id: cert.id,
      titular,
      validade,
      cnpj_extraido: cnpjExtraido ? maskCnpj(cnpjExtraido) : null,
      cnpj_informado: maskCnpj(cnpj),
      cnpj_bate: cnpjBate,
      ambiente: ambiente || 'producao',
      mensagem,
    });
  } catch (error) {
    console.error('validarCertificadoNFe erro:', error);
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
});