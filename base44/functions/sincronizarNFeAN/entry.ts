import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import forge from 'npm:node-forge@1.3.1';

const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
const ENDPOINT_PROD = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const ENDPOINT_HOM = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const COD_UF_SC = '42';
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora
const MAX_LOOPS_POR_EXECUCAO = 5; // máx 5 batches por chamada (até 250 docs)

// ============================================================
// ADAPTER FISCAL — Plano A (Base44/Deno mTLS direto).
// Para trocar para Plano B (micro-API externa), substitua APENAS este bloco
// mantendo a MESMA assinatura de entrada e o MESMO shape de retorno.
//
// Contract:
//   IN:  { certPem, keyPem, ambiente, cnpj, ultNSU }
//   OUT: {
//     ok, cstat, xMotivo, ultNSU, maxNSU, docZips:[{nsu,schema,data}],
//     endpoint, http_status, response_xml, plano_b_necessario?, motivo?
//   }
// ============================================================
async function consultarDistribuicaoDFe({ certPem, keyPem, ambiente, cnpj, ultNSU }) {
  if (typeof Deno.createHttpClient !== 'function') {
    return { ok: false, plano_b_necessario: true, motivo: 'Deno.createHttpClient indisponível no runtime.' };
  }
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const endpoint = ambiente === 'producao' ? ENDPOINT_PROD : ENDPOINT_HOM;
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${COD_UF_SC}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${ultNSU}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

  let client;
  try {
    client = Deno.createHttpClient({ cert: certPem, key: keyPem });
  } catch (e) {
    return { ok: false, plano_b_necessario: true, motivo: `createHttpClient falhou: ${e.message}` };
  }

  let httpStatus, responseXml;
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': SOAP_ACTION,
      },
      body: envelope,
      client,
    });
    httpStatus = resp.status;
    responseXml = await resp.text();
  } catch (e) {
    return { ok: false, motivo: `Erro de rede/TLS: ${e.message}`, endpoint };
  }

  // Parse cStat e NSUs
  const pick = (re) => { const x = responseXml.match(re); return x ? x[1] : null; };
  const cstat = parseInt(pick(/<cStat>(\d+)<\/cStat>/) || '0') || null;
  const xMotivo = pick(/<xMotivo>([^<]+)<\/xMotivo>/);
  const ultNsuResp = pick(/<ultNSU>(\d+)<\/ultNSU>/);
  const maxNsuResp = pick(/<maxNSU>(\d+)<\/maxNSU>/);

  // Extrair todos os docZip da resposta (apenas em cStat 138)
  const docZips = [];
  const docZipRegex = /<docZip\s+NSU="(\d+)"\s+schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g;
  let m;
  while ((m = docZipRegex.exec(responseXml)) !== null) {
    docZips.push({ nsu: m[1], schema: m[2], data: m[3] });
  }

  return {
    ok: cstat === 137 || cstat === 138,
    cstat,
    xMotivo,
    ultNSU: ultNsuResp,
    maxNSU: maxNsuResp,
    docZips,
    endpoint,
    http_status: httpStatus,
    response_xml: responseXml,
  };
}

// ============================================================
// HELPERS — independentes do adapter
// ============================================================

// Decoda base64 + gunzip (DecompressionStream é Web API padrão em Deno)
async function gunzipBase64(b64) {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder('utf-8').decode(buf);
}

// Extrai metadados básicos do XML — suporta NFe completa, resumo (resNFe) e CTe
function parseNFeXml(xml) {
  const pick = (re) => { const x = xml.match(re); return x ? x[1] : null; };

  let tipo = 'outro';
  if (/<nfeProc/i.test(xml) || /<NFe[\s>]/i.test(xml)) tipo = 'nfe';
  if (/<resNFe/i.test(xml)) tipo = 'nfe_resumo';
  if (/<procEventoNFe/i.test(xml) || /<evento[\s>]/i.test(xml)) tipo = 'evento';
  if (/<cteProc/i.test(xml) || /<CTe[\s>]/i.test(xml)) tipo = 'cte';

  let chave = pick(/<chNFe>(\d{44})<\/chNFe>/)
            || pick(/<chCTe>(\d{44})<\/chCTe>/)
            || pick(/Id="NFe(\d{44})"/)
            || pick(/Id="CTe(\d{44})"/);

  const parseNum = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

  return {
    tipo,
    chave_acesso: chave,
    numero_nota: pick(/<nNF>(\d+)<\/nNF>/) || pick(/<nCT>(\d+)<\/nCT>/),
    serie: pick(/<serie>(\d+)<\/serie>/),
    data_emissao: pick(/<dhEmi>([^<]+)<\/dhEmi>/) || pick(/<dEmi>([^<]+)<\/dEmi>/),
    cnpj_emitente: pick(/<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/) || pick(/<CNPJ>(\d+)<\/CNPJ>/),
    nome_emitente: pick(/<emit>[\s\S]*?<xNome>([^<]+)<\/xNome>/) || pick(/<xNome>([^<]+)<\/xNome>/),
    uf_emitente: pick(/<emit>[\s\S]*?<UF>([^<]+)<\/UF>/),
    cnpj_destinatario: pick(/<dest>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/),
    valor_total: parseNum(pick(/<vNF>([\d.]+)<\/vNF>/)),
    valor_produtos: parseNum(pick(/<vProd>([\d.]+)<\/vProd>/)),
    valor_icms: parseNum(pick(/<ICMSTot>[\s\S]*?<vICMS>([\d.]+)<\/vICMS>/)),
    valor_icms_st: parseNum(pick(/<ICMSTot>[\s\S]*?<vST>([\d.]+)<\/vST>/)),
    valor_ipi: parseNum(pick(/<ICMSTot>[\s\S]*?<vIPI>([\d.]+)<\/vIPI>/)),
    natureza_operacao: pick(/<natOp>([^<]+)<\/natOp>/),
  };
}

// ============================================================
// CORE BUSINESS LOGIC — independente do adapter
// ============================================================
Deno.serve(async (req) => {
  const t0 = Date.now();
  const request_id = `sync_${Date.now()}`;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { empresa = 'NeuralTec' } = body || {};

    // 1. Certificado ativo + válido
    const certs = await base44.asServiceRole.entities.CertificadoDigitalNFe.filter({
      empresa, is_ativo: true, status_validacao: 'valido',
    });
    const cdoc = certs?.[0];
    if (!cdoc) return Response.json({
      ok: false,
      motivo: `Nenhum certificado ativo+válido para ${empresa}. Cadastre e valide em /certificado-nfe.`
    }, { status: 400 });

    // 2. ControleNSU
    let controles = await base44.asServiceRole.entities.ControleNSU.filter({ empresa });
    let controle = controles?.[0];
    if (!controle) {
      controle = await base44.asServiceRole.entities.ControleNSU.create({
        empresa,
        cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
        ultimo_nsu: '000000000000000',
        max_nsu_servidor: '000000000000000',
      });
    }

    // 3. Cooldown
    if (controle.bloqueado_ate) {
      const blocked = new Date(controle.bloqueado_ate);
      if (blocked > new Date()) {
        const min = Math.ceil((blocked.getTime() - Date.now()) / 60000);
        return Response.json({
          ok: false, bloqueado: true,
          motivo: `Sync bloqueado por cooldown (cStat 137/656). Liberação em ${min}min (${blocked.toLocaleString('pt-BR')})`,
        });
      }
    }

    // 4. Senha do secret
    const senha = Deno.env.get(cdoc.senha_secret_name);
    if (!senha) return Response.json({ ok: false, motivo: `Secret ${cdoc.senha_secret_name} não configurado` }, { status: 400 });

    // 5. PFX → PEM
    let certPem, keyPem;
    try {
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: cdoc.file_uri, expires_in: 60 });
      const pfxResp = await fetch(signed_url);
      const pfxBuffer = new Uint8Array(await pfxResp.arrayBuffer());
      const p12Der = forge.util.binary.raw.encode(pfxBuffer);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);
      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
      const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
                  || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
      certPem = forge.pki.certificateToPem(certBag.cert);
      keyPem = forge.pki.privateKeyToPem(keyBag.key);
    } catch (e) {
      return Response.json({ ok: false, motivo: `Falha ao abrir PFX: ${e.message}` }, { status: 400 });
    }

    // 6. LOOP de consulta via adapter
    let nsuAtual = controle.ultimo_nsu || '000000000000000';
    const nsuInicial = nsuAtual;
    let novos = 0, duplicados = 0, erros = 0, totalDocs = 0;
    let lastResult = null;
    let loops = 0;
    let break_reason = '';

    while (loops < MAX_LOOPS_POR_EXECUCAO) {
      loops++;
      const result = await consultarDistribuicaoDFe({
        certPem, keyPem, ambiente: cdoc.ambiente,
        cnpj: cdoc.cnpj_sem_mascara, ultNSU: nsuAtual,
      });
      lastResult = result;

      // Falha de runtime → Plano B
      if (result.plano_b_necessario) {
        await base44.asServiceRole.entities.ControleNSU.update(controle.id, {
          ultima_consulta: new Date().toISOString(),
          ultimo_status: 'erro',
          ultimo_erro: result.motivo,
          tentativas_consecutivas_erro: (controle.tentativas_consecutivas_erro || 0) + 1,
        });
        await base44.asServiceRole.entities.LogSyncSEFAZ.create({
          request_id, empresa, cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
          data_execucao: new Date().toISOString(), duracao_ms: Date.now() - t0,
          nsu_inicial: nsuInicial, nsu_final: nsuAtual,
          status_final: 'erro',
          mensagem: `Plano B necessário: ${result.motivo}`,
          endpoint: result.endpoint,
        });
        return Response.json({ ok: false, plano_b_necessario: true, motivo: result.motivo });
      }

      // cStat 656 → bloqueia 1h
      if (result.cstat === 656) {
        const blockUntil = new Date(Date.now() + COOLDOWN_MS);
        await base44.asServiceRole.entities.ControleNSU.update(controle.id, {
          ultima_consulta: new Date().toISOString(),
          ultimo_status: 'rate_limit', ultimo_cstat: 656,
          ultimo_erro: result.xMotivo,
          bloqueado_ate: blockUntil.toISOString(),
        });
        await base44.asServiceRole.entities.LogSyncSEFAZ.create({
          request_id, empresa, cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
          data_execucao: new Date().toISOString(), duracao_ms: Date.now() - t0,
          nsu_inicial: nsuInicial, nsu_final: nsuAtual,
          cstat: 656, x_motivo: result.xMotivo,
          status_final: 'bloqueado_consumo',
          mensagem: `Rate limit AN. Bloqueado até ${blockUntil.toLocaleString('pt-BR')}`,
          endpoint: result.endpoint,
        });
        return Response.json({
          ok: false, bloqueado: true,
          motivo: `Rate limit AN (cStat 656). Bloqueado até ${blockUntil.toLocaleString('pt-BR')}`,
        });
      }

      // cStat 137 → sem novos. Cooldown padrão 1h.
      if (result.cstat === 137) {
        break_reason = 'cstat_137_sem_novos';
        break;
      }

      // cStat 138 → processar docZips
      if (result.cstat === 138) {
        if (!result.docZips || result.docZips.length === 0) {
          break_reason = 'cstat_138_sem_docs';
          break;
        }
        for (const dz of result.docZips) {
          totalDocs++;
          try {
            const xml = await gunzipBase64(dz.data);
            const meta = parseNFeXml(xml);
            if (!meta.chave_acesso) {
              erros++;
              console.warn(`NSU ${dz.nsu} sem chave de acesso — schema ${dz.schema}`);
              continue;
            }

            // Dedup
            const dup = await base44.asServiceRole.entities.NFeRecebida.filter({ chave_acesso: meta.chave_acesso });
            if (dup && dup.length > 0) { duplicados++; continue; }

            // Upload XML privado
            const xmlBlob = new Blob([xml], { type: 'application/xml' });
            const xmlFile = new File([xmlBlob], `${meta.chave_acesso}.xml`, { type: 'application/xml' });
            const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: xmlFile });

            await base44.asServiceRole.entities.NFeRecebida.create({
              chave_acesso: meta.chave_acesso,
              nsu: dz.nsu,
              tipo_documento: meta.tipo,
              empresa_destinataria: empresa,
              cnpj_destinatario: meta.cnpj_destinatario || cdoc.cnpj_sem_mascara,
              cnpj_emitente: meta.cnpj_emitente,
              nome_emitente: meta.nome_emitente,
              uf_emitente: meta.uf_emitente,
              numero_nota: meta.numero_nota,
              serie: meta.serie,
              data_emissao: meta.data_emissao,
              valor_total: meta.valor_total,
              valor_produtos: meta.valor_produtos,
              valor_icms: meta.valor_icms,
              valor_icms_st: meta.valor_icms_st,
              valor_ipi: meta.valor_ipi,
              natureza_operacao: meta.natureza_operacao,
              xml_file_uri: file_uri,
              schema_documento: dz.schema,
              status_manifestacao: 'pendente',
              status_processamento: 'novo',
            });
            novos++;
          } catch (e) {
            erros++;
            console.error(`Erro processando NSU ${dz.nsu}:`, e.message);
          }
        }
        nsuAtual = result.ultNSU || nsuAtual;
        // Se chegamos no maxNSU, parar
        if (result.ultNSU && result.maxNSU && result.ultNSU >= result.maxNSU) {
          break_reason = 'alcancou_max_nsu';
          break;
        }
        continue; // próximo batch
      }

      // cStat inesperado
      erros++;
      break_reason = `cstat_inesperado_${result.cstat}`;
      break;
    }

    if (loops >= MAX_LOOPS_POR_EXECUCAO && !break_reason) break_reason = 'limite_loops';

    // 7. Atualizar ControleNSU
    const updateControle = {
      ultima_consulta: new Date().toISOString(),
      ultimo_cstat: lastResult?.cstat || null,
      ultimo_nsu: nsuAtual,
      max_nsu_servidor: lastResult?.maxNSU || controle.max_nsu_servidor,
      tentativas_consecutivas_erro: 0,
    };
    if (lastResult?.cstat === 137) {
      updateControle.ultimo_status = 'vazio';
      updateControle.bloqueado_ate = new Date(Date.now() + COOLDOWN_MS).toISOString();
    } else if (novos > 0 || duplicados > 0) {
      updateControle.ultimo_status = 'ok';
    } else if (erros > 0) {
      updateControle.ultimo_status = 'erro';
      updateControle.ultimo_erro = `${erros} erro(s) processando docZip`;
    } else {
      updateControle.ultimo_status = 'vazio';
    }
    await base44.asServiceRole.entities.ControleNSU.update(controle.id, updateControle);

    // 8. Log final
    const statusFinal = novos > 0 ? 'ok'
                      : lastResult?.cstat === 137 ? 'sem_novos'
                      : erros > 0 ? 'erro'
                      : 'ok';
    const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
      request_id, empresa, cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
      data_execucao: new Date().toISOString(), duracao_ms: Date.now() - t0,
      nsu_inicial: nsuInicial, nsu_final: nsuAtual,
      max_nsu_servidor: lastResult?.maxNSU,
      documentos_baixados: totalDocs, novos, duplicados, erros,
      cstat: lastResult?.cstat, x_motivo: lastResult?.xMotivo,
      status_final: statusFinal,
      mensagem: `${loops} batch(es) · ${totalDocs} docs · ${novos} novos · ${duplicados} dup · ${erros} erros · ${break_reason}`,
      endpoint: lastResult?.endpoint,
    });

    return Response.json({
      ok: true,
      novos, duplicados, erros, totalDocs, loops,
      cstat: lastResult?.cstat, x_motivo: lastResult?.xMotivo,
      nsu_inicial: nsuInicial, nsu_final: nsuAtual, max_nsu: lastResult?.maxNSU,
      break_reason, log_id: log.id,
    });
  } catch (error) {
    console.error('sincronizarNFeAN erro:', error);
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
});