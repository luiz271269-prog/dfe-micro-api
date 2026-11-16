import { resolverCadastro, validarCombinacao } from './classificacaoFinanceira.ts';
import { carregarGrupoCartao, assinaturaClassificacao, classificacaoDe, estaConferido, motivoGrupoCartao } from './grupoCartaoRevisao.ts';

// Marca (ou reabre) a conferência de um grupo da revisão sem alterar a classificação salva.
export async function conferirGrupoCartao(base44, user, payload, cadastro) {
  const { grupo, modo } = payload;
  if (!['conferir', 'reabrir'].includes(modo)) throw new Error('Ação de conferência inválida.');
  const db = base44.entities;
  const registros = await carregarGrupoCartao(db, grupo);
  const execucaoId = `conferencia-cartao-${crypto.randomUUID()}`;
  const auditoria = (registro, motivo, conferida) => ({ execucao_id: execucaoId, entidade_tipo: 'LancamentoCartao', entidade_id: registro.id, origem_alteracao: 'manual', confianca: 100, motivos: [motivo, motivoGrupoCartao(grupo)], antes_json: JSON.stringify({ ...classificacaoDe(registro), conferida: !conferida }), depois_json: JSON.stringify({ ...classificacaoDe(registro), conferida }) });

  if (modo === 'reabrir') {
    const alvo = registros.filter(registro => registro.classificacao_conferida);
    if (alvo.length) {
      await db.LancamentoCartao.bulkUpdate(alvo.map(registro => ({ id: registro.id, classificacao_conferida: '' })));
      await db.AuditoriaClassificacao.bulkCreate(alvo.map(registro => auditoria(registro, 'conferência reaberta pelo usuário na revisão do cartão', false)));
    }
    return { success: true, salvos: 0, conferidos: 0, reabertos: alvo.length, inalterados: registros.length - alvo.length, total: registros.length, execucao_id: execucaoId };
  }

  const permitidos = resolverCadastro(cadastro, user.role);
  for (const registro of registros) {
    const atual = classificacaoDe(registro);
    const completo = permitidos.origens.includes(atual.origem_compra) && permitidos.tipos.includes(atual.tipo_compra) && atual.categoria && permitidos.categorias.includes(atual.categoria);
    const validacao = completo ? validarCombinacao('LancamentoCartao', { ...atual, natureza: atual.origem_compra === 'pro_labore' ? 'pessoal' : 'empresarial' }, cadastro, user.role) : null;
    if (!validacao?.valido || ['origem_compra', 'tipo_compra', 'categoria'].some(campo => validacao.normalizado[campo] !== atual[campo])) return { success: false, salvos: 0, conferidos: 0, reabertos: 0, total: registros.length, error: 'Há compras neste grupo sem quem comprou, tipo ou categoria válidos no plano de contas. Use "Classificar" antes de marcar como conferida.' };
  }
  const alvo = registros.filter(registro => !estaConferido(registro));
  if (alvo.length) {
    await db.LancamentoCartao.bulkUpdate(alvo.map(registro => ({ id: registro.id, classificacao_conferida: assinaturaClassificacao(registro) })));
    await db.AuditoriaClassificacao.bulkCreate(alvo.map(registro => auditoria(registro, 'classificação conferida pelo usuário na revisão do cartão', true)));
  }
  return { success: true, salvos: 0, conferidos: alvo.length, reabertos: 0, inalterados: registros.length - alvo.length, total: registros.length, execucao_id: execucaoId };
}