import { vazio } from './conciliacaoLeitura.ts';
export async function reservarCompraCartao(db, id) {
  const token = crypto.randomUUID();
  const limite = new Date(Date.now() - 600000).toISOString();
  await db.LancamentoCartao.updateMany({ $and: [{ id }, { $or: [vazio('conciliacao_token'), { conciliacao_iniciada_em: { $lt: limite } }] }] }, { $set: { conciliacao_token: token, conciliacao_iniciada_em: new Date().toISOString() } });
  const charge = await db.LancamentoCartao.get(id);
  if (charge.conciliacao_token !== token) throw new Error('Compra em conciliação por outra execução. Atualize a análise.');
  return { charge, token };
}
export async function liberarCompraCartao(db, id, token) {
  await db.LancamentoCartao.updateMany({ id, conciliacao_token: token }, { $unset: { conciliacao_token: '', conciliacao_iniciada_em: '' } });
}