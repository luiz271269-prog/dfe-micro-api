function normalizarNome(valor: string) {
  return (valor || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function nomeFolhaCompativel(nomeFolha: string, nomeCadastro: string) {
  const folha = normalizarNome(nomeFolha);
  const cadastro = normalizarNome(nomeCadastro);
  if (!folha || !cadastro) return false;
  if (folha === cadastro) return true;
  const tokensFolha = folha.split(' ');
  const tokensCadastro = cadastro.split(' ');
  if (tokensCadastro.length === 1) return false;
  return tokensFolha.length === 1 && tokensFolha[0] === tokensCadastro[0];
}