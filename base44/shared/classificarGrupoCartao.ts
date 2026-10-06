import { resolverCadastro, validarCombinacao } from './classificacaoFinanceira.ts';
export async function classificarGrupoCartao(base44, user, payload, cadastro, helpers) {
  const { grupo, classificacao, modo } = payload;
  if (!grupo || typeof grupo.fatura_id !== 'string' || !grupo.fatura_id || grupo.fatura_id.length > 120 || typeof grupo.estabelecimento !== 'string' || !grupo.estabelecimento || grupo.estabelecimento.length > 300 || !Number.isInteger(grupo.quantidade) || grupo.quantidade < 1 || grupo.quantidade > 100) throw new Error('Grupo inválido ou acima de 100 lançamentos; revise os lançamentos individuais.');
  if (!['classificar','confirmar'].includes(modo)) throw new Error('Ação de revisão inválida.');
  const permitidos = resolverCadastro(cadastro, user.role);
  if (!classificacao || !permitidos.origens.includes(classificacao.origem_compra) || !permitidos.tipos.includes(classificacao.tipo_compra) || !classificacao.categoria || !permitidos.categorias.includes(classificacao.categoria)) throw new Error('Escolha quem comprou, tipo e uma categoria ativa do plano de contas.');
  const natureza = classificacao.origem_compra === 'pro_labore' ? 'pessoal' : 'empresarial';
  const validacao = validarCombinacao('LancamentoCartao', { ...classificacao, natureza }, cadastro, user.role);
  if (!validacao.valido || ['origem_compra','tipo_compra','categoria'].some(c => validacao.normalizado[c] !== classificacao[c])) throw new Error('Combinação incompatível com o plano de contas. Ajuste quem comprou, tipo ou categoria antes de salvar.');
  const condicoes = ['origem_compra','tipo_compra'].map(campo => {
    const valor = grupo[campo];
    if (typeof valor !== 'string' || valor.length > 100) throw new Error('Classificação original do grupo inválida.');
    return valor ? { [campo]: valor } : { $or: [{ [campo]: '' }, { [campo]: null }, { [campo]: { $exists: false } }] };
  });
  const db = base44.entities;
  const pagina = await db.LancamentoCartao.filter({ fatura_id: grupo.fatura_id, estabelecimento: grupo.estabelecimento, valor: { $gt: 0 }, observacao: { $not: { $regex: 'Não faz parte', $options: 'i' } }, $and: condicoes }, { limit: 100, fields: ['origem_compra','tipo_compra','categoria','natureza'] });
  if (pagina.has_more || pagina.items.length !== grupo.quantidade) throw new Error('O grupo mudou desde a análise. Atualize a revisão antes de salvar.');
  if (/pagamento.*fatura|pgto.*fatura|pagto.*fatura|credito.*pagamento/i.test(grupo.estabelecimento)) throw new Error('Pagamento de fatura não pode ser classificado como compra.');
  const dados = { origem_compra: classificacao.origem_compra, tipo_compra: classificacao.tipo_compra, categoria: classificacao.categoria, natureza };
  if (payload.validate_only === true) return { success: true, validate_only: true, total: pagina.items.length, classificacao: dados };
  const execucaoId = `revisao-cartao-${crypto.randomUUID()}`;
  let salvos = 0;
  const falhas = [];
  for (let i = 0; i < pagina.items.length; i += 2) {
    const resultados = await Promise.allSettled(pagina.items.slice(i,i+2).map(async registro => {
      await db.LancamentoCartao.update(registro.id, dados);
      salvos += 1;
      await db.AuditoriaClassificacao.create({ execucao_id: execucaoId, entidade_tipo: 'LancamentoCartao', entidade_id: registro.id, origem_alteracao: 'manual', confianca: 100, motivos: [modo === 'confirmar' ? 'sugestão confirmada pelo usuário na revisão do cartão' : 'classificação manual na revisão do cartão', `grupo limitado à fatura ${grupo.fatura_id} e estabelecimento ${grupo.estabelecimento}`], antes_json: JSON.stringify({ origem_compra: registro.origem_compra || '', tipo_compra: registro.tipo_compra || '', categoria: registro.categoria || '', natureza: registro.natureza || '' }), depois_json: JSON.stringify(dados) });
      await Promise.all([helpers.atualizarVinculos(base44,'LancamentoCartao',registro.id,dados), helpers.propagarCartao(base44,'LancamentoCartao',registro.id)]);
    }));
    falhas.push(...resultados.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'Falha ao salvar ou atualizar vínculos.'));
    if (falhas.length) break;
  }
  return { success: !falhas.length, salvos, total: pagina.items.length, classificacao: dados, execucao_id: execucaoId, ...(falhas.length ? { error: `${salvos} de ${pagina.items.length} lançamentos salvos; confira a revisão e os vínculos antes de repetir. ${falhas[0]}` } : {}) };
}