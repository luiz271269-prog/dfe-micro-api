import { evidenciasCartao, TIPOS_VINCULO_CARTAO } from './conciliacaoCartaoRegras.ts';
import { lerCompleto, vazio } from './conciliacaoLeitura.ts';
import { reservarCompraCartao, liberarCompraCartao } from './conciliacaoCartaoReserva.ts';
const snapshot = r => Object.fromEntries(['id','data','data_emissao','valor','valor_total','valor_pago','status','status_pagamento','forma_pagamento','lancamento_cartao_id','lancamento_bancario_id','tipo_compra','origem_compra','empresa'].map(k => [k, r[k] ?? null]));
export async function aplicarVinculoCartao(db, row, candidato, userId, manual, motivo) {
  const { charge, token } = await reservarCompraCartao(db, row.id);
  let trilha;
  try {
    const refs = (await Promise.all(TIPOS_VINCULO_CARTAO.map(tipo => lerCompleto(db, tipo, { lancamento_cartao_id: charge.id }, ['id'])))).flat();
    const [trilhas, documento, bancos] = await Promise.all([
      lerCompleto(db, 'VinculoCartao', { lancamento_cartao_id: charge.id, fase: { $ne: 'cancelado' } }),
      db[candidato.tipo].get(candidato.id),
      lerCompleto(db, 'VinculoExtrato', { entidade_tipo: candidato.tipo, entidade_id: candidato.id }),
    ]);
    if (refs.length || trilhas.length || bancos.length || charge.item_compra_id) throw new Error('Um dos registros já está vinculado. Nenhum novo vínculo criado.');
    if (charge.updated_date !== row.versao && row.versao && (charge.valor !== row.valor || charge.tipo_compra !== row.tipo_compra || charge.origem_compra !== row.origem_compra || (charge.empresa_beneficiada || '') !== row.empresa || charge.data_lancamento !== row.data || charge.fatura_id !== row.fatura_id)) throw new Error('Compra alterada durante a análise. Atualize.');
    if (documento.updated_date !== candidato.versao) throw new Error('Documento alterado durante a análise. Atualize.');
    const evidencia = evidenciasCartao(charge, documento, candidato.tipo, manual);
    if (!evidencia.elegivel || (!manual && !evidencia.auto)) throw new Error('Evidência insuficiente ou conflito. Nenhum vínculo criado.');
    const antes = snapshot(documento);
    if (!(await db.FaturaCartao.get(charge.fatura_id))?.id) throw new Error('Fatura não encontrada. Nenhum vínculo criado.');
    // Composição não é pagamento: valores e situações financeiras do documento permanecem intactos.
    const patch = { lancamento_cartao_id: charge.id, forma_pagamento: 'cartao' };
    const composicao = doc => ({ ...snapshot(doc), modelo_cartao: 'composicao' });
    // Intenção durável com antes/depois antes de qualquer modificação financeira.
    trilha = await db.VinculoCartao.create({
      lancamento_cartao_id: charge.id, fatura_id: charge.fatura_id, entidade_tipo: candidato.tipo, entidade_id: documento.id,
      valor_alocado: Number(charge.valor), origem: manual ? 'manual' : 'automatico', usuario_id: userId, execucao_id: token, fase: 'preparado',
      motivo: motivo || 'Correspondência única nos dois sentidos: valor em centavos, data até 3 dias, fornecedor, empresa e classificação comprovados.',
      antes_json: JSON.stringify(antes), depois_json: JSON.stringify(composicao({ ...documento, ...patch })),
    });
    if (!trilha?.id) throw new Error('Não foi possível preparar a trilha de auditoria.');
    // Condicional atômica: só modifica o documento ainda livre e inalterado.
    await db[candidato.tipo].updateMany({ $and: [{ id: documento.id, updated_date: documento.updated_date }, vazio('lancamento_cartao_id'), vazio('lancamento_bancario_id')] }, { $set: patch });
    const depois = await db[candidato.tipo].get(documento.id);
    if (depois.lancamento_cartao_id !== charge.id) throw new Error('Documento ocupado por outra execução. Atualize.');
    if (candidato.tipo === 'ItemCompra') await db.LancamentoCartao.update(charge.id, { item_compra_id: documento.id });
    await db.VinculoCartao.update(trilha.id, { fase: 'confirmado', depois_json: JSON.stringify(composicao(depois)), erro: '' });
    return { id: charge.id, entidade_tipo: candidato.tipo, entidade_id: documento.id, valor_alocado: Number(charge.valor) };
  } catch(error) {
    if (trilha?.id) await db.VinculoCartao.update(trilha.id, { fase: 'falha', erro: String(error.message).slice(0,1000) });
    throw error;
  } finally {
    await liberarCompraCartao(db, charge.id, token);
  }
}