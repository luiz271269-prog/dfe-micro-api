import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import forge from 'npm:node-forge@1.3.1';
import { getCertSecret } from '../../shared/certSecrets.ts';

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora
const MAX_LOOPS_POR_EXECUCAO = 5; // máx 5 batches por chamada (até 250 docs)

// ============================================================
// ADAPTER FISCAL — CONTRATO ÚNICO consumido pelo core.
//
// Qualquer implementação deve respeitar:
//   IN:  { certPem, keyPem, ambiente, cnpj, ultNSU }
//   OUT: {
//     ok: boolean,
//     cstat: number|null,
//     xMotivo: string|null,
//     ultNSU: string|null,
//     maxNSU: string|null,
//     docZips: [{ nsu, schema, data /* base64+gzip */ }],
//     endpoint?: string,
//     http_status?: number,
//     response_xml?: string,
//     plano_b_necessario?: boolean,
//     motivo?: string,
//   }
//
// Implementações disponíveis:
//   - consultarDistribuicaoDFeBase44  → Plano A: mTLS direto (indisponível no runtime → retorna plano_b)
//   - consultarDistribuicaoDFeMock    → Plano TESTE: simula 137/138 sem rede
//   - (futuro) consultarDistribuicaoDFeMicroApi → Plano B: micro-API externa
//
// ============================================================
async function consultarDistribuicaoDFeBase44() {
  // O runtime de backend functions do Base44 não expõe cliente HTTP mTLS,
  // então a consulta direta à SEFAZ AN não é possível daqui.
  return {
    ok: false,
    plano_b_necessario: true,
    motivo: 'Cliente HTTP mTLS indisponível no runtime — necessário Plano B (micro-API externa Node + mTLS).',
  };
}

// ============================================================
// ADAPTER MOCK — testa pipeline (parse + gunzip + dedup + UI)
// sem depender de certificado válido nem da conectividade SEFAZ.
// Ativar via payload { mock: "137" } ou { mock: "138" }.
// ============================================================
async function gzipBase64(text) {
  const stream = new Response(text).body.pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function consultarDistribuicaoDFeMock({ cnpj, ultNSU }, kind = '137') {
  const proxNsu = String(parseInt(ultNSU || '0') + 1).padStart(15, '0');
  if (kind === '138') {
    const chave = Date.now().toString().padEnd(44, '0').slice(0, 44);
    const fakeXml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe${chave}">
    <ide><nNF>${Math.floor(Math.random()*999999)}</nNF><serie>1</serie><dhEmi>${new Date().toISOString()}</dhEmi><natOp>MOCK - VENDA TESTE</natOp></ide>
    <emit><CNPJ>11222333000181</CNPJ><xNome>FORNECEDOR MOCK LTDA</xNome><enderEmit><UF>SC</UF></enderEmit></emit>
    <dest><CNPJ>${cnpj}</CNPJ></dest>
    <total><ICMSTot><vNF>1234.56</vNF><vProd>1000.00</vProd><vICMS>120.00</vICMS><vST>0.00</vST><vIPI>0.00</vIPI></ICMSTot></total>
  </infNFe></NFe>
</nfeProc>`;
    const data = await gzipBase64(fakeXml);
    return {
      ok: true, cstat: 138, xMotivo: 'MOCK — Documentos localizados',
      ultNSU: proxNsu, maxNSU: proxNsu,
      docZips: [{ nsu: proxNsu, schema: 'procNFe_v4.00.xsd', data }],
      endpoint: 'mock://an',
    };
  }
  return {
    ok: true, cstat: 137, xMotivo: 'MOCK — Nenhum documento localizado',
    ultNSU, maxNSU: ultNSU, docZips: [],
    endpoint: 'mock://an',
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
    const { empresa = 'NeuralTec', force = false, mock = null } = body || {};

    // Seleciona adapter: mock para testes, Base44 para produção real.
    // Para Plano B no futuro: troque por consultarDistribuicaoDFeMicroApi.
    const adapter = mock
      ? (r) => consultarDistribuicaoDFeMock(r, mock)
      : consultarDistribuicaoDFeBase44;

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

    // 3. Cooldown (bypass se force=true)
    if (controle.bloqueado_ate && !force) {
      const blocked = new Date(controle.bloqueado_ate);
      if (blocked > new Date()) {
        const min = Math.ceil((blocked.getTime() - Date.now()) / 60000);
        return Response.json({
          ok: false, bloqueado: true,
          motivo: `Sync bloqueado por cooldown (cStat 137/656). Liberação em ${min}min (${blocked.toLocaleString('pt-BR')}). Use force=true para ignorar.`,
        });
      }
    }

    // 4. Senha do secret — apenas via allowlist estática, nunca acesso dinâmico ao env
    const { key: secretKey, senha, permitido } = getCertSecret(cdoc.senha_secret_name);
    if (!permitido || !senha) return Response.json({ ok: false, motivo: `Secret ${secretKey} ${permitido ? 'não configurado' : 'não permitido'}` }, { status: 400 });

    // 5. PFX → PEM (pulado no modo mock — não precisa de certificado)
    let certPem = null, keyPem = null;
    if (!mock) try {
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
      const result = await adapter({
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
    const houveAlgumProgresso = novos > 0 || duplicados > 0 || lastResult?.cstat === 137;
    const updateControle = {
      ultima_consulta: new Date().toISOString(),
      ultimo_cstat: lastResult?.cstat || null,
      ultimo_nsu: nsuAtual,
      max_nsu_servidor: lastResult?.maxNSU || controle.max_nsu_servidor,
      tentativas_consecutivas_erro: houveAlgumProgresso
        ? 0
        : (controle.tentativas_consecutivas_erro || 0) + 1,
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