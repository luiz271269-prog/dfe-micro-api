function normalizar(texto) {
  return (texto || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function classificarNaturezaExtrato(lancamento) {
  const texto = normalizar(`${lancamento?.descricao || ''} ${lancamento?.detalhe || ''}`);
  const aplicacao = /\b(aplicacao|investimento|cdb|rdb|lci|lca|tesouro|poupanca|fundo|resgate)\b/.test(texto);
  if (aplicacao) return 'aplicacao';
  if ((lancamento?.valor || 0) > 0) return 'entrada';
  if ((lancamento?.valor || 0) < 0) return 'saida';
  return 'outro';
}

export function ehSaidaContasPagar(lancamento) {
  return classificarNaturezaExtrato(lancamento) === 'saida' &&
    lancamento?.categoria !== 'transferencia' &&
    lancamento?.categoria !== 'interno';
}