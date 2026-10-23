import { vazio } from './conciliacaoLeitura.ts';
export async function reservarRegistroBaixa(db,tipo,id,versao) {
  const anterior=await db[tipo].get(id);
  if(versao&&anterior.updated_date!==versao)throw new Error('Registro alterado desde a consulta. Atualize.');
  const token=crypto.randomUUID();
  await db[tipo].updateMany({$and:[{id,updated_date:anterior.updated_date},{$or:[vazio('conciliacao_token'),{conciliacao_iniciada_em:{$lt:new Date(Date.now()-600000).toISOString()}}]}]},{$set:{conciliacao_token:token,conciliacao_iniciada_em:new Date().toISOString()}});
  const registro=await db[tipo].get(id);
  if(registro.conciliacao_token!==token)throw new Error('Registro em processamento por outra operação. Aguarde e atualize.');
  return {registro,token,versaoAnterior:anterior.updated_date};
}
export async function liberarRegistroBaixa(db,tipo,id,token) {
  if(token)await db[tipo].updateMany({id,conciliacao_token:token},{$unset:{conciliacao_token:'',conciliacao_iniciada_em:''}});
}