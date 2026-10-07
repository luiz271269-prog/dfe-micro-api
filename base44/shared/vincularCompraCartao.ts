import { aplicarVinculoCartao } from './conciliacaoCartaoAplicar.ts';
import { carregarCandidatosCartao } from './conciliacaoCartaoDados.ts';
import { evidenciasCartao, compraReal } from './conciliacaoCartaoRegras.ts';
import { lerCompleto } from './conciliacaoLeitura.ts';
export async function vincularCompraCartao(db, compra, chargeId, userId, payload) {
  const charge = await db.LancamentoCartao.get(chargeId);
  const fatura = await db.FaturaCartao.get(charge.fatura_id);
  if (!fatura?.id) throw new Error('Fatura do lançamento não encontrada.');
  const trilhas = await lerCompleto(db, 'VinculoCartao', { lancamento_cartao_id: chargeId, fase: { $ne: 'cancelado' } });
  if (compra.lancamento_cartao_id === chargeId && charge.item_compra_id === compra.id && trilhas.some(t => t.entidade_tipo === 'ItemCompra' && t.entidade_id === compra.id && t.fase === 'confirmado')) return { success: true, ja_vinculado: true };
  const automatico = payload.automatico === true;
  const evidencia = evidenciasCartao(charge, compra, 'ItemCompra', !automatico);
  if (!evidencia.elegivel) throw new Error('Valor, data ou vínculo incompatível; revise a compra e o cartão antes de confirmar.');
  if (automatico) {
    const dados = await carregarCandidatosCartao(db, [charge]);
    const ocupado = l => l.item_compra_id || dados.referencias.some(d => d.reg.lancamento_cartao_id === l.id) || dados.trilhas.some(t => t.lancamento_cartao_id === l.id && t.fase !== 'cancelado');
    const destinos = dados.documentos.filter(d => evidenciasCartao(charge, d.reg, d.tipo).elegivel && !dados.bancos.some(v => v.entidade_tipo === d.tipo && v.entidade_id === d.reg.id));
    const concorrentes = dados.concorrentes.filter(l => compraReal(l) && !ocupado(l) && evidenciasCartao(l, compra, 'ItemCompra').elegivel);
    if (!evidencia.auto || ocupado(charge) || destinos.length !== 1 || destinos[0].tipo !== 'ItemCompra' || destinos[0].reg.id !== compra.id || concorrentes.length !== 1 || concorrentes[0].id !== chargeId) throw new Error('Correspondência automática não é única ou está incompleta; confirme individualmente com evidência.');
  }
  const motivo = payload.motivo == null || payload.motivo === '' ? 'Confirmação individual do usuário pelo Cruzamento Compras.' : payload.motivo;
  if (!automatico && (typeof motivo !== 'string' || motivo.trim().length < 10 || motivo.length > 500)) throw new Error('Descreva a evidência conferida (10 a 500 caracteres).');
  const row = { id: charge.id, versao: charge.updated_date, valor: charge.valor, data: charge.data_lancamento, empresa: charge.empresa_beneficiada || '', tipo_compra: charge.tipo_compra, origem_compra: charge.origem_compra, fatura_id: charge.fatura_id };
  const resultado = await aplicarVinculoCartao(db, row, { tipo: 'ItemCompra', id: compra.id, versao: compra.updated_date }, userId, !automatico, automatico ? '' : motivo.trim());
  return { success: true, ...resultado };
}