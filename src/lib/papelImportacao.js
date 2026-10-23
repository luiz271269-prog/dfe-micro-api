// O contrato de papéis e conciliações é entregue pela matriz canônica do servidor.
export function arquivoDoLote(batch) {
  let notes={};
  if(batch.notes?.startsWith('http')) return {url:batch.notes};
  try { notes=JSON.parse(batch.notes || '{}'); } catch { notes={}; }
  return {uri:batch.file_uri || notes.file_uri, url:notes.file_url};
}