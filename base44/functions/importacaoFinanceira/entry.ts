import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { MATRIZ_IMPORTACAO,contratoImportacao,sanitizarImportacao,informacaoPagamento } from '../../shared/importacaoContrato.ts';
import { persistirRegistro,persistirVendas } from '../../shared/importacaoPersistencia.ts';
import { buscarRegistroImportacao,resumoImportacao } from '../../shared/importacaoConferencia.ts';
import { confirmarPropostaImportacao } from '../../shared/importacaoConfirmacao.ts';
import { validarProtecaoImportacao } from '../../shared/importacaoProtecao.ts';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    if(!user)return Response.json({error:'Não autorizado.'},{status:401});
    const b=await req.json(),db=base44.entities;
    if(b.acao==='contrato')return Response.json({matriz:MATRIZ_IMPORTACAO});
    if(user.role!=='admin')return Response.json({error:'Importações e confirmações restritas a administrador.'},{status:403});
    if(b.validate_only){if(b.verificar_protecao)return Response.json(await validarProtecaoImportacao());const m=contratoImportacao(b.tipo||'folha_pagamento');return Response.json({success:true,contrato:m,sanitizado:b.exemplo?sanitizarImportacao(m.entity,b.exemplo):null,informado:b.exemplo?informacaoPagamento(b.exemplo,m):null});}
    if(b.acao==='iniciar'){
      const m=contratoImportacao(b.tipo);
      if(!b.identificacao||(!b.identificacao.seguro&&!b.confirmacao_manual)||b.identificacao.tipo!==b.tipo&&!b.confirmacao_manual)throw new Error('Identifique o arquivo e confirme o tipo antes de persistir.');
      if(typeof b.file_uri!=='string'||!b.file_uri||typeof b.file_hash!=='string'||!/^[a-f0-9]{64}$/.test(b.file_hash))throw new Error('Arquivo original e hash são obrigatórios.');
      const batch=await db.ImportBatch.create({title:`${m.label} · ${String(b.file_name||'arquivo').slice(0,200)}`,batch_type:m.tipo,file_name:String(b.file_name||'').slice(0,200),file_hash:b.file_hash,file_uri:b.file_uri,identificacao:b.identificacao,status:'processing',total_records:Math.max(0,Math.min(10000,Number(b.total_lidos)||0)),notes:JSON.stringify({contrato_versao:1,papel:m.papel,conciliacao:m.conciliacao,ignorados_selecao:Math.max(0,Math.min(10000,Number(b.ignorados_selecao)||0))})});
      return Response.json({success:true,batch});
    }
    if(b.acao==='confirmar')return Response.json(await confirmarPropostaImportacao(base44,user,b));
    if(typeof b.batch_id!=='string'||!b.batch_id)throw new Error('Lote obrigatório.');
    const batch=await db.ImportBatch.get(b.batch_id);contratoImportacao(batch.batch_type);
    if(b.acao==='salvar'){
      if(batch.status!=='processing')throw new Error('Lote já encerrado.');
      if(!Array.isArray(b.registros)||!b.registros.length||b.registros.length>30||JSON.stringify(b.registros).length>160000)throw new Error('Envie entre 1 e 30 registros por etapa.');
      if(!['NeuralTec','Liesch'].includes(b.empresa))throw new Error('Empresa da fonte inválida.');
      const items=batch.batch_type==='relatorio_vendas_detalhado'?await persistirVendas(base44,batch,b.registros,b):[];
      if(batch.batch_type!=='relatorio_vendas_detalhado')for(const r of b.registros)items.push(await persistirRegistro(base44,batch,r,b));
      return Response.json({success:true,saved:items.length,items});
    }
    if(b.acao==='buscar'){
      const page=await db.RegistroImportacao.filter({import_batch_id:batch.id},{limit:5,sort:'created_date',...(b.cursor?{cursor:b.cursor}:{})});
      for(const item of page.items)await buscarRegistroImportacao(base44,item);
      return Response.json({success:true,has_more:page.has_more,next_cursor:page.next_cursor});
    }
    if(b.acao==='finalizar'){
      if(batch.batch_type==='fatura_cartao'){
        const docs=await db.RegistroImportacao.filter({import_batch_id:batch.id,entidade_tipo:'FaturaCartao'},{limit:10});
        if(!docs.items.length||docs.has_more)throw new Error('Fatura não identificada para fechamento.');
        for(const item of docs.items){const f=await db.FaturaCartao.get(item.entidade_id),a=await db.LancamentoCartao.aggregate({query:{fatura_id:f.id},sum:'valor'});if(Math.abs(Number(a.rows[0]?.sum_valor||0)-Number(f.valor_total))>0.02)throw new Error('Composição divergente do total da fatura. Nenhum pagamento foi alterado.');}
      }
      const result=await resumoImportacao(db,batch.id);
      await db.ImportBatch.update(batch.id,{status:'completed',total_records:result.lidos,success_count:result.criados+result.atualizados,duplicate_count:result.ignorados,error_count:result.erros,...(b.ai_extraction?{ai_extraction:String(b.ai_extraction).slice(0,3000)}:{})});
      return Response.json({success:true,resumo:result});
    }
    if(b.acao==='resumo')return Response.json({success:true,resumo:await resumoImportacao(db,batch.id)});
    if(b.acao==='registros')return Response.json(await db.RegistroImportacao.filter({import_batch_id:batch.id},{limit:20,sort:'created_date',...(b.cursor?{cursor:b.cursor}:{})}));
    throw new Error('Ação inválida.');
  }catch(error){return Response.json({error:error.message},{status:422});}
}