import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { consultarDistribuicaoDFeMicroApi } from '../../shared/dfeMicroApi.ts';
import { carregarCertificadoMtls } from '../../shared/dfeCertificate.ts';

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_XML_BYTES = 10 * 1024 * 1024;
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
//   - consultarDistribuicaoDFeMicroApi → produção: micro-API externa com mTLS
//   - consultarDistribuicaoDFeMock     → teste: simula 137/138 em cursor isolado
//
// ============================================================

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
  const reader = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_XML_BYTES) {
      await reader.cancel();
      throw new Error('XML descompactado excede o limite de 10 MB.');
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8').decode(output);
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
export default async function(req) {
  const t0 = Date.now();
  const request_id = `sync_${Date.now()}`;
  let base44Client = null;
  let lockedControleId = null;

  try {
    const base44 = createClientFromRequest(req);
    base44Client = base44;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { empresa = 'NeuralTec', mock = null } = body || {};

    // Mock e produção usam cursores e documentos independentes.
    const origemCursor = mock ? 'mock' : 'real';

    // 1. Certificado ativo + válido
    const certs = await base44.asServiceRole.entities.CertificadoDigitalNFe.filter({
      empresa, is_ativo: true, status_validacao: 'valido',
    });
    const cdoc = certs?.[0];
    if (!cdoc) return Response.json({
      ok: false,
      motivo: `Nenhum certificado ativo+válido para ${empresa}. Cadastre e valide em /certificado-nfe.`
    }, { status: 400 });

    // 2. ControleNSU isolado por empresa, ambiente e origem (real/mock)
    let controles = await base44.asServiceRole.entities.ControleNSU.filter({
      empresa,
      ambiente: cdoc.ambiente,
      origem_cursor: origemCursor,
    });
    let controle = controles?.[0];
    if (!controle) {
      controle = await base44.asServiceRole.entities.ControleNSU.create({
        empresa,
        ambiente: cdoc.ambiente,
        origem_cursor: origemCursor,
        cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
        ultimo_nsu: '000000000000000',
        max_nsu_servidor: '000000000000000',
        estado_sincronizacao: 'em_backlog',
      });
    }

    // 3. Cooldown fiscal durável e sem bypass em produção.
    if (origemCursor === 'real' && controle.bloqueado_ate) {
      const blocked = new Date(controle.bloqueado_ate);
      if (blocked > new Date()) {
        const min = Math.ceil((blocked.getTime() - Date.now()) / 60000);
        return Response.json({
          ok: false, bloqueado: true,
          motivo: `Consulta fiscal bloqueada por cooldown. Liberação em ${min}min (${blocked.toLocaleString('pt-BR')}).`,
        }, { status: 429 });
      }
    }

    // 4. Trava uma única execução real por empresa/ambiente.
    if (origemCursor === 'real') {
      const inicioAnterior = controle.execucao_iniciada_em ? new Date(controle.execucao_iniciada_em).getTime() : 0;
      const lockExpirado = inicioAnterior > 0 && Date.now() - inicioAnterior > LOCK_TIMEOUT_MS;
      if (controle.execucao_em_andamento && !lockExpirado) {
        return Response.json({ ok: false, bloqueado: true, motivo: 'Já existe uma sincronização fiscal em andamento.' }, { status: 409 });
      }
      if (lockExpirado) {
        await base44.asServiceRole.entities.ControleNSU.update(controle.id, { execucao_em_andamento: false, execucao_id: '' });
      }
      await base44.asServiceRole.entities.ControleNSU.updateMany(
        { id: controle.id, execucao_em_andamento: { $ne: true } },
        { $set: { execucao_em_andamento: true, execucao_id: request_id, execucao_iniciada_em: new Date().toISOString() } },
      );
      const atualizados = await base44.asServiceRole.entities.ControleNSU.filter({ id: controle.id });
      controle = atualizados?.[0];
      if (!controle || controle.execucao_id !== request_id) {
        return Response.json({ ok: false, bloqueado: true, motivo: 'Outra sincronização adquiriu a trava fiscal.' }, { status: 409 });
      }
      lockedControleId = controle.id;
    }

    // 5. O PFX reside no Base44 e só é enviado em memória durante a chamada mTLS.
    const credenciaisMtls = origemCursor === 'real' ? await carregarCertificadoMtls(base44, cdoc) : null;
    const adapter = mock
      ? (r) => consultarDistribuicaoDFeMock(r, mock)
      : (r) => consultarDistribuicaoDFeMicroApi({
          ...r,
          empresa,
          requestId: request_id,
          url: secrets.get('DFE_MICRO_API_URL'),
          token: secrets.get('DFE_MICRO_API_TOKEN'),
          certificadoPfxBase64: credenciaisMtls.pfxBase64,
          certificadoSenha: credenciaisMtls.senha,
        });

    // 6. LOOP de consulta via adapter.
    let nsuAtual = controle.ultimo_nsu || '000000000000000';
    const nsuInicial = nsuAtual;
    let novos = 0, duplicados = 0, erros = 0, totalDocs = 0;
    let lastResult = null;
    let loops = 0;
    let break_reason = '';
    const maxLoops = origemCursor === 'real' ? 1 : MAX_LOOPS_POR_EXECUCAO;

    while (loops < maxLoops) {
      loops++;
      const result = await adapter({
        ambiente: cdoc.ambiente,
        cnpj: cdoc.cnpj_sem_mascara,
        ultNSU: nsuAtual,
      });
      lastResult = result;

      // Uma resposta fiscal válida consome a janela; persiste o cooldown antes de processar documentos.
      if (origemCursor === 'real' && [137, 138, 656].includes(result.cstat)) {
        await base44.asServiceRole.entities.ControleNSU.update(controle.id, {
          bloqueado_ate: new Date(Date.now() + COOLDOWN_MS).toISOString(),
          ultima_consulta: new Date().toISOString(),
        });
      }

      // Falha de transporte/contrato: não avança o cursor e nunca retorna falso sucesso.
      if (!result.ok && ![137, 138, 656].includes(result.cstat)) {
        const motivo = result.motivo || result.xMotivo || 'Falha desconhecida no transporte fiscal.';
        await base44.asServiceRole.entities.ControleNSU.update(controle.id, {
          ultima_consulta: new Date().toISOString(),
          ultimo_status: 'erro',
          estado_sincronizacao: 'erro',
          ultimo_erro: motivo,
          tentativas_consecutivas_erro: (controle.tentativas_consecutivas_erro || 0) + 1,
        });
        await base44.asServiceRole.entities.LogSyncSEFAZ.create({
          request_id, empresa, origem_execucao: origemCursor, cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
          data_execucao: new Date().toISOString(), duracao_ms: Date.now() - t0,
          nsu_inicial: nsuInicial, nsu_final: nsuAtual,
          cstat: result.cstat, x_motivo: result.xMotivo,
          status_final: 'erro', mensagem: motivo, endpoint: result.endpoint,
        });
        return Response.json({
          ok: false,
          motivo,
          http_status: result.http_status || null,
          endpoint: result.endpoint || null,
        }, { status: 502 });
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
          request_id, empresa, origem_execucao: origemCursor, cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
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

      // cStat 138 → só avança além dos documentos persistidos com sucesso.
      if (result.cstat === 138) {
        if (!result.docZips || result.docZips.length === 0) {
          break_reason = 'cstat_138_sem_docs';
          break;
        }
        let ultimoNsuSeguro = nsuAtual;
        let loteFalhou = false;
        for (const dz of result.docZips) {
          totalDocs++;
          try {
            const xml = await gunzipBase64(dz.data);
            const meta = parseNFeXml(xml);
            if (!meta.chave_acesso) throw new Error(`NSU ${dz.nsu} sem chave de acesso — schema ${dz.schema}`);

            const dup = await base44.asServiceRole.entities.NFeRecebida.filter({
              chave_acesso: meta.chave_acesso,
              origem_documento: origemCursor,
            });
            if (dup && dup.length > 0) {
              duplicados++;
              ultimoNsuSeguro = dz.nsu || ultimoNsuSeguro;
              continue;
            }

            const xmlBlob = new Blob([xml], { type: 'application/xml' });
            const xmlFile = new File([xmlBlob], `${meta.chave_acesso}.xml`, { type: 'application/xml' });
            const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: xmlFile });

            await base44.asServiceRole.entities.NFeRecebida.create({
              chave_acesso: meta.chave_acesso,
              nsu: dz.nsu,
              origem_documento: origemCursor,
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
            ultimoNsuSeguro = dz.nsu || ultimoNsuSeguro;
          } catch (e) {
            erros++;
            loteFalhou = true;
            console.error(`Erro processando NSU ${dz.nsu}:`, e.message);
            break;
          }
        }
        if (loteFalhou) {
          nsuAtual = ultimoNsuSeguro;
          break_reason = 'erro_persistencia_doczip';
          break;
        }
        nsuAtual = result.ultNSU || ultimoNsuSeguro;
        if (result.ultNSU && result.maxNSU && result.ultNSU >= result.maxNSU) {
          break_reason = 'alcancou_max_nsu';
          break;
        }
        continue;
      }

      // cStat inesperado
      erros++;
      break_reason = `cstat_inesperado_${result.cstat}`;
      break;
    }

    if (loops >= maxLoops && !break_reason) break_reason = origemCursor === 'real' ? 'limite_fiscal_1_lote_hora' : 'limite_loops';

    // 7. Atualizar ControleNSU
    const houveAlgumProgresso = novos > 0 || duplicados > 0 || lastResult?.cstat === 137;
    const maxNsuAtual = lastResult?.maxNSU || controle.max_nsu_servidor;
    const updateControle = {
      ultima_consulta: new Date().toISOString(),
      ultimo_cstat: lastResult?.cstat || null,
      ultimo_nsu: nsuAtual,
      max_nsu_servidor: maxNsuAtual,
      estado_sincronizacao: erros > 0
        ? 'erro'
        : (maxNsuAtual && nsuAtual < maxNsuAtual ? 'em_backlog' : 'sincronizado'),
      tentativas_consecutivas_erro: houveAlgumProgresso
        ? 0
        : (controle.tentativas_consecutivas_erro || 0) + 1,
    };
    if (origemCursor === 'real' && lastResult?.cstat) {
      updateControle.bloqueado_ate = new Date(Date.now() + COOLDOWN_MS).toISOString();
    }
    if (lastResult?.cstat === 137) {
      updateControle.ultimo_status = 'vazio';
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
    const statusFinal = erros > 0 ? 'erro'
                      : novos > 0 ? 'ok'
                      : lastResult?.cstat === 137 ? 'sem_novos'
                      : 'ok';
    const log = await base44.asServiceRole.entities.LogSyncSEFAZ.create({
      request_id, empresa, origem_execucao: origemCursor, cnpj_sem_mascara: cdoc.cnpj_sem_mascara,
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
      ok: erros === 0,
      novos, duplicados, erros, totalDocs, loops,
      cstat: lastResult?.cstat, x_motivo: lastResult?.xMotivo,
      nsu_inicial: nsuInicial, nsu_final: nsuAtual, max_nsu: lastResult?.maxNSU,
      break_reason, log_id: log.id,
    }, { status: erros === 0 ? 200 : 500 });
  } catch (error) {
    console.error('sincronizarNFeAN erro:', error);
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  } finally {
    if (base44Client && lockedControleId) {
      await base44Client.asServiceRole.entities.ControleNSU.update(lockedControleId, {
        execucao_em_andamento: false,
        execucao_id: '',
      }).catch((error) => console.error('Falha liberando trava fiscal:', error.message));
    }
  }
}