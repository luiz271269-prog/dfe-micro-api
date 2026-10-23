import { desfazerCompraCartao } from './conciliacaoCartaoDesfazer.ts';
import { reservarCompraCartao,liberarCompraCartao } from './conciliacaoCartaoReserva.ts';
import { gravarCondicionalBaixa } from './baixasDeclaradas.ts';
export async function cancelarCartaoCentral(db,trilha,userId,motivo) {
  if(trilha.entidade_tipo==='ItemCompra')return desfazerCompraCartao(db,trilha.entidade_id,userId,motivo);
  if(!['DespesaOperacional','ObraReforma'].includes(trilha.entidade_tipo)||trilha.fase!=='confirmado')throw new Error('Vínculo sem confirmação segura para cancelamento.');
  const {token}=await reservarCompraCartao(db,trilha.lancamento_cartao_id);
  try {
    const atual=await db.VinculoCartao.get(trilha.id);
    if(atual.updated_date!==trilha.updated_date)throw new Error('Vínculo alterado. Atualize.');
    const r=await db[trilha.entidade_tipo].get(trilha.entidade_id);
    const bancos=await db.VinculoExtrato.count({entidade_tipo:trilha.entidade_tipo,entidade_id:r.id});
    if(bancos||r.lancamento_bancario_id||r.pagamentos_manuais?.length)throw new Error('Há outro pagamento; revise os vínculos antes de cancelar.');
    const antes=JSON.parse(trilha.antes_json||'{}'),depois=JSON.parse(trilha.depois_json||'{}');
    const campos=depois.modelo_cartao==='composicao'?['lancamento_cartao_id','forma_pagamento']:trilha.entidade_tipo==='DespesaOperacional'?['lancamento_cartao_id','status']:['lancamento_cartao_id'];
    if(!campos.every(k=>(r[k]??null)===(depois[k]??null)))throw new Error('O documento mudou depois do vínculo. Cancelamento bloqueado.');
    const patch=Object.fromEntries(campos.map(k=>[k,antes[k]??null]));
    await db.VinculoCartao.update(trilha.id,{fase:'cancelamento_preparado',cancelado_por:userId,cancelamento_motivo:motivo,cancelamento_antes_json:JSON.stringify(depois),cancelamento_depois_json:JSON.stringify(patch)});
    await gravarCondicionalBaixa(db,trilha.entidade_tipo,r,patch);
    await db.VinculoCartao.update(trilha.id,{fase:'cancelado',cancelado_em:new Date().toISOString()});
    return {ok:true,historico_preservado:true};
  }finally{await liberarCompraCartao(db,trilha.lancamento_cartao_id,token);}
}