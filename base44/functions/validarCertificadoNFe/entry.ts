// redeploy: 2026-06-06 (força re-injeção de secrets do runtime)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import forge from 'npm:node-forge@1.3.1';
import { getCertSecret } from '../../shared/certSecrets.ts';

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

    // Resolve a senha apenas via allowlist estática — nunca acesso dinâmico ao env
    const { key: secretNameNormalizado, senha, permitido } = getCertSecret(senha_secret_name);
    if (!permitido) {
      return Response.json({
        ok: false,
        motivo: `Secret "${secretNameNormalizado}" não é um secret de certificado permitido (use CERT_PFX_NEURALTEC ou CERT_PFX_LIESCH).`,
      }, { status: 400 });
    }
    if (!senha) {
      return Response.json({
        ok: false,
        motivo: `Secret "${secretNameNormalizado}" não configurado no Base44. Cadastre a senha do .pfx em Settings → Secrets.`,
      }, { status: 400 });
    }

    // 1. Baixar PFX via signed URL (escopo do usuário — o arquivo privado pertence a ele)
    console.log('[validarCertificadoNFe] gerando signed_url para', file_uri);
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 60 });
    if (!signed_url) {
      return Response.json({ ok: false, etapa: 'signed_url', motivo: 'CreateFileSignedUrl retornou vazio' }, { status: 500 });
    }
    const pfxResp = await fetch(signed_url);
    if (!pfxResp.ok) {
      return Response.json({ ok: false, etapa: 'download_pfx', motivo: `Falha ao baixar PFX: HTTP ${pfxResp.status}` }, { status: 500 });
    }
    const pfxBuffer = new Uint8Array(await pfxResp.arrayBuffer());
    console.log('[validarCertificadoNFe] PFX baixado', { file_uri, bytes: pfxBuffer.length, primeiro_byte: pfxBuffer[0]?.toString(16) });

    if (pfxBuffer.length === 0) {
      return Response.json({ ok: false, etapa: 'download_pfx', motivo: 'PFX baixado mas veio vazio (0 bytes). O upload provavelmente falhou no front.' }, { status: 400 });
    }
    if (pfxBuffer[0] !== 0x30) {
      return Response.json({
        ok: false,
        etapa: 'inspecao_pfx',
        motivo: `Arquivo não tem assinatura ASN.1 (primeiro byte: 0x${pfxBuffer[0]?.toString(16)}). Pode não ser um .pfx/.p12 binário válido — talvez seja PEM/texto ou arquivo corrompido.`,
        bytes: pfxBuffer.length,
      }, { status: 400 });
    }
    if (pfxBuffer.length < 2500) {
      console.warn('[validarCertificadoNFe] PFX pequeno', { bytes: pfxBuffer.length });
    }

    // 2. Decodificar PFX com node-forge
    let p12;
    try {
      const p12Der = forge.util.binary.raw.encode(pfxBuffer);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);
    } catch (e) {
      const msg = String(e?.message || e);
      const stack = String(e?.stack || '').slice(0, 500);
      console.error('[validarCertificadoNFe] forge falhou', { msg, stack });

      // Classificação do erro real
      const isAlgoritmoNaoSuportado = /unsupported|not supported|prf|pbe|algorithm|oid/i.test(msg);
      const isSenhaErrada = !isAlgoritmoNaoSuportado && /mac|password|invalid/i.test(msg);

      let motivo;
      if (isAlgoritmoNaoSuportado) {
        motivo = `❌ PFX usa algoritmo de criptografia que o node-forge não suporta (provável AES-256 / SHA-256). Erro técnico: "${msg}". Solução: reexportar o .pfx em modo de compatibilidade legacy (OpenSSL: openssl pkcs12 -in original.pfx -out temp.pem -nodes && openssl pkcs12 -export -in temp.pem -out legacy.pfx -legacy)`;
      } else if (isSenhaErrada) {
        motivo = `Senha do .pfx inválida (verifique o secret). Erro técnico: "${msg}"`;
      } else {
        motivo = `Erro ao decodificar PFX: ${msg}`;
      }

      if (certificado_id) {
        try {
          await base44.asServiceRole.entities.CertificadoDigitalNFe.update(certificado_id, {
            status_validacao: 'invalido',
            ultimo_erro: motivo.slice(0, 500),
            ultima_validacao: new Date().toISOString(),
          });
        } catch { /* segue */ }
      }
      return Response.json({ ok: false, motivo, erro_forge: msg, classificacao: isAlgoritmoNaoSuportado ? 'algoritmo_nao_suportado' : isSenhaErrada ? 'senha_errada' : 'desconhecido' }, { status: 400 });
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