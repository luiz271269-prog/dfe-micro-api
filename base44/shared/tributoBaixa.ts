import { lerCompleto, vazio, centavos } from './conciliacaoLeitura.ts';
import { devidoTributo, empresaExtrato, tipoTributo, competenciaExtrato, correspondeTributo } from './tributoRegras.ts';
async function reservar(db, entidade, id, token) {
  await db[entidade].updateMany({ $and:[{id},{$or:[vazio('conciliacao_token'),{conciliacao_iniciada_em:{$lt:new Date(Date.now()-600000).toISOString()}}]}] },{$set:{conciliacao_token:token,conciliacao_iniciada_em:new Date().toISOString()}});
  const reg=await db[entidade].get(id);
  if(reg.conciliacao_token!==token)throw new Error('Conciliação em andamento. Aguarde e atualize.');
  return reg;
}
export async function baixarTributo(db, body) {
  const remover=body.acao==='remover';
  const anterior=remover ? await db.VinculoExtrato.get(body.vinculo_id) : null;
  const lancId=remover ? anterior.lancamento_bancario_id : body.lancamento_bancario_id;
  const tribId=remover ? anterior.entidade_id : body.entidade_id;
  if(!lancId||!tribId)throw new Error('Informe o pagamento e a guia cadastrada.');
  const token=crypto.randomUUID(); const reservas=[];
  const registrar=(acao,detalhe,payload='')=>db.AuditoriaConciliacao.create({execucao_id:token,acao,entidade_tipo:'Tributo',entidade_id:tribId,motivo:'Baixa centralizada de guia; competência preservada',payload_original:payload,detalhe});
  try {
    const lanc=await reservar(db,'LancamentoBancario',lancId,token);reservas.push(['LancamentoBancario',lancId]);
    const trib=await reservar(db,'Tributo',tribId,token);reservas.push(['Tributo',tribId]);
    const [links,linksTrib]=await Promise.all([lerCompleto(db,'VinculoExtrato',{lancamento_bancario_id:lancId}),lerCompleto(db,'VinculoExtrato',{entidade_tipo:'Tributo',entidade_id:tribId})]);
    let vinculo=links.find(v=>v.entidade_tipo==='Tributo'&&v.entidade_id===tribId);
    let idempotente=false;
    if(!remover) {
      const valor=Number(body.valor_alocado);
      if(!Number.isFinite(valor)||valor<=0||centavos(valor)<=0)throw new Error('Valor alocado inválido.');
      if(lanc.valor>=0||['transferencia','interno'].includes(lanc.categoria)||lanc.status_conciliacao==='ignorar')throw new Error('Selecione um débito tributário válido.');
      if(!empresaExtrato(lanc)||empresaExtrato(lanc)!==trib.empresa)throw new Error('Empresa da conta bancária não identificada ou diferente da guia.');
      if(lanc.tipo_compra&&lanc.tipo_compra!=='impostos')throw new Error('Pagamento classificado em outro módulo.');
      const tipo=tipoTributo(`${lanc.descricao||''} ${lanc.detalhe||''}`);
      if(tipo&&tipo!==(trib.tipo==='GPS'?'INSS':trib.tipo))throw new Error('Tipo do pagamento diferente da guia.');
      const referencia=competenciaExtrato(lanc);
      if(referencia.explicita&&referencia.competencia!==trib.competencia)throw new Error('Competência explícita do pagamento diferente da guia.');
      if(vinculo) {if(centavos(vinculo.valor_alocado)!==centavos(valor))throw new Error('Vínculo existente com valor diferente.');idempotente=true;}
      else {
        if (body.conciliado_por === 'auto') {
          if (!correspondeTributo(lanc,trib) || centavos(valor)!==centavos(Math.abs(lanc.valor)) || lanc.alerta_duplicidade) throw new Error('Pagamento exige revisão manual da guia.');
          const candidatas=await lerCompleto(db,'Tributo',{empresa:trib.empresa,status:{$in:['a_vencer','vencido','parcelado']},tipo:{$in:trib.tipo==='GPS'||trib.tipo==='INSS'?['GPS','INSS']:[trib.tipo]}});
          if(candidatas.filter(t=>correspondeTributo(lanc,t)).length!==1)throw new Error('Mais de uma guia compatível. Confirme manualmente.');
        }
        if(links.some(v=>v.entidade_tipo!=='Tributo'))throw new Error('Débito já vinculado a outro módulo.');
        if(links.reduce((s,v)=>s+centavos(v.valor_alocado),0)+centavos(valor)>centavos(Math.abs(lanc.valor)))throw new Error('Valor excede o saldo do extrato.');
        const coberto=linksTrib.reduce((s,v)=>s+centavos(v.valor_alocado),0);
        if(coberto+centavos(valor)>centavos(devidoTributo(trib))+1)throw new Error('Valor excede a guia: confira juros e multa.');
        if(!linksTrib.length&&trib.valor_pago>0&&trib.status!=='pago')throw new Error('Guia com pagamento parcial manual: conferir histórico antes de vincular o extrato.');
        await registrar('vinculo_preparado',JSON.stringify({lancamento_bancario_id:lancId,valor_alocado:valor}),JSON.stringify({tributo:trib,extrato:lanc}));
        vinculo=await db.VinculoExtrato.create({lancamento_bancario_id:lancId,entidade_tipo:'Tributo',entidade_id:tribId,valor_alocado:valor,origem_compra:trib.origem_compra||'empresa',tipo_compra:'impostos',tipo_vinculo:'pagamento_integral',conciliado_por:body.conciliado_por==='auto'?'auto':'manual',confianca:body.confianca??100,observacao:String(body.observacao||'Guia mensal conciliada').slice(0,1000)});
      }
    } else {
      if(!vinculo||vinculo.id!==body.vinculo_id)throw new Error('Vínculo desatualizado.');
      await registrar('vinculo_removido',`Desvinculação ${vinculo.id}`,JSON.stringify({tributo:trib,extrato:lanc,vinculo}));
      await db.VinculoExtrato.delete(vinculo.id);
    }
    const [restantes,tributarios]=await Promise.all([lerCompleto(db,'VinculoExtrato',{lancamento_bancario_id:lancId}),lerCompleto(db,'VinculoExtrato',{entidade_tipo:'Tributo',entidade_id:tribId})]);
    const soma=tributarios.filter(v=>v.tipo_vinculo!=='adiantamento').reduce((s,v)=>s+centavos(v.valor_alocado),0)/100;
    const pago=soma>0&&centavos(devidoTributo(trib))-centavos(soma)<=1;
    const hoje=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
    const status=pago?'pago':trib.status==='parcelado'?'parcelado':trib.data_vencimento<hoje?'vencido':'a_vencer';
    const ids=[...new Set(tributarios.map(v=>v.lancamento_bancario_id))];
    const pagamentos=ids.length ? await lerCompleto(db,'LancamentoBancario',{id:{$in:ids}},['data']) : [];
    const data=pagamentos.map(p=>p.data).sort().at(-1)||null;
    await db.Tributo.update(tribId,{status,valor_pago:soma,data_pagamento:data,lancamento_bancario_id:ids.length===1?ids[0]:null});
    const valorConc=restantes.reduce((s,v)=>s+centavos(v.valor_alocado),0)/100;
    const cache={vinculos_count:restantes.length,valor_conciliado:valorConc,status_conciliacao:restantes.length ? centavos(Math.abs(lanc.valor))-centavos(valorConc)<=1?'conciliado':'parcial':'nao_conciliado'};
    await db.LancamentoBancario.update(lancId,cache);
    if(!remover)await db.SugestaoConciliacao.updateMany({lancamento_bancario_id:lancId,entidade_tipo:'Tributo',entidade_id:tribId,status:'pendente'},{$set:{status:'confirmada',resolvida_em:new Date().toISOString()}});
    await registrar('vinculo_confirmado',JSON.stringify({acao:body.acao,vinculo_id:vinculo?.id,status,valor_pago:soma,competencia:trib.competencia}));
    return {success:true,idempotente,vinculo:remover?null:vinculo,cache,obrigacao:{soma,devido:devidoTributo(trib),status}};
  } catch(error) {if(reservas.length===2)await registrar('vinculo_falha',String(error.message).slice(0,1000));throw error;}
  finally {for(const [entidade,id] of reservas)await db[entidade].updateMany({id,conciliacao_token:token},{$unset:{conciliacao_token:'',conciliacao_iniciada_em:''}});}
}