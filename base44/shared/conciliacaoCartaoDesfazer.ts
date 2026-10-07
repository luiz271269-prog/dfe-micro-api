import { lerCompleto } from './conciliacaoLeitura.ts';
import { TIPOS_VINCULO_CARTAO } from './conciliacaoCartaoRegras.ts';
import { reservarCompraCartao, liberarCompraCartao } from './conciliacaoCartaoReserva.ts';
const campos = ['lancamento_cartao_id', 'forma_pagamento', 'status_pagamento', 'valor_pago'];
const estado = r => Object.fromEntries(campos.map(k => [k, r[k] ?? null]));
const igual = (r, alvo) => campos.every(k => (r[k] ?? null) === (alvo[k] ?? null));
export async function desfazerCompraCartao(db, compraId, userId, motivo = 'Desvinculação confirmada pelo usuário no Cruzamento Compras.') {
  const compra = await db.ItemCompra.get(compraId);
  const trilhas = await lerCompleto(db, 'VinculoCartao', { entidade_tipo: 'ItemCompra', entidade_id: compraId, fase: { $ne: 'cancelado' } });
  if (trilhas.length > 1) throw new Error('Há mais de uma trilha ativa para a compra. Revise sem excluir o histórico.');
  let trilha = trilhas[0];
  const chargeId = compra.lancamento_cartao_id || (trilha?.fase === 'cancelamento_preparado' ? trilha.lancamento_cartao_id : null);
  if (!chargeId) return null;
  const { charge, token } = await reservarCompraCartao(db, chargeId);
  try {
    const atuais = await lerCompleto(db, 'VinculoCartao', { entidade_tipo: 'ItemCompra', entidade_id: compraId, fase: { $ne: 'cancelado' } });
    if (atuais.length > 1 || (trilha && (atuais[0]?.id !== trilha.id || atuais[0]?.updated_date !== trilha.updated_date))) throw new Error('A trilha mudou durante a operação. Atualize antes de desvincular.');
    trilha = atuais[0];
    const doc = await db.ItemCompra.get(compraId);
    const [bancos, referencias] = await Promise.all([
      lerCompleto(db, 'VinculoExtrato', { entidade_tipo: 'ItemCompra', entidade_id: compraId }),
      Promise.all(TIPOS_VINCULO_CARTAO.map(async tipo => (await lerCompleto(db, tipo, { lancamento_cartao_id: chargeId }, ['id'])).map(r => `${tipo}|${r.id}`))),
    ]);
    if (doc.lancamento_bancario_id || bancos.length || doc.pagamentos_manuais?.length || referencias.flat().some(ref => ref !== `ItemCompra|${compraId}`) || (charge.item_compra_id && charge.item_compra_id !== compraId)) throw new Error('Existe outro pagamento ou vínculo associado. Revise antes de desvincular.');
    if (trilha && !['confirmado', 'cancelamento_preparado'].includes(trilha.fase)) throw new Error('Complete a trilha pendente antes de desvincular.');
    if (trilha && trilha.lancamento_cartao_id !== chargeId) throw new Error('Trilha e compra apontam para cartões diferentes.');
    const pendente = trilha?.fase === 'cancelamento_preparado';
    const antes = trilha ? JSON.parse(trilha.antes_json || '{}') : {};
    const restaurar = pendente ? JSON.parse(trilha.cancelamento_depois_json) : {
      lancamento_cartao_id: antes.lancamento_cartao_id || null,
      forma_pagamento: antes.forma_pagamento || 'nao_definida',
      status_pagamento: antes.status_pagamento || 'nao_identificado',
      valor_pago: antes.valor_pago ?? 0,
    };
    const aplicado = trilha ? JSON.parse(pendente ? trilha.cancelamento_antes_json : trilha.depois_json) : estado(doc);
    if (!igual(doc, aplicado) && !(pendente && igual(doc, restaurar))) throw new Error('O pagamento foi alterado após o vínculo. Desvinculação bloqueada para preservar as alterações.');
    if (!pendente && doc.lancamento_cartao_id !== chargeId) throw new Error('A compra não mantém o vínculo indicado na trilha.');
    const cancelamento = { fase: 'cancelamento_preparado', cancelado_por: userId, cancelamento_motivo: motivo, cancelamento_antes_json: JSON.stringify(estado(doc)), cancelamento_depois_json: JSON.stringify(restaurar) };
    if (!pendente) {
      if (trilha) await db.VinculoCartao.update(trilha.id, cancelamento);
      else trilha = await db.VinculoCartao.create({ lancamento_cartao_id: chargeId, fatura_id: charge.fatura_id, entidade_tipo: 'ItemCompra', entidade_id: compraId, valor_alocado: doc.valor_total, origem: 'manual', usuario_id: userId, execucao_id: token, motivo: 'Cancelamento solicitado de vínculo legado; o estado anterior à criação não está disponível.', antes_json: '{}', depois_json: JSON.stringify(estado(doc)), ...cancelamento });
    }
    if (!igual(doc, restaurar)) await db.ItemCompra.updateMany({ id: compraId, updated_date: doc.updated_date, lancamento_cartao_id: chargeId }, { $set: restaurar });
    const depois = await db.ItemCompra.get(compraId);
    if (!igual(depois, restaurar)) throw new Error('A compra mudou durante a desvinculação. A intenção ficou registrada para revisão.');
    await db.LancamentoCartao.updateMany({ id: chargeId, conciliacao_token: token, item_compra_id: compraId }, { $unset: { item_compra_id: '' } });
    const confirmado = await db.LancamentoCartao.get(chargeId);
    if (confirmado.item_compra_id === compraId) throw new Error('Não foi possível liberar a referência do cartão. Repita a desvinculação para completar a trilha.');
    await db.VinculoCartao.update(trilha.id, { fase: 'cancelado', cancelado_em: new Date().toISOString(), erro: '' });
    return { success: true, vinculo_id: trilha.id, historico_preservado: true };
  } finally { await liberarCompraCartao(db, chargeId, token); }
}