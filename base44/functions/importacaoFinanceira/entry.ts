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
    const arquivoValido=typeof b.file_uri==='string'&&!!b.file_uri&&b.file_uri.length<=1500&&typeof b.file_hash==='string'&&/^[a-f0-9]{64}$/.test(b.file_hash);
    // Guarda o original assim que é anexado, antes de qualquer extração, para importar ou reler depois.
    if(b.acao==='anexar'){
      if(!arquivoValido||/^https?:/i.test(b.file_uri))return Response.json({error:'Arquivo original e hash são obrigatórios.'},{status:400});
      const existente=(await db.ImportBatch.filter({file_hash:b.file_hash,file_uri:{$exists:true}},{limit:1,sort:'-created_date'})).items[0];
      if(existente?.file_uri)return Response.json({success:true,batch:existente,ja_guardado:true});
      const i=b.identificacao||{},tipo=MATRIZ_IMPORTACAO.some(m=>m.tipo===i.tipo)?i.tipo:'nao_identificado',nome=String(b.file_name||'arquivo').slice(0,200);
      const batch=await db.ImportBatch.create({title:`Arquivo anexado · ${nome}`,batch_type:tipo,file_name:nome,file_hash:b.file_hash,file_uri:b.file_uri,status:'anexado',notes:JSON.stringify({anexo:true}),...(b.identificacao?{identificacao:{tipo:String(i.tipo||'').slice(0,60),seguro:i.seguro===true,motivo:String(i.motivo||'').slice(0,500),evidencia:String(i.evidencia||'').slice(0,500)}}:{})});
      return Response.json({success:true,batch});
    }
    if(b.acao==='iniciar'){
      const m=contratoImportacao(b.tipo);
      if(!b.identificacao||(!b.identificacao.seguro&&!b.confirmacao_manual)||b.identificacao.tipo!==b.tipo&&!b.confirmacao_manual)throw new Error('Identifique o arquivo e confirme o tipo antes de persistir.');
      if(typeof b.file_uri!=='string'||!b.file_uri||typeof b.file_hash!=='string'||!/^[a-f0-9]{64}$/.test(b.file_hash))throw new Error('Arquivo original e hash são obrigatórios.');
      const dados={title:`${m.label} · ${String(b.file_name||'arquivo').slice(0,200)}`,batch_type:m.tipo,file_name:String(b.file_name||'').slice(0,200),file_hash:b.file_hash,file_uri:b.file_uri,identificacao:b.identificacao,status:'processing',total_records:Math.max(0,Math.min(10000,Number(b.total_lidos)||0)),notes:JSON.stringify({contrato_versao:1,papel:m.papel,conciliacao:m.conciliacao,ignorados_selecao:Math.max(0,Math.min(10000,Number(b.ignorados_selecao)||0))})};
      // O arquivo guardado ao anexar vira o próprio lote da importação, sem duplicar o histórico.
      const guardado=(await db.ImportBatch.filter({file_hash:b.file_hash,status:'anexado'},{limit:1})).items[0];
      const batch=guardado?{...guardado,...dados,...(await db.ImportBatch.update(guardado.id,dados)),id:guardado.id}:await db.ImportBatch.create(dados);
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