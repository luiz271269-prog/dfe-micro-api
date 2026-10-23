import { contratoImportacao } from './importacaoContrato.ts';
import { criarCandidato } from './importacaoMatching.ts';
import { executarBaixaCentral } from './baixasOperacoes.ts';
import { auditarBaixa,concluirBaixa } from './baixasDeclaradas.ts';

export async function confirmarPropostaImportacao(base44,user,b){
  if(b.confirmado!==true||typeof b.proposta_id!=='string'||typeof b.candidato!=='string')throw new Error('Autorização individual explícita obrigatória.');
  const db=base44.entities,p=await db.RegistroImportacao.get(b.proposta_id),m=contratoImportacao(p.tipo_importacao);
  if(!m.pode_propor_liquidacao)throw new Error('Este tipo de importação não permite liquidação.');
  if(p.estado==='concluido')return {success:true,idempotente:true,resultado:p.resultado_execucao,auditoria_id:p.auditoria_id};
  if(!['proposta','ambiguo','revisao'].includes(p.estado)||p.updated_date!==b.versao)throw new Error('Proposta indisponível ou alterada. Refaça a busca.');
  const c=(p.candidatos||[]).find(c=>c.chave===b.candidato);if(!c)throw new Error('Candidato não pertence à proposta.');
  const pedidoId=crypto.randomUUID(),claim=await db.RegistroImportacao.updateMany({id:p.id,updated_date:p.updated_date,estado:p.estado},{$set:{estado:'executando',pedido_id:pedidoId,confirmado_por:user.id,confirmado_em:new Date().toISOString(),candidato_confirmado:c}});
  if(claim.updated!==1)throw new Error('Confirmação já recebida ou proposta alterada.');
  let audit;
  try{
    const [doc,mov]=await Promise.all([db[c.entidade_tipo].get(c.entidade_id),db[c.movimento_tipo].get(c.movimento_id)]);
    if(doc.updated_date!==c.entidade_versao||mov.updated_date!==c.movimento_versao)throw new Error('Documento ou movimento mudou desde a proposta. Refaça a busca antes de confirmar.');
    if(p.tipo_importacao==='boletos_liquidados'){
      const ev=await db.EvidenciaFinanceira.get(p.entidade_id);
      if(ev.estado!=='pendente'||ev.updated_date!==c.evidencia_versao)throw new Error('A evidência de recebimento mudou ou já foi resolvida. Refaça a conferência.');
    }
    const atual=await criarCandidato(db,c.entidade_tipo,doc,c.movimento_tipo,mov,{...p,valor_pago_informado:c.valor});
    if(!atual||atual.valor!==c.valor||Math.abs(atual.saldo_documento-c.saldo_documento)>0.001||Math.abs(atual.saldo_movimento-c.saldo_movimento)>0.001)throw new Error('Empresa, vínculo, saldo ou disponibilidade mudou. Nenhuma baixa executada.');
    const motivo=`Importação ${p.import_batch_id}; proposta ${p.id}; ${c.criterio}`.slice(0,500);
    audit=await auditarBaixa(base44,user,c.entidade_tipo,doc.id,'proposta_importacao',pedidoId,motivo,{documento:doc,movimento:mov},{import_batch_id:p.import_batch_id,origem_registro_id:p.id,proposta_id:p.id,executor:c.efeito==='composicao'?'centralBaixas/cartao':c.entidade_tipo==='TituloCobranca'||c.entidade_tipo==='NotaFiscal'?'vincularExtrato':'centralBaixas/banco',criterio:c.criterio,valor:c.valor});
    await db.RegistroImportacao.update(p.id,{auditoria_id:audit.id});
    let resultado;
    if(['TituloCobranca','NotaFiscal'].includes(c.entidade_tipo)){
      const res=await base44.functions.invoke('vincularExtrato',{acao:'criar',entidade_tipo:c.entidade_tipo,entidade_id:doc.id,lancamento_bancario_id:mov.id,valor_alocado:c.valor,tipo_vinculo:'recebimento_parcial',conciliado_por:'manual',observacao:motivo,proposta_importacao_id:p.id,versao_documento:doc.updated_date,versao_banco:mov.updated_date});
      resultado=res.data;if(!resultado?.success)throw new Error(resultado?.error||'Recebimento não confirmado.');
    }else resultado=await executarBaixaCentral(base44,user,{acao:c.efeito==='composicao'?'cartao':'banco',tipo:c.movimento_tipo,id:mov.id,versao:mov.updated_date,destino:c.entidade_tipo,destino_id:doc.id,destino_versao:doc.updated_date,valor:c.valor,pedidoId:pedidoId+'-executor',motivo,proposta_importacao_id:p.id});
    if(resultado?.error||resultado?.success===false||resultado?.ok===false)throw new Error(resultado.error||'Executor não confirmou a operação.');
    if(p.tipo_importacao==='boletos_liquidados'){
      const vinculoId=resultado.vinculo?.id||resultado.vinculo_id||'';
      const ev=await db.EvidenciaFinanceira.updateMany({id:p.entidade_id,updated_date:c.evidencia_versao,estado:'pendente'},{$set:{estado:'confirmada',entidade_tipo:c.entidade_tipo,entidade_id:doc.id,lancamento_bancario_id:mov.id,vinculo_id:vinculoId,confirmada_por:user.id,confirmada_em:new Date().toISOString(),motivo}});
      if(ev.updated!==1)throw new Error('Recebimento executado; a evidência mudou. Confira a auditoria antes de qualquer nova ação.');
    }
    const depois=await db[c.entidade_tipo].get(doc.id);await concluirBaixa(base44,audit,{registro:depois,resultado});
    const retorno={efeito:c.efeito,valor:c.valor,vinculo_id:resultado.vinculo?.id||resultado.vinculo_id||'',mensagem:c.efeito==='composicao'?'Composição vinculada. Nenhum pagamento bancário registrado.':'Conciliação financeira executada após autorização.'};
    await db.RegistroImportacao.update(p.id,{estado:'concluido',resultado_execucao:retorno});return {success:true,resultado:retorno,auditoria_id:audit.id};
  }catch(error){if(audit)await concluirBaixa(base44,audit,null,error);await db.RegistroImportacao.update(p.id,{estado:audit?'falhou':'revisao',...(audit?{}:{candidatos:[]}),erro:String(error.message).slice(0,1000)});throw error;}
}