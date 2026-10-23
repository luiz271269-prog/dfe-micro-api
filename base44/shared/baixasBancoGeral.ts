import { reservarRegistroBaixa,liberarRegistroBaixa } from './baixasReserva.ts';
import { lerCompleto } from './conciliacaoLeitura.ts';
import { totalBaixa,patchPagamentoBaixa,estadoBaixa,dinheiroBaixa } from './baixasContrato.ts';
import { eixosDoVinculo,TIPO_POR_ENTIDADE } from './classificacaoPadrao.ts';
import { empresaExtrato } from './tributoRegras.ts';
export async function baixarBancoGeral(db,body) {
  const remover=body.acao==='remover',anterior=remover?await db.VinculoExtrato.get(body.vinculo_id):null;
  const tipo=anterior?.entidade_tipo||body.entidade_tipo,id=anterior?.entidade_id||body.entidade_id,bancoId=anterior?.lancamento_bancario_id||body.lancamento_bancario_id;
  if(!['ItemCompra','FolhaPagamento','FaturaCartao','ObraReforma'].includes(tipo))throw new Error('Módulo não suportado por esta rotina.');
  const banco=await reservarRegistroBaixa(db,'LancamentoBancario',bancoId);let reserva,auditoria;
  try {
    reserva=await reservarRegistroBaixa(db,tipo,id);const r=reserva.registro,l=banco.registro;
    const [vs,vd]=await Promise.all([lerCompleto(db,'VinculoExtrato',{lancamento_bancario_id:bancoId}),lerCompleto(db,'VinculoExtrato',{entidade_tipo:tipo,entidade_id:id})]);
    const soma=lista=>dinheiroBaixa(lista.filter(v=>v.tipo_vinculo!=='adiantamento').reduce((s,v)=>s+Number(v.valor_alocado||0),0));
    const valor=dinheiroBaixa(body.valor_alocado),atual=vs.find(v=>v.entidade_tipo===tipo&&v.entidade_id===id);
    if(!remover&&atual){if(Math.abs(atual.valor_alocado-valor)>0.001)throw new Error('Vínculo já existe com outro valor.');return {success:true,idempotente:true,vinculo:atual};}
    if(!remover){
      if(!(valor>0)||!(l.valor<0)||l.alerta_duplicidade||l.duplicidade_ref||l.status_conciliacao==='ignorar'||['transferencia','interno','aplicacoes','resgates'].includes(l.categoria))throw new Error('Débito inválido ou bloqueado para baixa.');
      if(r.lancamento_cartao_id||r.pagamentos_manuais?.length||Number(r.valor_pago||0)>soma(vd)+0.01)throw new Error('Outro pagamento ou cartão já associado. Reabra a declaração antes de conciliar.');
      if((['pago','paga_total'].includes(r.status)||r.status_pagamento==='pago')&&!vd.length)throw new Error('Documento já quitado, sem vínculo disponível para esta conciliação.');
      if(tipo==='FolhaPagamento'&&(!r.funcionario_id||!r.funcionario_nome))throw new Error('Folha sem identidade completa. Revise na origem.');
      const empresa=tipo==='FaturaCartao'?(await db.ContaCartao.get(r.conta_cartao_id)).empresa_vinculada:r.empresa;
      if(empresaExtrato(l)&&empresa&&empresaExtrato(l)!==empresa)throw new Error('Empresa incompatível com o débito.');
      const natureza=TIPO_POR_ENTIDADE[tipo];if(natureza&&l.tipo_compra&&l.tipo_compra!==natureza)throw new Error('Natureza econômica incompatível com a obrigação.');
      if(vs.some(v=>TIPO_POR_ENTIDADE[v.entidade_tipo]&&natureza&&TIPO_POR_ENTIDADE[v.entidade_tipo]!==natureza))throw new Error('Débito já pertence a outro módulo.');
      if(soma(vs)+valor>Math.abs(l.valor)+0.001||soma(vd)+valor>totalBaixa(tipo,r)+0.001)throw new Error('Alocação superior ao saldo do débito ou da obrigação.');
    }
    auditoria=await db.AuditoriaConciliacao.create({execucao_id:banco.token,acao:'vinculo_preparado',entidade_tipo:tipo,entidade_id:id,motivo:body.observacao||'Conciliação central',payload_original:JSON.stringify({usuario_id:body.usuario_id||'auto',antes:estadoBaixa(r),banco:l.id,vinculo:anterior}),detalhe:remover?'Preparando reabertura':'Preparando baixa'});
    const novo=remover?null:await db.VinculoExtrato.create({lancamento_bancario_id:bancoId,entidade_tipo:tipo,entidade_id:id,valor_alocado:valor,...eixosDoVinculo(r,tipo,l),tipo_vinculo:body.tipo_vinculo||'pagamento_integral',conciliado_por:body.conciliado_por||'manual',observacao:body.observacao||'',confianca:body.confianca??100});
    if(remover)await db.VinculoExtrato.delete(anterior.id);
    const [atuaisBanco,atuaisDoc]=await Promise.all([lerCompleto(db,'VinculoExtrato',{lancamento_bancario_id:bancoId}),lerCompleto(db,'VinculoExtrato',{entidade_tipo:tipo,entidade_id:id})]);
    const ids=[...new Set(atuaisDoc.map(v=>v.lancamento_bancario_id))],pagamentos=ids.length?await lerCompleto(db,'LancamentoBancario',{id:{$in:ids}},['data']):[];
    const pago=soma(atuaisDoc),alocado=soma(atuaisBanco),patch=patchPagamentoBaixa(tipo,r,pago,pagamentos.map(x=>x.data).sort().at(-1),r.forma_pagamento||'transferencia');
    if(!r.forma_pagamento){delete patch.forma_pagamento;if(tipo==='ItemCompra')patch.forma_pagamento='nao_definida';}
    patch.lancamento_bancario_id=ids.length===1&&(tipo!=='ObraReforma'||pago>=totalBaixa(tipo,r))?ids[0]:null;
    await db[tipo].update(id,patch);
    await db.LancamentoBancario.update(bancoId,{valor_conciliado:alocado,vinculos_count:atuaisBanco.length,status_conciliacao:atuaisBanco.length?(alocado>=Math.abs(l.valor)-0.01?'conciliado':'parcial'):'nao_conciliado'});
    await db.AuditoriaConciliacao.update(auditoria.id,{acao:remover?'vinculo_removido':'vinculo_confirmado',detalhe:JSON.stringify({depois:patch})});
    return {success:true,vinculo:novo,obrigacao:{soma:pago,devido:totalBaixa(tipo,r)}};
  }catch(error){if(auditoria)await db.AuditoriaConciliacao.update(auditoria.id,{acao:'vinculo_falha',detalhe:error.message});throw error;}
  finally{await liberarRegistroBaixa(db,tipo,id,reserva?.token);await liberarRegistroBaixa(db,'LancamentoBancario',bancoId,banco.token);}
}