const escapar = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function queryFuncionario(func) {
  return { $or: [{ funcionario_id: { $in: func._idsIdentidade || [func.id] } }, { $and: [
    { $or: [{ funcionario_id: { $exists: false } }, { funcionario_id: '' }, { funcionario_id: null }] },
    { funcionario_nome: { $regex: `^${escapar(func.nome)}$`, $options: 'i' } },
    { $or: [{ empresa: func.empresa }, { empresa: { $exists: false } }, { empresa: '' }] },
  ] }] };
}
export async function resolverFuncionario(entities, folha) {
  let func;
  if (folha.funcionario_id) func = await entities.Funcionario.get(folha.funcionario_id);
  else {
    const query = { nome: { $regex: `^${escapar(folha.funcionario_nome)}$`, $options: 'i' }, ...(folha.empresa ? { empresa: folha.empresa } : {}) };
    const { items } = await entities.Funcionario.filter(query, { limit: 2 });
    if (items.length !== 1) throw new Error('Selecione um funcionário cadastrado, identificado sem ambiguidade.');
    func = items[0];
  }
  if (!func) throw new Error('Funcionário não encontrado.');
  if (!/^\d{11}$/.test(String(func.cpf || '').replace(/\D/g, '')) || !func.data_admissao) return func;
  const page = await entities.Funcionario.filter({ cpf: func.cpf, empresa: func.empresa, data_admissao: func.data_admissao }, { sort: 'created_date', limit: 50 });
  if (page.has_more) throw new Error('Revise os cadastros repetidos deste funcionário.');
  return { ...page.items[0], _idsIdentidade: page.items.map(f => f.id), data_demissao: page.items.map(f => f.data_demissao).filter(Boolean).sort()[0] || func.data_demissao };
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
export function queryTipoFolha(tipo = 'mensal') {
  return tipo === 'mensal' ? { $or: [{ tipo: 'mensal' }, { tipo: { $exists: false } }, { tipo: '' }, { tipo: null }] } : { tipo };
}
export async function validarNovaFolha(entities, data) {
  if (!['mensal','ferias','rescisao','decimo_terceiro'].includes(data.tipo || 'mensal')) throw new Error('Tipo de folha inválido.');
  const func = await resolverFuncionario(entities, data);
  const motivo = await impedimentoFolha(entities, func, data.competencia, data.tipo || 'mensal');
  if (motivo) throw new Error(motivo);
  const count = await entities.FolhaPagamento.count({ $and: [queryFuncionario(func), { competencia: data.competencia }, queryTipoFolha(data.tipo)] });
  if (count) throw new Error('Já existe folha deste tipo para este funcionário nesta competência. Revise o lançamento existente; férias e rescisão não substituem a folha mensal.');
  return func;
}
export async function criarFolhaValidada(entities, data) {
  const func = await validarNovaFolha(entities, data);
  return await entities.FolhaPagamento.create({ ...data, funcionario_id: func.id, funcionario_nome: func.nome, empresa: func.empresa, tipo: data.tipo || 'mensal' });
}