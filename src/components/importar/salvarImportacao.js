import { base44 } from '@/api/base44Client';
import { importacaoFinanceira } from '@/functions/importacaoFinanceira';
export async function chamarImportacao(payload){const r=await importacaoFinanceira(payload);if(r.data?.error)throw new Error(r.data.error);return r.data;}
export default async function salvarImportacao({tipo,records,file,fileUri,fileHash,identificacao,empresa,rawText,onProgress,batchExistente}){
  const fatura=records.find(r=>r.data.__type==='FaturaCartao')?.data;
  const rows=records.map((r,i)=>({r,i})).filter(({r})=>r.selected).map(({r,i})=>tipo==='boletos_liquidados'?{...r.data,__linha_relatorio:i+1}:r.data);
  if(tipo==='fatura_cartao'){
    if(!fatura?.conta_cartao_id)throw new Error('Selecione o cartão explicitamente antes de salvar.');
    const lancs=rows.filter(r=>r.__type==='LancamentoCartao');
    const soma=lancs.reduce((s,r)=>s+Number(r.valor||0),0);
    if(Math.abs(soma-Number(fatura.valor_total))>0.02)throw new Error('Seleção da composição não fecha com o total da fatura. Revise antes de salvar.');
    if(!rows.some(r=>r.__type==='FaturaCartao'))rows.unshift(fatura);
  }
  const lotes = [];
  if (tipo === 'relatorio_vendas_detalhado') {
    const notas = rows.filter(r => r.__type !== 'TituloCobranca');
    for (let i = 0; i < notas.length; i += 30) lotes.push(notas.slice(i, i + 30));
    const grupos = new Map();
    for (const row of rows.filter(r => r.__type === 'TituloCobranca')) {
      const chave = `${row.empresa || empresa}|${String(row.seu_numero).toUpperCase()}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(row);
    }
    let lote = [];
    for (const grupo of grupos.values()) {
      if (grupo.length > 60) throw new Error('Uma nota excede o limite de 60 parcelas por importação. Confira o arquivo.');
      if (lote.length + grupo.length > 60) { lotes.push(lote); lote = []; }
      lote.push(...grupo);
    }
    if (lote.length) lotes.push(lote);
  } else for (let i = 0; i < rows.length; i += 30) lotes.push(rows.slice(i, i + 30));
  const batch=batchExistente|| (await chamarImportacao({acao:'iniciar',tipo,file_uri:fileUri,file_hash:fileHash,file_name:file?.name,total_lidos:records.length,ignorados_selecao:Math.max(0,records.length-rows.length),identificacao,confirmacao_manual:identificacao.tipo!==tipo||!identificacao.seguro})).batch;
  let salvos = 0;
  for (const lote of lotes) { salvos += lote.length; onProgress(`Persistindo ${salvos} de ${rows.length} sem baixa…`); await chamarImportacao({acao:'salvar',batch_id:batch.id,registros:lote,empresa,conta_cartao_id:fatura?.conta_cartao_id,mes_referencia:fatura?.mes_referencia}); }
  let ai_extraction='';if(rawText){const file=new File([rawText],`extracao_${batch.id}.json`,{type:'application/json'});ai_extraction=(await base44.integrations.Core.UploadPrivateFile({file})).file_uri;}
  const result=await chamarImportacao({acao:'finalizar',batch_id:batch.id,ai_extraction});
  let buscaErro='';try{let cursor;do{onProgress('Procurando correspondências, sem executar baixas…');const r=await chamarImportacao({acao:'buscar',batch_id:batch.id,cursor});cursor=r.has_more?r.next_cursor:null;}while(cursor);}catch(e){buscaErro=e.message;}
  return {batch,resumo:result.resumo,buscaErro};
}