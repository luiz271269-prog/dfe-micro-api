// Lista TODOS os arquivos XML de uma pasta do Google Drive (modo varredura forense).
// Modo de uso: { folder_id: "..." } ou { folder_name_query: "Retorno" } para procurar pelo nome.
// Retorna array de { id, name, modifiedTime, size } pronto para enfileirar no analisarXMLNFe.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Drive "Financeiro"

async function driveFetch(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { folder_id, folder_name_query, only_new = true } = body || {};

    const { accessToken } = await base44.connectors.getCurrentAppUserConnection(CONNECTOR_ID);

    let targetFolderId = folder_id;
    let targetFolderName = '';

    // Se não recebeu folder_id, procura pelo nome
    if (!targetFolderId && folder_name_query) {
      const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name contains '${folder_name_query}' and trashed=false`);
      const folderRes = await driveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,parents)&pageSize=20`,
        accessToken
      );
      if (!folderRes.files?.length) {
        return Response.json({ error: `Nenhuma pasta encontrada com "${folder_name_query}"`, sugestao: 'Selecione a pasta manualmente uma vez para o sistema memorizar o ID.' }, { status: 404 });
      }
      const candidate = folderRes.files[0];
      targetFolderId = candidate.id;
      targetFolderName = candidate.name;
    }

    if (!targetFolderId) {
      return Response.json({ error: 'folder_id ou folder_name_query é obrigatório' }, { status: 400 });
    }

    // Lista TODOS os XMLs da pasta (paginado)
    const arquivos = [];
    let pageToken = null;
    let page = 0;
    do {
      page++;
      const q = encodeURIComponent(`'${targetFolderId}' in parents and (mimeType='application/xml' or mimeType='text/xml' or name contains '.xml') and trashed=false`);
      const params = `q=${q}&fields=files(id,name,modifiedTime,size,mimeType),nextPageToken&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, accessToken);
      for (const f of (res.files || [])) {
        if (f.name?.toLowerCase().endsWith('.xml')) {
          arquivos.push({
            id: f.id,
            name: f.name,
            modifiedTime: f.modifiedTime,
            size: f.size,
          });
        }
      }
      pageToken = res.nextPageToken || null;
      if (page > 20) break; // safety: máx 20k arquivos
    } while (pageToken);

    // Filtro "only_new": remove os que já existem em NFeAnalise por drive_file_id
    let novos = arquivos;
    let jaProcessados = 0;
    if (only_new && arquivos.length > 0) {
      const ids = arquivos.map(a => a.id);
      // Busca em lotes de 100 para não estourar a query
      const existentes = new Set();
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const found = await base44.asServiceRole.entities.NFeAnalise.filter({ drive_file_id: { $in: chunk } });
        (found || []).forEach(e => existentes.add(e.drive_file_id));
      }
      jaProcessados = existentes.size;
      novos = arquivos.filter(a => !existentes.has(a.id));
    }

    return Response.json({
      folder_id: targetFolderId,
      folder_name: targetFolderName || null,
      total_na_pasta: arquivos.length,
      ja_processados: jaProcessados,
      novos: novos.length,
      arquivos: novos,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});