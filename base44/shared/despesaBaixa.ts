import { reservarDespesa, liberarDespesa } from './despesaReserva.ts';
import { lerCompleto } from './conciliacaoLeitura.ts';
import { empresaExtrato } from './tributoRegras.ts';
export async function baixarDespesa(db,body) {
  const remover=body.acao==='remover';
  const vinculo=remover?await db.VinculoExtrato.get(body.vinculo_id):null;
  const bancoId=vinculo?.lancamento_bancario_id||body.lancamento_bancario_id, despesaId=vinculo?.entidade_id||body.entidade_id;
  if(remover&&vinculo.entidade_tipo!=='DespesaOperacional')throw new Error('Vínculo de outro módulo.');
  const banco=await reservarDespesa(db,'LancamentoBancario',bancoId);
  let reserva,auditoria;
  try {
    reserva=await reservarDespesa(db,'DespesaOperacional',despesaId);
    const r=reserva.registro,l=banco.registro;
    const [vBanco,vDespesa]=await Promise.all([lerCompleto(db,'VinculoExtrato',{lancamento_bancario_id:bancoId}),lerCompleto(db,'VinculoExtrato',{entidade_tipo:'DespesaOperacional',entidade_id:despesaId})]);
    const existente=vBanco.find(v=>v.entidade_tipo==='DespesaOperacional'&&v.entidade_id===despesaId);
    const valor=Number(body.valor_alocado);
    if(!remover&&existente){if(Math.abs(existente.valor_alocado-valor)>0.01)throw new Error('Já existe vínculo com outro valor.');return {success:true,idempotente:true,vinculo:existente};}
    const soma=rows=>Math.round(rows.reduce((s,v)=>s+Number(v.valor_alocado||0),0)*100)/100;
    if(!remover){
      if(!(valor>0)||!Number.isFinite(valor)||!(l.valor<0)||['ignorar'].includes(l.status_conciliacao)||l.alerta_duplicidade||l.duplicidade_ref)throw new Error('Pagamento inválido, ignorado ou com possível duplicidade.');
      if(r.lancamento_cartao_id||r.forma_pagamento==='cartao')throw new Error('Despesa reconhecida no cartão: concilie o pagamento da fatura, não a despesa novamente.');
      if(l.tipo_compra&&l.tipo_compra!=='despesas')throw new Error('Extrato classificado em outra natureza econômica.');
      const empresa=empresaExtrato(l);
      if(empresa&&r.empresa&&empresa!==r.empresa)throw new Error('Empresa do débito diferente da despesa.');
      if(body.conciliado_por==='auto'&&(!empresa||!r.empresa||!r.tipo_compra||!r.origem_compra))throw new Error('Classificação ou empresa incompleta: exige revisão manual.');
      if(vBanco.some(v=>v.entidade_tipo!=='DespesaOperacional'))throw new Error('Débito já vinculado a outro módulo.');
      if(soma(vBanco)+valor>Math.abs(l.valor)+0.01||soma(vDespesa)+valor>Number(r.valor)+0.01)throw new Error('Pagamento supera o saldo do débito ou da despesa.');
    }
    auditoria=await db.AuditoriaConciliacao.create({execucao_id:banco.token,acao:'vinculo_preparado',entidade_tipo:'DespesaOperacional',entidade_id:r.id,motivo:remover?'Reabertura da despesa sem alterar a competência':'Baixa operacional pelo extrato',payload_original:JSON.stringify({despesa:r,banco:l,vinculo}),detalhe:body.observacao||'Conciliação central de despesas operacionais'});
    const novo=remover?null:await db.VinculoExtrato.create({lancamento_bancario_id:bancoId,entidade_tipo:'DespesaOperacional',entidade_id:despesaId,valor_alocado:valor,tipo_vinculo:body.tipo_vinculo||'pagamento_integral',conciliado_por:body.conciliado_por||'manual',confianca:body.confianca??100,origem_compra:r.origem_compra||'empresa',tipo_compra:'despesas',observacao:body.observacao||''});
    if(remover)await db.VinculoExtrato.delete(vinculo.id);
    const atuaisBanco=await lerCompleto(db,'VinculoExtrato',{lancamento_bancario_id:bancoId});
    const atuaisDespesa=await lerCompleto(db,'VinculoExtrato',{entidade_tipo:'DespesaOperacional',entidade_id:despesaId});
    const pago=soma(atuaisDespesa),alocado=soma(atuaisBanco),ids=[...new Set(atuaisDespesa.map(v=>v.lancamento_bancario_id))];
    const pagamentos=ids.length?await lerCompleto(db,'LancamentoBancario',{id:{$in:ids}},['data']):[];
    const status=pago+0.01>=Number(r.valor)?'pago':'pendente';
    await db.DespesaOperacional.update(r.id,{status,valor_pago:pago,data_pagamento:pagamentos.map(p=>p.data).sort().pop()||null,lancamento_bancario_id:ids.length===1?ids[0]:null});
    await db.LancamentoBancario.update(l.id,{vinculos_count:atuaisBanco.length,valor_conciliado:alocado,status_conciliacao:atuaisBanco.length?(alocado+0.01>=Math.abs(l.valor)?'conciliado':'parcial'):'nao_conciliado'});
    await db.AuditoriaConciliacao.update(auditoria.id,{acao:remover?'vinculo_removido':'vinculo_confirmado',detalhe:JSON.stringify({competencia_preservada:r.data,valor_pago:pago,status})});
    return {success:true,vinculo:novo,obrigacao:{soma:pago,devido:r.valor,status}};
  } catch(error){if(auditoria)await db.AuditoriaConciliacao.update(auditoria.id,{acao:'vinculo_falha',detalhe:String(error.message).slice(0,1000)});throw error;}
  finally{await liberarDespesa(db,'DespesaOperacional',despesaId,reserva?.token);await liberarDespesa(db,'LancamentoBancario',bancoId,banco.token);}
}