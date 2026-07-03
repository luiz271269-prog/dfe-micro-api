// Varredura diária automática das pastas vinculadas no Google Drive.
// - Pastas tipo "xml": lista XMLs novos e dispara analisarXMLNFe em lote (deduplicado por chave_acesso/drive_file_id).
// - Pastas tipo "comprovante": lista PDFs/imagens novos e cria registros em ComprovanteInbox (deduplicado por drive_file_id).
// Projetada para rodar via automação agendada (sem usuário logado) usando service role.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Google Drive "Financeiro"
const BATCH_SIZE = 10;

const COMPROVANTE_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/webp',
];

async function driveFetch(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Lista todos os arquivos de uma pasta (paginado), opcionalmente filtrando por mimeType
async function listarPasta(folderId, token) {
  const arquivos = [];
  let pageToken = null;
  let page = 0;
  do {
    page++;
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const params = `q=${q}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink),nextPageToken&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, token);
    for (const f of (res.files || [])) arquivos.push(f);
    pageToken = res.nextPageToken || null;
    if (page > 20) break;
  } while (pageToken);
  return arquivos;
}

async function processarPastaXML(base44, config, token) {
  const todos = await listarPasta(config.folder_id, token);
  const xmls = todos.filter(f => f.name?.toLowerCase().endsWith('.xml'));

  // Dedup por drive_file_id já existente em NFeAnalise
  const existentes = new Set();
  const ids = xmls.map(a => a.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const found = await base44.asServiceRole.entities.NFeAnalise.filter({ drive_file_id: { $in: chunk } });
    (found || []).forEach(e => existentes.add(e.drive_file_id));
  }
  const novos = xmls.filter(a => !existentes.has(a.id));

  let ok = 0, erros = 0;
  for (let i = 0; i < novos.length; i += BATCH_SIZE) {
    const lote = novos.slice(i, i + BATCH_SIZE).map(a => a.id);
    try {
      const res = await base44.functions.invoke('analisarXMLNFe', { file_ids: lote });
      const data = res?.data || res;
      for (const r of (data?.resultados || [])) {
        if (r.error) erros++; else ok++;
      }
    } catch (e) {
      erros += lote.length;
    }
  }

  return { tipo: 'xml', total_na_pasta: xmls.length, ja_processados: existentes.size, novos: novos.length, ok, erros };
}

async function processarPastaComprovante(base44, config, token) {
  const todos = await listarPasta(config.folder_id, token);
  const comprovantes = todos.filter(f => COMPROVANTE_MIMES.includes(f.mimeType));

  const existentes = new Set();
  const ids = comprovantes.map(a => a.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const found = await base44.asServiceRole.entities.ComprovanteInbox.filter({ drive_file_id: { $in: chunk } });
    (found || []).forEach(e => existentes.add(e.drive_file_id));
  }
  const novos = comprovantes.filter(a => !existentes.has(a.id));

  let ok = 0, erros = 0;
  if (novos.length > 0) {
    const payloads = novos.map(f => ({
      drive_file_id: f.id,
      drive_file_url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      nome_arquivo: f.name,
      mime_type: f.mimeType,
      tamanho_bytes: f.size ? parseInt(f.size) : 0,
      modificado_em: f.modifiedTime,
      folder_id: config.folder_id,
      status: 'novo',
    }));
    try {
      await base44.asServiceRole.entities.ComprovanteInbox.bulkCreate(payloads);
      ok = payloads.length;
    } catch (e) {
      erros = payloads.length;
    }
  }

  return { tipo: 'comprovante', total_na_pasta: comprovantes.length, ja_processados: existentes.size, novos: novos.length, ok, erros };
}

// Tipos genéricos (extrato, fatura, boletos, folha, etc.): coleta arquivos novos
// para o ArquivoImportInbox, já marcados com o tipo da pasta. A IA processa depois.
const GENERICO_MIMES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp',
  'text/csv', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-ofx', 'application/ofx',
];

async function processarPastaGenerica(base44, config, token) {
  const todos = await listarPasta(config.folder_id, token);
  const arquivos = todos.filter(f =>
    GENERICO_MIMES.includes(f.mimeType) ||
    /\.(pdf|png|jpe?g|csv|xlsx|ofx|qfx|txt)$/i.test(f.name || '')
  );

  const existentes = new Set();
  const ids = arquivos.map(a => a.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const found = await base44.asServiceRole.entities.ArquivoImportInbox.filter({ drive_file_id: { $in: chunk } });
    (found || []).forEach(e => existentes.add(e.drive_file_id));
  }
  const novos = arquivos.filter(a => !existentes.has(a.id));

  let ok = 0, erros = 0;
  if (novos.length > 0) {
    const payloads = novos.map(f => ({
      drive_file_id: f.id,
      drive_file_url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      nome_arquivo: f.name,
      mime_type: f.mimeType,
      tamanho_bytes: f.size ? parseInt(f.size) : 0,
      modificado_em: f.modifiedTime,
      folder_id: config.folder_id,
      tipo_import: config.tipo_pasta,
      status: 'novo',
    }));
    try {
      await base44.asServiceRole.entities.ArquivoImportInbox.bulkCreate(payloads);
      ok = payloads.length;
    } catch (e) {
      erros = payloads.length;
    }
  }

  return { tipo: config.tipo_pasta, total_na_pasta: arquivos.length, ja_processados: existentes.size, novos: novos.length, ok, erros };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // A automação agendada roda SEM usuário logado → getCurrentAppUserConnection falha
    // ("No active connection found"). Usa a conexão compartilhada do builder (SHARED,
    // keyed por integration_type), com fallback para a conexão do usuário atual (connector
    // "Financeiro") quando chamada manualmente pela tela.
    let accessToken;
    try {
      ({ accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive'));
    } catch {
      accessToken = null;
    }
    if (!accessToken) {
      try {
        ({ accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID));
      } catch {
        accessToken = null;
      }
    }
    if (!accessToken) {
      return Response.json({ error: 'Conexão com o Google Drive não disponível' }, { status: 400 });
    }

    const configs = await base44.asServiceRole.entities.ConfigDrivePastaXML.filter({ ativo: true });
    if (!configs || configs.length === 0) {
      return Response.json({ executadas: 0, mensagem: 'Nenhuma pasta ativa configurada' });
    }

    const resultados = [];
    for (const config of configs) {
      if (!config.folder_id) continue;
      let resumo;
      try {
        if (config.tipo_pasta === 'comprovante') {
          resumo = await processarPastaComprovante(base44, config, accessToken);
        } else if (!config.tipo_pasta || config.tipo_pasta === 'xml') {
          resumo = await processarPastaXML(base44, config, accessToken);
        } else {
          resumo = await processarPastaGenerica(base44, config, accessToken);
        }
        await base44.asServiceRole.entities.ConfigDrivePastaXML.update(config.id, {
          ultima_varredura: new Date().toISOString(),
          ultima_quantidade: resumo.total_na_pasta,
          ultimo_processados: resumo.ok,
          ultimo_status: `ok · ${resumo.novos} novos · ${resumo.ok} processados · ${resumo.erros} erros`,
        });
      } catch (e) {
        resumo = { tipo: config.tipo_pasta, erro: e.message };
        await base44.asServiceRole.entities.ConfigDrivePastaXML.update(config.id, {
          ultima_varredura: new Date().toISOString(),
          ultimo_status: `erro · ${e.message}`,
        });
      }
      resultados.push({ folder_name: config.folder_name, ...resumo });
    }

    return Response.json({ executadas: resultados.length, resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});