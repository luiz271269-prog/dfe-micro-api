import { MODULOS_BAIXA, ehMovimento, dinheiroBaixa, totalBaixa, estadoBaixa, patchPagamentoBaixa } from './baixasContrato.ts';
import { reservarRegistroBaixa,liberarRegistroBaixa } from './baixasReserva.ts';
export async function auditarBaixa(base44,user,tipo,id,operacao,requestId,motivo,antes,parametros={}) {
  const api=base44.asServiceRole.entities.AuditoriaConciliacao;
  const prev=await api.filter({execucao_id:requestId},{limit:2});
  if(prev.items.length)throw new Error('Esta operação já foi recebida. Atualize e confira o histórico antes de repetir.');
  return api.create({execucao_id:requestId,acao:'vinculo_preparado',entidade_tipo:tipo,entidade_id:id,motivo,detalhe:'Operação aguardando confirmação',payload_original:JSON.stringify({origem:'central_baixas',operacao,usuario_id:user.id,antes,parametros})});
}
export async function concluirBaixa(base44,auditoria,depois,error) {
  await base44.asServiceRole.entities.AuditoriaConciliacao.update(auditoria.id,{acao:error?'vinculo_falha':'vinculo_confirmado',detalhe:JSON.stringify(error?{erro:String(error.message)}:{depois})});
}
export async function gravarCondicionalBaixa(db,tipo,r,patch) {
  const result=await db[tipo].updateMany({id:r.id,updated_date:r.updated_date},{$set:patch});
  if(result.updated!==1)throw new Error('O registro mudou durante a operação. Atualize antes de continuar.');
  return db[tipo].get(r.id);
}
export async function registrarDeclarado(base44,user,b) {
  if(!MODULOS_BAIXA[b.entidade]||ehMovimento(b.entidade)||typeof b.id!=='string'||!b.id)throw new Error('Obrigação inválida.');
  if(user.role!=='admin'&&b.entidade!=='FaturaCartao')throw new Error('Pagamento deste módulo restrito a administrador.');
  const reserva=await reservarRegistroBaixa(base44.entities,b.entidade,b.id,b.versao);
  try{return await aplicarDeclarado(base44,user,b,reserva.registro);}finally{await liberarRegistroBaixa(base44.entities,b.entidade,b.id,reserva.token);}
}
async function aplicarDeclarado(base44,user,b,reservado) {
  const tipo=b.entidade,id=b.id;
  if(!MODULOS_BAIXA[tipo]||ehMovimento(tipo))throw new Error('Obrigação inválida.');
  if(user.role!=='admin'&&tipo!=='FaturaCartao')throw new Error('Pagamento deste módulo restrito a administrador.');
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
  if(typeof b.pedidoId!=='string'||!b.pedidoId||b.pedidoId.length>80)throw new Error('Identificação da operação inválida.');
  if(typeof b.data!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.data)||!Number.isFinite(Date.parse(b.data))||new Date(b.data).toISOString().slice(0,10)!==b.data||b.data>hoje)throw new Error('Informe a data efetiva do pagamento, não futura.');
  const formas=tipo==='ItemCompra'?['pix','boleto','transferencia','dinheiro']:tipo==='FolhaPagamento'?['pix','transferencia','dinheiro','cheque','cartao','deposito']:['pix','transferencia','dinheiro','cheque','cartao','deposito','boleto','debito_automatico'];
  if(!formas.includes(b.forma)||typeof b.valor!=='number'||!Number.isFinite(b.valor)||dinheiroBaixa(b.valor)<=0)throw new Error('Forma ou valor de pagamento inválido.');
  const db=base44.entities,r=reservado;
  if((r.pagamentos_manuais||[]).some(p=>p.id===b.pedidoId))return {ok:true,repetido:true};
  const bancos=await db.VinculoExtrato.count({entidade_tipo:tipo,entidade_id:id});
  const cartoes=await db.VinculoCartao.count({entidade_tipo:tipo,entidade_id:id,fase:{$ne:'cancelado'}});
  if(bancos||cartoes||r.lancamento_cartao_id||r.lancamento_bancario_id)throw new Error('Há conciliação ou cartão associado. Revise/desvincule antes de declarar outro pagamento.');
  const total=totalBaixa(tipo,r),pago=dinheiroBaixa(r.valor_pago),valor=dinheiroBaixa(b.valor);
  if(valor>dinheiroBaixa(total-pago)||['pago','paga_total'].includes(r.status)||r.status_pagamento==='pago')throw new Error('Valor supera o saldo ou obrigação já quitada.');
  const patch=patchPagamentoBaixa(tipo,r,pago+valor,[r.data_pagamento||'',b.data].sort().at(-1),b.forma);
  if(['FolhaPagamento','FaturaCartao'].includes(tipo))patch.pagamentos_manuais=[...(r.pagamentos_manuais||[]),{id:b.pedidoId,data:b.data,valor,forma:b.forma,registrado_em:new Date().toISOString(),usuario_id:user.id}];
  const audit=await auditarBaixa(base44,user,tipo,id,'manual',b.pedidoId,b.motivo||'Pagamento declarado sem extrato',estadoBaixa(r),{data:b.data,forma:b.forma,canal:String(b.canal||'').slice(0,160),valor});
  try {const depois=await gravarCondicionalBaixa(db,tipo,r,patch);
    if(tipo==='FaturaCartao'&&r.status!=='paga_total'&&depois.status==='paga_total'){
      const efeito=await base44.asServiceRole.functions.invoke('liquidarItensFaturaPaga',{fatura_id:id});
      if(efeito.data?.error||!efeito.data?.success)throw new Error('Pagamento já registrado; a atualização dos itens da fatura exige revisão: '+(efeito.data?.error||'serviço não confirmou a conclusão.'));
    }
    await concluirBaixa(base44,audit,estadoBaixa(depois));return {ok:true,valor_pago:pago+valor,saldo:dinheiroBaixa(total-pago-valor),quitado:pago+valor>=total};}
  catch(error){await concluirBaixa(base44,audit,null,error);throw error;}
}
export async function reabrirDeclarado(base44,user,b) {
  const reserva=await reservarRegistroBaixa(base44.entities,b.tipo,b.id,b.versao);
  try{return await restaurarDeclarado(base44,user,b,reserva.registro);}finally{await liberarRegistroBaixa(base44.entities,b.tipo,b.id,reserva.token);}
}
async function restaurarDeclarado(base44,user,b,reservado) {
  if(user.role!=='admin')throw new Error('Reabertura restrita a administrador.');
  const audit=await base44.entities.AuditoriaConciliacao.get(b.auditoria_id);
  const meta=JSON.parse(audit.payload_original||'{}'),depois=JSON.parse(audit.detalhe||'{}').depois;
  if(meta.origem!=='central_baixas'||!['manual','editar'].includes(meta.operacao)||audit.acao!=='vinculo_confirmado'||!depois)throw new Error('A operação não tem uma reversão segura disponível.');
  const tipo=audit.entidade_tipo,r=reservado;
  const jaRevertida=await base44.entities.AuditoriaConciliacao.count({entidade_tipo:tipo,entidade_id:r.id,acao:'vinculo_confirmado',payload_original:{$regex:`\"reversao_de\":\"${audit.id}\"`}});
  if(jaRevertida)throw new Error('Esta operação já foi revertida; o histórico original foi preservado.');
  const [vb,vc]=await Promise.all([base44.entities.VinculoExtrato.count({entidade_tipo:tipo,entidade_id:r.id}),base44.entities.VinculoCartao.count({entidade_tipo:tipo,entidade_id:r.id,fase:{$ne:'cancelado'}})]);
  if(vb||vc)throw new Error('Desvincule as conciliações antes de restaurar o estado anterior.');
  if(!Object.entries(depois).every(([k,v])=>JSON.stringify(r[k]??null)===JSON.stringify(v??null)))throw new Error('Há alterações posteriores. Reverta primeiro a operação mais recente.');
  const patch=Object.fromEntries(Object.keys(depois).map(k=>[k,meta.antes[k]??null]));
  const nova=await auditarBaixa(base44,user,tipo,r.id,'reabrir',b.pedidoId,b.motivo,estadoBaixa(r),{reversao_de:audit.id});
  try{const resultado=await gravarCondicionalBaixa(base44.entities,tipo,r,patch);await concluirBaixa(base44,nova,estadoBaixa(resultado));return {ok:true};}catch(error){await concluirBaixa(base44,nova,null,error);throw error;}
}