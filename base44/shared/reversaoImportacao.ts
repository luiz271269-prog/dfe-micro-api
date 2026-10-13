import { CAMPOS,bloqueio } from './revisaoImportacao.ts';
const DERIVADOS={NotaFiscal:['valor_aberto'],LancamentoBancario:['mes_referencia']};
export async function prepararReversao(db,batchId,auditId){
 if(typeof auditId!=='string'||!auditId||auditId.length>100)throw new Error('Selecione uma correção do histórico.');
 const audit=await db.AuditoriaImportacao.get(auditId);
 if(!audit||audit.batch_id!==batchId||audit.fase!=='confirmada'||audit.acao==='reversao')throw new Error('Correção confirmada não encontrada neste arquivo.');
 if(audit.revertida_em)throw new Error('Esta correção já foi revertida.');
 if(audit.reversao_token)throw new Error('Esta reversão já está em andamento ou requer conferência da auditoria.');
 const antes=JSON.parse(audit.antes_json),depois=JSON.parse(audit.depois_json),entity=audit.entidade_tipo;
 if(!CAMPOS[entity]||!antes||!depois||Array.isArray(antes)||Array.isArray(depois))throw new Error('Auditoria inválida para reversão.');
 const keys=Object.keys(depois),permitidos=[...CAMPOS[entity],...(DERIVADOS[entity] || [])];
 if(!keys.length||keys.some(k=>!permitidos.includes(k)||!Object.hasOwn(antes,k))||Object.keys(antes).length!==keys.length)throw new Error('Auditoria contém campos incompatíveis ou de pagamento.');
 const atual=await db[entity].get(audit.entidade_id);
 if(!atual)throw new Error('Registro original não encontrado.');
 if(keys.some(k=>JSON.stringify(atual[k] ?? null)!==JSON.stringify(depois[k])))throw new Error('Campos alterados depois desta correção. Reverta a correção mais recente desses campos primeiro.');
 const erro=await bloqueio(db,entity,atual,antes);if(erro)throw new Error(erro);
 if(entity==='NotaFiscal'&&await db.TituloCobranca.count({nota_fiscal_id:atual.id,$or:[{valor_pago:{$gt:0}},{status:'pago'},{lancamento_bancario_id:{$exists:true,$nin:['',null]}}]})>0)throw new Error('Nota com parcelas recebidas ou vinculadas ao banco: reversão bloqueada.');
 const set={},unset={};for(const k of keys){if(antes[k]===null)unset[k]='';else set[k]=antes[k];}
 return {audit,entity,atual,antes,depois,update:{...(Object.keys(set).length?{$set:set}:{}),...(Object.keys(unset).length?{$unset:unset}:{})},campos:keys.map(campo=>({campo,atual:depois[campo],original:antes[campo]}))};
}
export async function reverterCorrecao(db,batchId,body,user){
 const p=await prepararReversao(db,batchId,body.audit_id);
 if(body.acao==='preverReversao')return {success:true,versao:p.atual.updated_date,campos:p.campos,referencia:p.atual.numero || p.atual.descricao || p.atual.cliente || p.atual.funcionario_nome || p.audit.entidade_id};
 const motivo=String(body.motivo || '').trim();if(motivo.length<10||motivo.length>1000)throw new Error('Informe uma justificativa entre 10 e 1000 caracteres.');
 if(body.versao!==p.atual.updated_date)throw new Error('Registro mudou após a prévia. Confira a reversão novamente.');
 const token=crypto.randomUUID();
 const reserva=await db.AuditoriaImportacao.updateMany({id:p.audit.id,updated_date:p.audit.updated_date},{$set:{reversao_token:token}});
 if(!reserva.success||reserva.updated!==1)throw new Error('Correção mudou ou outra reversão foi iniciada. Atualize o histórico.');
 let trilha;
 try{trilha=await db.AuditoriaImportacao.create({batch_id:batchId,entidade_tipo:p.entity,entidade_id:p.atual.id,acao:'reversao',reversao_de:p.audit.id,antes_json:JSON.stringify(p.depois),depois_json:JSON.stringify(p.antes),arquivo_uri:p.audit.arquivo_uri || '',motivo,usuario_id:user.id,fase:'preparada'});}catch(e){await db.AuditoriaImportacao.update(p.audit.id,{reversao_token:''});throw e;}
 let etapa='antes_update';
 try{
  const fresco=await db[p.entity].get(p.atual.id),erro=await bloqueio(db,p.entity,fresco,p.antes);if(erro)throw new Error(erro);
  etapa='solicitando_update';
  const resultado=await db[p.entity].updateMany({id:p.atual.id,updated_date:p.atual.updated_date},p.update);
  if(!resultado.success||resultado.updated!==1){etapa='sem_alteracao';throw new Error('Registro mudou durante a reversão. Nenhum campo foi restaurado por esta operação.');}
  etapa='mutacao_confirmada';
  await db.AuditoriaImportacao.update(trilha.id,{fase:'confirmada'});
  await db.AuditoriaImportacao.update(p.audit.id,{revertida_em:new Date().toISOString(),revertida_por:user.id,reversao_auditoria_id:trilha.id,reversao_token:''});
  return {success:true,reversao_id:trilha.id};
 }catch(e){await db.AuditoriaImportacao.update(trilha.id,{fase:'falha',erro:String(e.message).slice(0,1000)});if(['antes_update','sem_alteracao'].includes(etapa))await db.AuditoriaImportacao.update(p.audit.id,{reversao_token:''});throw new Error(`${e.message} Confira a auditoria antes de repetir a operação.`);}
}