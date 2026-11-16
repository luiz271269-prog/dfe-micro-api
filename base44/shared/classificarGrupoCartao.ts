import { resolverCadastro, validarCombinacao } from './classificacaoFinanceira.ts';
import { carregarGrupoCartao, assinaturaClassificacao, classificacaoDe, motivoGrupoCartao } from './grupoCartaoRevisao.ts';
export async function classificarGrupoCartao(base44, user, payload, cadastro, helpers) {
  const { grupo, classificacao, modo } = payload;
  if (!['classificar','confirmar'].includes(modo)) throw new Error('Ação de revisão inválida.');
  const permitidos = resolverCadastro(cadastro, user.role);
  if (!classificacao || !permitidos.origens.includes(classificacao.origem_compra) || !permitidos.tipos.includes(classificacao.tipo_compra) || !classificacao.categoria || !permitidos.categorias.includes(classificacao.categoria)) throw new Error('Escolha quem comprou, tipo e uma categoria ativa do plano de contas.');
  const natureza = classificacao.origem_compra === 'pro_labore' ? 'pessoal' : 'empresarial';
  const validacao = validarCombinacao('LancamentoCartao', { ...classificacao, natureza }, cadastro, user.role);
  if (!validacao.valido || ['origem_compra','tipo_compra','categoria'].some(c => validacao.normalizado[c] !== classificacao[c])) throw new Error('Combinação incompatível com o plano de contas. Ajuste quem comprou, tipo ou categoria antes de salvar.');
  const db = base44.entities;
  const registros = await carregarGrupoCartao(db, grupo);
  const dados = { origem_compra: classificacao.origem_compra, tipo_compra: classificacao.tipo_compra, categoria: classificacao.categoria, natureza };
  if (payload.validate_only === true) return { success: true, validate_only: true, total: registros.length, classificacao: dados };
  // Só grava o que muda: compras já iguais são apenas conferidas e as já conferidas ficam intocadas.
  const assinatura = assinaturaClassificacao(dados);
  const igual = registro => Object.keys(dados).every(campo => (registro[campo] || '') === dados[campo]);
  const alterar = registros.filter(registro => !igual(registro));
  const marcar = registros.filter(registro => igual(registro) && registro.classificacao_conferida !== assinatura);
  const execucaoId = `revisao-cartao-${crypto.randomUUID()}`;
  let salvos = 0, conferidos = 0;
  const falhas = [];
  for (let i = 0; i < alterar.length; i += 2) {
    const resultados = await Promise.allSettled(alterar.slice(i,i+2).map(async registro => {
      await db.LancamentoCartao.update(registro.id, { ...dados, classificacao_conferida: assinatura });
      salvos += 1;
      await db.AuditoriaClassificacao.create({ execucao_id: execucaoId, entidade_tipo: 'LancamentoCartao', entidade_id: registro.id, origem_alteracao: 'manual', confianca: 100, motivos: [modo === 'confirmar' ? 'sugestão confirmada pelo usuário na revisão do cartão' : 'classificação manual na revisão do cartão', motivoGrupoCartao(grupo)], antes_json: JSON.stringify(classificacaoDe(registro)), depois_json: JSON.stringify(dados) });
      await Promise.all([helpers.atualizarVinculos(base44,'LancamentoCartao',registro.id,dados), helpers.propagarCartao(base44,'LancamentoCartao',registro.id)]);
    }));
    falhas.push(...resultados.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'Falha ao salvar ou atualizar vínculos.'));
    if (falhas.length) break;
  }
  if (!falhas.length && marcar.length) {
    await db.LancamentoCartao.bulkUpdate(marcar.map(registro => ({ id: registro.id, classificacao_conferida: assinatura })));
    await db.AuditoriaClassificacao.bulkCreate(marcar.map(registro => ({ execucao_id: execucaoId, entidade_tipo: 'LancamentoCartao', entidade_id: registro.id, origem_alteracao: 'manual', confianca: 100, motivos: ['classificação mantida e conferida pelo usuário na revisão do cartão', motivoGrupoCartao(grupo)], antes_json: JSON.stringify({ ...classificacaoDe(registro), conferida: false }), depois_json: JSON.stringify({ ...dados, conferida: true }) })));
    conferidos = marcar.length;
  }
  return { success: !falhas.length, salvos, conferidos, inalterados: registros.length - alterar.length - marcar.length, total: registros.length, classificacao: dados, execucao_id: execucaoId, ...(falhas.length ? { error: `${salvos} de ${alterar.length} lançamentos salvos; confira a revisão e os vínculos antes de repetir. ${falhas[0]}` } : {}) };
}