import { base44 } from '@/api/base44Client';
import { importacaoFinanceira } from '@/functions/importacaoFinanceira';
export async function chamarImportacao(payload){const r=await importacaoFinanceira(payload);if(r.data?.error)throw new Error(r.data.error);return r.data;}
export default async function salvarImportacao({tipo,records,file,fileUri,fileHash,identificacao,empresa,rawText,onProgress,batchExistente}){
  const fatura=records.find(r=>r.data.__type==='FaturaCartao')?.data;
  const rows=records.filter(r=>r.selected).map(r=>r.data);
  if(tipo==='fatura_cartao'){
    if(!fatura?.conta_cartao_id)throw new Error('Selecione o cartão explicitamente antes de salvar.');
    const lancs=rows.filter(r=>r.__type==='LancamentoCartao');
    const soma=lancs.reduce((s,r)=>s+Number(r.valor||0),0);
    if(Math.abs(soma-Number(fatura.valor_total))>0.02)throw new Error('Seleção da composição não fecha com o total da fatura. Revise antes de salvar.');
    if(!rows.some(r=>r.__type==='FaturaCartao'))rows.unshift(fatura);
  }
  const batch=batchExistente|| (await chamarImportacao({acao:'iniciar',tipo,file_uri:fileUri,file_hash:fileHash,file_name:file?.name,total_lidos:records.length,ignorados_selecao:Math.max(0,records.length-rows.length),identificacao,confirmacao_manual:identificacao.tipo!==tipo||!identificacao.seguro})).batch;
  for(let i=0;i<rows.length;i+=30){onProgress(`Persistindo ${Math.min(i+30,rows.length)} de ${rows.length} sem baixa…`);await chamarImportacao({acao:'salvar',batch_id:batch.id,registros:rows.slice(i,i+30),empresa,conta_cartao_id:fatura?.conta_cartao_id,mes_referencia:fatura?.mes_referencia});}
  let ai_extraction='';if(rawText){const file=new File([rawText],`extracao_${batch.id}.json`,{type:'application/json'});ai_extraction=(await base44.integrations.Core.UploadPrivateFile({file})).file_uri;}
  const result=await chamarImportacao({acao:'finalizar',batch_id:batch.id,ai_extraction});
  let buscaErro='';try{let cursor;do{onProgress('Procurando correspondências, sem executar baixas…');const r=await chamarImportacao({acao:'buscar',batch_id:batch.id,cursor});cursor=r.has_more?r.next_cursor:null;}while(cursor);}catch(e){buscaErro=e.message;}
  return {batch,resumo:result.resumo,buscaErro};
}