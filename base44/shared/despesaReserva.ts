import { vazio } from './conciliacaoLeitura.ts';
export async function reservarDespesa(db, entidade, id) {
  if (!['RegraRecorrente','DespesaOperacional','LancamentoBancario'].includes(entidade)) throw new Error('Reserva inválida.');
  const token=crypto.randomUUID();
  await db[entidade].updateMany({$and:[{id},{$or:[vazio('conciliacao_token'),{conciliacao_iniciada_em:{$lt:new Date(Date.now()-600000).toISOString()}}]}]},{$set:{conciliacao_token:token,conciliacao_iniciada_em:new Date().toISOString()}});
  const registro=await db[entidade].get(id);
  if(registro.conciliacao_token!==token)throw new Error('Registro em conciliação por outra execução. Atualize.');
  return {registro,token};
}
export async function liberarDespesa(db,entidade,id,token) {
  if(token)await db[entidade].updateMany({id,conciliacao_token:token},{$unset:{conciliacao_token:'',conciliacao_iniciada_em:''}});
}