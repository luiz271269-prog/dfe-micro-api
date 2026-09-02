// Motor de resumo da Folha de Pagamento para o dashboard (navegação temporal, KPIs, evolução, por setor)

export function mesesAnteriores(competencia, n = 12) {
  const [y, m] = competencia.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function rotuloMesCurto(competencia) {
  const [y, m] = competencia.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[parseInt(m) - 1]}. de ${y}`;
}

export function resumoCompetencia(folhas, funcionarios, competencia) {
  const itens = folhas.filter(f => f.competencia === competencia);
  const bruto = itens.reduce((s, f) => s + (f.salario_bruto || 0), 0);
  const liquido = itens.reduce((s, f) => s + (f.salario_liquido || 0), 0);
  const qtd = new Set(itens.map(f => f.funcionario_nome)).size;
  const media = qtd ? bruto / qtd : 0;

  const setores = {};
  itens.forEach(f => {
    const setor = funcionarios.find(fn => fn.nome === f.funcionario_nome)?.setor || 'outros';
    if (!setores[setor]) setores[setor] = { total: 0, nomes: new Set() };
    setores[setor].total += f.salario_bruto || 0;
    setores[setor].nomes.add(f.funcionario_nome);
  });
  const porSetor = Object.entries(setores)
    .map(([setor, v]) => ({ setor, total: v.total, qtd: v.nomes.size, media: v.total / v.nomes.size }))
    .sort((a, b) => b.total - a.total);

  return { competencia, itens, bruto, liquido, qtd, media, porSetor };
}

export function variacaoPct(atual, anterior) {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}