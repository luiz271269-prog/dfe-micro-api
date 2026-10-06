export function normalizarSimulacao(linhas) {
  return linhas.slice(0,30).map(r => Object.fromEntries(Object.entries({ descricao: String(r.descricao || '').slice(0,120), base: Number(r.base)||0, quantidade:Number(r.quantidade)||0, acrescimos:Number(r.acrescimos)||0, descontos:Number(r.descontos)||0 })));
}
export function dadosDocumentoSalvos(doc, linhas) {
  return { simulacao_manual: normalizarSimulacao(linhas), ...(doc?.file_uri ? { documento_file_uri:doc.file_uri, documento_nome:doc.nome, documento_dados_json:JSON.stringify(doc.dados) } : {}) };
}
export function formularioDocumento(doc, funcionarios) {
  const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const matches = funcionarios.filter(f => normalizar(f.nome) === normalizar(doc.dados.funcionario_nome));
  return { ...doc.dados, funcionario_nome: matches.length === 1 ? matches[0].nome : '' };
}