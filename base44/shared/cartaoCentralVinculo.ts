import { consultarPedidosCentral } from './centralComprasConsulta.ts';
import { pedidosCentralCartao, avaliarPedidoCartao } from './cartaoCentralRegras.ts';
import { compraReal, TIPOS_VINCULO_CARTAO } from './conciliacaoCartaoRegras.ts';
import { auditarBaixa, concluirBaixa, gravarCondicionalBaixa } from './baixasDeclaradas.ts';
import { reservarRegistroBaixa, liberarRegistroBaixa } from './baixasReserva.ts';

// A Central continua a fonte do pedido: aqui só se grava a referência auditada na transação do cartão.
const CAMPOS = ['pedido_central_id', 'pedido_central_internal_id', 'pedido_central_parcela', 'pedido_central_parcelas', 'pedido_central_fornecedor', 'pedido_central_valor', 'pedido_central_condicao'];
const estado = r => Object.fromEntries(CAMPOS.map(k => [k, r[k] ?? null]));
const limpo = () => Object.fromEntries(CAMPOS.map(k => [k, null]));

export async function ocupacaoCartao(db, lancamento) {
  const [refs, trilhas] = await Promise.all([
    Promise.all(TIPOS_VINCULO_CARTAO.map(t => db[t].filter({ lancamento_cartao_id: lancamento.id }, { limit: 5, fields: ['id'] }).then(p => p.items.length))),
    db.VinculoCartao.filter({ lancamento_cartao_id: lancamento.id, fase: { $ne: 'cancelado' } }, { limit: 5, fields: ['id'] }),
  ]);
  return { local: !!(lancamento.item_compra_id || refs.some(Boolean) || trilhas.items.length), central: !!lancamento.pedido_central_internal_id };
}

export async function vinculosPedidosCentral(db, ids, excluirId) {
  if (!ids.length) return {};
  const pagina = await db.LancamentoCartao.filter({ pedido_central_internal_id: { $in: ids } }, { limit: 500, fields: ['id', 'valor', 'fatura_id', 'pedido_central_internal_id', 'pedido_central_parcela', 'pedido_central_parcelas'] });
  const lancs = pagina.items.filter(l => l.id !== excluirId), fatIds = [...new Set(lancs.map(l => l.fatura_id).filter(Boolean))];
  const faturas = fatIds.length ? (await db.FaturaCartao.filter({ id: { $in: fatIds } }, { limit: 500, fields: ['id', 'mes_referencia'] })).items : [];
  const mes = Object.fromEntries(faturas.map(f => [f.id, f.mes_referencia])), out = {};
  lancs.forEach(l => (out[l.pedido_central_internal_id] ||= []).push({ id: l.id, valor: Number(l.valor || 0), parcela: Number(l.pedido_central_parcela || 0), parcelas: Number(l.pedido_central_parcelas || 1), mes: mes[l.fatura_id] || '' }));
  return out;
}

export async function vincularCartaoCentral(base44, user, b) {
  const db = base44.entities, parcelas = Number(b.parcelas), parcela = Number(b.parcela);
  if (b.tipo !== 'LancamentoCartao' || typeof b.pedido_central_internal_id !== 'string' || !b.pedido_central_internal_id || b.pedido_central_internal_id.length > 200) throw new Error('Selecione um pedido válido da Central de Compras.');
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48 || !Number.isInteger(parcela) || parcela < 1 || parcela > parcelas) throw new Error('Parcela inválida.');
  const central = await consultarPedidosCentral();
  if (!central.ok) throw new Error(central.motivo);
  const pedido = pedidosCentralCartao(central.data.filter(p => p.id === b.pedido_central_internal_id)).pedidos[0];
  if (!pedido) throw new Error('Pedido não encontrado, cancelado ou sem valor na Central de Compras.');
  const reserva = await reservarRegistroBaixa(db, 'LancamentoCartao', b.id, b.versao);
  let audit;
  try {
    const lancamento = reserva.registro;
    if (!compraReal(lancamento)) throw new Error('Somente compras da fatura podem ser vinculadas.');
    const ocupacao = await ocupacaoCartao(db, lancamento);
    if (ocupacao.local || ocupacao.central) throw new Error('A transação já possui vínculo. Desfaça o vínculo atual antes de escolher outro documento.');
    const [usados, fatura] = await Promise.all([vinculosPedidosCentral(db, [pedido.id], lancamento.id), db.FaturaCartao.get(lancamento.fatura_id)]);
    const av = avaliarPedidoCartao(lancamento, pedido, usados[pedido.id] || [], parcelas, fatura?.mes_referencia);
    if (!av.opcao) throw new Error('O valor da transação não confere com o total, as parcelas ou a condição de pagamento escolhida.');
    if (av.bloqueios.length) throw new Error(av.bloqueios.join(' '));
    if (av.parcelas_ocupadas.includes(parcela)) throw new Error(`A parcela ${parcela}/${parcelas} já está vinculada a outra transação.`);
    const patch = { pedido_central_id: pedido.numero, pedido_central_internal_id: pedido.id, pedido_central_parcela: parcela, pedido_central_parcelas: parcelas, pedido_central_fornecedor: pedido.fornecedor, pedido_central_valor: pedido.total, pedido_central_condicao: pedido.condicao || '' };
    audit = await auditarBaixa(base44, user, 'LancamentoCartao', lancamento.id, 'cartao_central', b.pedidoId, b.motivo.trim(), estado(lancamento), { pedido: pedido.numero, parcela, parcelas, valor_parcela: av.opcao.esperado, forma_central: pedido.forma, condicao: pedido.condicao, razoes: av.razoes, alertas: av.alertas });
    let depois = await gravarCondicionalBaixa(db, 'LancamentoCartao', lancamento, patch);
    if (await db.LancamentoCartao.count({ pedido_central_internal_id: pedido.id, pedido_central_parcela: parcela, pedido_central_parcelas: parcelas }) > 1) {
      depois = await gravarCondicionalBaixa(db, 'LancamentoCartao', depois, limpo());
      throw new Error('Outra transação ocupou esta parcela ao mesmo tempo. Nenhum vínculo foi mantido; atualize.');
    }
    await concluirBaixa(base44, audit, estado(depois));
    return { ok: true, pedido: pedido.numero, parcela, parcelas };
  } catch (error) { if (audit) await concluirBaixa(base44, audit, null, error); throw error; }
  finally { await liberarRegistroBaixa(db, 'LancamentoCartao', b.id, reserva.token); }
}

export async function desvincularCartaoCentral(base44, user, b) {
  const db = base44.entities;
  if (b.tipo !== 'LancamentoCartao') throw new Error('Operação disponível somente para transações do cartão.');
  const reserva = await reservarRegistroBaixa(db, 'LancamentoCartao', b.id, b.versao);
  let audit;
  try {
    const lancamento = reserva.registro;
    if (!lancamento.pedido_central_internal_id) throw new Error('A transação não possui vínculo com pedido da Central.');
    audit = await auditarBaixa(base44, user, 'LancamentoCartao', lancamento.id, 'desfazer_cartao_central', b.pedidoId, b.motivo.trim(), estado(lancamento));
    const depois = await gravarCondicionalBaixa(db, 'LancamentoCartao', lancamento, limpo());
    await concluirBaixa(base44, audit, estado(depois));
    return { ok: true };
  } catch (error) { if (audit) await concluirBaixa(base44, audit, null, error); throw error; }
  finally { await liberarRegistroBaixa(db, 'LancamentoCartao', b.id, reserva.token); }
}