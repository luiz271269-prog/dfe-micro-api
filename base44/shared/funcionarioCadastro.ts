const escapar = valor => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const cpfFuncionario = valor => String(valor || '').replace(/\D/g, '');
export const nomeFuncionario = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
function regexNome(nome) {
  const acentos = { a: '[aáàâãä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôõö]', u: '[uúùûü]', c: '[cç]' };
  return '^\\s*' + nomeFuncionario(nome).split(' ').map(parte => [...parte].map(c => acentos[c] || escapar(c)).join('')).join('\\s+') + '\\s*$';
}
export function queryDuplicataFuncionario(func) {
  const cpf = cpfFuncionario(func.cpf);
  const nome = { nome: { $regex: regexNome(func.nome), $options: 'i' } };
  const identidades = cpf ? [{ cpf: { $regex: '^\\D*' + [...cpf].join('\\D*') + '\\D*$' } }, { $and: [nome, { $or: [{ cpf: '' }, { cpf: null }, { cpf: { $exists: false } }] }] }] : [nome];
  const datas = [{ data_admissao: func.data_admissao }, { data_admissao: '' }, { data_admissao: null }, { data_admissao: { $exists: false } }];
  return { $and: [{ empresa: func.empresa }, { $or: datas }, { $or: identidades }] };
}
export function mesmoVinculoFuncionario(a, b) {
  if (a.empresa !== b.empresa || (a.data_admissao && b.data_admissao && a.data_admissao !== b.data_admissao)) return false;
  const cpfA = cpfFuncionario(a.cpf), cpfB = cpfFuncionario(b.cpf);
  return cpfA && cpfB ? cpfA === cpfB : nomeFuncionario(a.nome) === nomeFuncionario(b.nome);
}
export const CAMPOS_FUNCIONARIO = ['nome','cpf','telefone','cargo','setor','data_admissao','data_fichamento','jornada_referencia_diaria','jornada_referencia_semanal','jornada_trabalho','data_demissao','status','salario_base','ferias_inicio','ferias_fim','tipo_contrato','empresa','conta_deposito','observacoes'];
export async function validarCadastroFuncionario(entities, data) {
  if (!data || typeof data !== 'object') throw new Error('Informe os dados do funcionário.');
  const payload = Object.fromEntries(CAMPOS_FUNCIONARIO.filter(k => data[k] !== undefined).map(k => [k, data[k]]));
  payload.nome = String(payload.nome || '').trim().replace(/\s+/g, ' ');
  payload.cpf = cpfFuncionario(payload.cpf);
  if (!payload.nome || !payload.cargo || !payload.setor || !payload.tipo_contrato || !['NeuralTec','Liesch'].includes(payload.empresa)) throw new Error('Preencha nome, cargo, setor, contrato e empresa.');
  if (payload.cpf && payload.cpf.length !== 11) throw new Error('O CPF deve conter 11 dígitos.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.data_admissao || '') || Number.isNaN(Date.parse(payload.data_admissao + 'T00:00:00Z'))) throw new Error('Informe a data de admissão.');
  const page = await entities.Funcionario.filter(queryDuplicataFuncionario(payload), { limit: 1, fields: ['nome','empresa','data_admissao'] });
  if (page.items.length) throw new Error(`Cadastro duplicado: ${page.items[0].nome} já está cadastrado nesta empresa e admissão. Abra o cadastro existente.`);
  return payload;
}