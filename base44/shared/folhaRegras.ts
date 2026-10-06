const escapar = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function queryFuncionario(func) {
  return { $or: [{ funcionario_id: func.id }, { $and: [
    { $or: [{ funcionario_id: { $exists: false } }, { funcionario_id: '' }, { funcionario_id: null }] },
    { funcionario_nome: { $regex: `^${escapar(func.nome)}$`, $options: 'i' } },
    { $or: [{ empresa: func.empresa }, { empresa: { $exists: false } }, { empresa: '' }] },
  ] }] };
}
export async function resolverFuncionario(entities, folha) {
  if (folha.funcionario_id) return await entities.Funcionario.get(folha.funcionario_id);
  const query = { nome: { $regex: `^${escapar(folha.funcionario_nome)}$`, $options: 'i' }, ...(folha.empresa ? { empresa: folha.empresa } : {}) };
  const { items } = await entities.Funcionario.filter(query, { limit: 2 });
  if (items.length !== 1) throw new Error('Selecione um funcionário cadastrado, identificado sem ambiguidade.');
  return items[0];
}
export async function impedimentoFolha(entities, func, competencia, tipo = 'mensal') {
  if (!func || !/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia || '')) return 'Funcionário ou competência inválida.';
  if (func.data_admissao && competencia < func.data_admissao.slice(0, 7)) return 'Não é permitido gerar folha anterior à admissão.';
  const { items } = await entities.RescisaoFuncionario.filter(queryFuncionario(func), { sort: 'data_desligamento', limit: 1, fields: ['data_desligamento'] });
  const datas = [func.data_demissao, items[0]?.data_desligamento].filter(Boolean).sort();
  const desligamento = datas[0];
  if (desligamento && (competencia > desligamento.slice(0, 7) || (competencia === desligamento.slice(0, 7) && tipo !== 'rescisao'))) {
    return `Novas folhas bloqueadas a partir da competência da rescisão (${desligamento}). Use a folha existente para os acertos.`;
  }
  if (!desligamento && func.status === 'desligado') return 'Funcionário desligado: informe a data de demissão no cadastro antes de gerar folhas históricas.';
  return null;
}
export async function validarNovaFolha(entities, data) {
  const func = await resolverFuncionario(entities, data);
  const motivo = await impedimentoFolha(entities, func, data.competencia, data.tipo || 'mensal');
  if (motivo) throw new Error(motivo);
  const count = await entities.FolhaPagamento.count({ ...queryFuncionario(func), competencia: data.competencia });
  if (count) throw new Error('Já existe folha para este funcionário nesta competência. Lance as verbas na folha existente, sem criar outro lançamento.');
  return func;
}
export async function criarFolhaValidada(entities, data) {
  const func = await validarNovaFolha(entities, data);
  return await entities.FolhaPagamento.create({ ...data, funcionario_id: func.id, funcionario_nome: func.nome, empresa: func.empresa, tipo: data.tipo || 'mensal' });
}