import { CAMPOS_FUNCIONARIO, mesmoVinculoFuncionario, queryDuplicataFuncionario } from './funcionarioCadastro.ts';
const ENTIDADES = ['FolhaPagamento','FeriasFuncionario','RescisaoFuncionario','BancoHoras'];
export async function contarVinculosFuncionario(entities, id) {
  const quantidades = await Promise.all(ENTIDADES.map(nome => entities[nome].count({ funcionario_id: id })));
  return Object.fromEntries(ENTIDADES.map((nome, i) => [nome, quantidades[i]]));
}
export async function revisarDuplicataFuncionario(entities, id, cursor) {
  const origem = await entities.Funcionario.get(id);
  if (!origem) throw new Error('Cadastro não encontrado.');
  const [page, vinculos] = await Promise.all([
    entities.Funcionario.filter({ $and: [queryDuplicataFuncionario(origem), { id: { $ne: id } }] }, { sort: 'created_date', limit: 50, cursor, fields: ['nome','cpf','empresa','data_admissao','cargo','status'] }),
    contarVinculosFuncionario(entities, id),
  ]);
  const candidatos = [];
  for (const candidato of page.items) {
    // Verifica a identidade e impede que a origem seja oferecida como destino da exclusão.
    if (candidato.id === origem.id || !mesmoVinculoFuncionario(origem, candidato)) continue;
    candidatos.push(candidato);
  }
  return { origem: { id: origem.id, nome: origem.nome, empresa: origem.empresa, data_admissao: origem.data_admissao }, candidatos, vinculos, has_more: page.has_more, next_cursor: page.next_cursor };
}
export async function excluirDuplicataFuncionario(entities, id, manterId, validateOnly) {
  if (id === manterId) throw new Error('Escolha outro cadastro para manter.');
  const [origem, destino] = await Promise.all([entities.Funcionario.get(id), entities.Funcionario.get(manterId)]);
  if (!origem || !destino || !mesmoVinculoFuncionario(origem, destino)) throw new Error('Somente cadastros duplicados da mesma pessoa, empresa e admissão podem ser excluídos.');
  const vinculos = await contarVinculosFuncionario(entities, id);
  if (validateOnly) return { ok: true, mode: 'validation', vinculos };
  const vazio = valor => valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0);
  const completar = Object.fromEntries(CAMPOS_FUNCIONARIO.filter(k => vazio(destino[k]) && !vazio(origem[k])).map(k => [k, origem[k]]));
  if (Object.keys(completar).length) await entities.Funcionario.update(manterId, completar);
  // Cada atualização altera o filtro; uma falha mantém a origem e permite retomar sem perder vínculos.
  await Promise.all(ENTIDADES.map(async nome => {
    for (let lote = 0; lote < 20; lote++) {
      const resposta = await entities[nome].updateMany({ funcionario_id: id }, { $set: { funcionario_id: manterId, funcionario_nome: destino.nome } });
      if (!resposta.has_more) return;
    }
    throw new Error('Há muitos vínculos. Repita a operação para concluir a transferência; nenhum cadastro foi excluído.');
  }));
  const restantes = await contarVinculosFuncionario(entities, id);
  if (Object.values(restantes).some(n => n > 0)) throw new Error('Ainda há vínculos no cadastro duplicado; repita a operação.');
  const mantido = await entities.Funcionario.get(manterId);
  if (!mantido || !mesmoVinculoFuncionario(origem, mantido)) throw new Error('O cadastro mantido mudou; revise antes de excluir.');
  await entities.Funcionario.delete(id);
  return { ok: true, mantido_id: manterId, vinculos_transferidos: vinculos };
}