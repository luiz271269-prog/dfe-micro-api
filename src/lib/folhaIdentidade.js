function normalizar(valor) {
  return (valor || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function funcionarioValido(folha, funcionarios) {
  if (folha.tipo_compra && folha.tipo_compra !== 'folha') return null;
  const candidatos = funcionarios.filter(f => normalizar(f.nome) === normalizar(folha.funcionario_nome) && (!folha.empresa || folha.empresa === f.empresa));
  const funcionario = funcionarios.find(f => f.id === folha.funcionario_id) || (!folha.funcionario_id && candidatos.length === 1 ? candidatos[0] : null);
  if (!funcionario) return null;
  const nomeFolha = normalizar(folha.funcionario_nome);
  const nomeCadastro = normalizar(funcionario.nome);
  const tokensCadastro = nomeCadastro.split(' ').filter(Boolean);
  const tokensFolha = nomeFolha.split(' ').filter(Boolean);
  if (tokensCadastro.length === 1 && tokensFolha.length > 1 && nomeFolha !== nomeCadastro) return null;
  return funcionario;
}

export function consolidarFolhasPorFuncionario(folhas, funcionarios, umaPorMes = false) {
  const grupos = new Map();
  for (const folha of folhas) {
    const funcionario = funcionarioValido(folha, funcionarios);
    if (!funcionario) continue;
    const chave = `${funcionario.id}|${folha.competencia}|${umaPorMes ? '' : folha.tipo || 'mensal'}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push({ ...folha, funcionario_nome: funcionario.nome, _funcionario: funcionario });
  }
  return [...grupos.values()].map(grupo => {
    const ordenado = [...grupo].sort((a, b) => {
      if (umaPorMes) {
        const pago = Number(b.status === 'pago' || b.valor_pago > 0) - Number(a.status === 'pago' || a.valor_pago > 0);
        if (pago) return pago;
        const valor = (b.salario_liquido || 0) - (a.salario_liquido || 0);
        if (valor) return valor;
      }
      const eventos = (b.eventos?.length || 0) - (a.eventos?.length || 0);
      if (eventos) return eventos;
      return Number(b.gerada_automaticamente) - Number(a.gerada_automaticamente);
    });
    const principal = ordenado[0];
    return {
      ...principal,
      _duplicatas: umaPorMes && grupo.length > 1 ? ordenado : [],
      _idsGrupo: umaPorMes ? [principal.id] : grupo.map(f => f.id),
      _valorPagoGrupo: umaPorMes ? principal.valor_pago || 0 : Math.max(...grupo.map(f => f.valor_pago || 0)),
      _algumaPaga: umaPorMes ? principal.status === 'pago' : grupo.some(f => f.status === 'pago'),
    };
  });
}