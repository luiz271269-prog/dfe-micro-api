import { resolverCadastro, validarCombinacao } from './classificacaoFinanceira.ts';
import { carregarGrupoCartao, assinaturaClassificacao, classificacaoDe, motivoGrupoCartao } from './grupoCartaoRevisao.ts';
import { carregarRelacionadas, ESCOPOS_RELACIONADAS, LIMITE_RELACIONADAS } from './relacionadasGrupoCartao.ts';

// Parcelas e demais compras do estabelecimento que o usuário marcou; a quantidade precisa ser a mesma que ele viu.
async function relacionadasSelecionadas(db, grupo, registros, pedido) {
  if (pedido == null) return [];
  if (typeof pedido !== 'object' || Object.keys(pedido).some(escopo => !ESCOPOS_RELACIONADAS.includes(escopo) || !Number.isInteger(pedido[escopo]) || pedido[escopo] < 1)) throw new Error('Seleção de compras do estabelecimento inválida.');
  if (!Object.keys(pedido).length) return [];
  const analise = await carregarRelacionadas(db, grupo, registros);
  const selecionadas = [];
  for (const escopo of Object.keys(pedido)) {
    if (analise.escopos[escopo].length !== pedido[escopo]) throw new Error('As compras deste estabelecimento mudaram desde a análise. Reabra a classificação antes de salvar.');
    selecionadas.push(...analise.escopos[escopo]);
  }
  if (selecionadas.length > LIMITE_RELACIONADAS) throw new Error(`Mais de ${LIMITE_RELACIONADAS} compras deste estabelecimento selecionadas. Desmarque os outros meses e classifique mês a mês.`);
  return selecionadas;
}

export async function classificarGrupoCartao(base44, user, payload, cadastro, helpers) {
  const { grupo, classificacao, modo } = payload;
  if (!['classificar','confirmar'].includes(modo)) throw new Error('Ação de revisão inválida.');
  const permitidos = resolverCadastro(cadastro, user.role);
  if (!classificacao || !permitidos.origens.includes(classificacao.origem_compra) || !permitidos.tipos.includes(classificacao.tipo_compra) || !classificacao.categoria || !permitidos.categorias.includes(classificacao.categoria)) throw new Error('Escolha quem comprou, tipo e uma categoria ativa do plano de contas.');
  const natureza = classificacao.origem_compra === 'pro_labore' ? 'pessoal' : 'empresarial';
  const validacao = validarCombinacao('LancamentoCartao', { ...classificacao, natureza }, cadastro, user.role);
  if (!validacao.valido || ['origem_compra','tipo_compra','categoria'].some(c => validacao.normalizado[c] !== classificacao[c])) throw new Error('Combinação incompatível com o plano de contas. Ajuste quem comprou, tipo ou categoria antes de salvar.');
  const db = base44.entities;
  const doGrupo = await carregarGrupoCartao(db, grupo);
  const dados = { origem_compra: classificacao.origem_compra, tipo_compra: classificacao.tipo_compra, categoria: classificacao.categoria, natureza };
  if (payload.validate_only === true) return { success: true, validate_only: true, total: doGrupo.length, classificacao: dados };
  const relacionadas = await relacionadasSelecionadas(db, grupo, doGrupo, payload.relacionadas);
  const idsRelacionadas = new Set(relacionadas.map(r => r.id));
  const registros = [...doGrupo, ...relacionadas];
  const motivos = (registro, motivo) => idsRelacionadas.has(registro.id) ? ['mesma classificação aplicada às parcelas e demais compras do estabelecimento na revisão do cartão', `a partir da fatura ${grupo.fatura_id} e estabelecimento ${grupo.estabelecimento}`] : [motivo, motivoGrupoCartao(grupo)];
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
      await db.AuditoriaClassificacao.create({ execucao_id: execucaoId, entidade_tipo: 'LancamentoCartao', entidade_id: registro.id, origem_alteracao: 'manual', confianca: 100, motivos: motivos(registro, modo === 'confirmar' ? 'sugestão confirmada pelo usuário na revisão do cartão' : 'classificação manual na revisão do cartão'), antes_json: JSON.stringify(classificacaoDe(registro)), depois_json: JSON.stringify(dados) });
      await Promise.all([helpers.atualizarVinculos(base44,'LancamentoCartao',registro.id,dados), helpers.propagarCartao(base44,'LancamentoCartao',registro.id)]);
    }));
    falhas.push(...resultados.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'Falha ao salvar ou atualizar vínculos.'));
    if (falhas.length) break;
  }
  if (!falhas.length && marcar.length) {
    await db.LancamentoCartao.bulkUpdate(marcar.map(registro => ({ id: registro.id, classificacao_conferida: assinatura })));
    await db.AuditoriaClassificacao.bulkCreate(marcar.map(registro => ({ execucao_id: execucaoId, entidade_tipo: 'LancamentoCartao', entidade_id: registro.id, origem_alteracao: 'manual', confianca: 100, motivos: motivos(registro, 'classificação mantida e conferida pelo usuário na revisão do cartão'), antes_json: JSON.stringify({ ...classificacaoDe(registro), conferida: false }), depois_json: JSON.stringify({ ...dados, conferida: true }) })));
    conferidos = marcar.length;
  }
  return { success: !falhas.length, salvos, conferidos, inalterados: registros.length - alterar.length - marcar.length, total: registros.length, relacionadas: relacionadas.length, classificacao: dados, execucao_id: execucaoId, ...(falhas.length ? { error: `${salvos} de ${alterar.length} lançamentos salvos; confira a revisão e os vínculos antes de repetir. ${falhas[0]}` } : {}) };
}