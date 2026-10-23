import { auditarBaixa,concluirBaixa } from './baixasDeclaradas.ts';
export async function revisarFixasCentral(base44,user,b) {
  if(user.role!=='admin')throw new Error('Revisão de despesas fixas restrita a administrador.');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.mes||''))throw new Error('Selecione o mês de revisão.');
  if(b.acao==='fixasListar')return base44.entities.SugestaoConciliacao.filter({entidade_tipo:'RegraRecorrente',competencia:b.mes,status:'pendente'},{sort:'-created_date',limit:20,cursor:b.cursor||undefined});
  if(b.acao==='fixasAnalisar'){const res=await base44.functions.invoke('revisarDespesasFixas',{acao:'analisar',mes:b.mes});if(res.data?.error)throw new Error(res.data.error);return res.data;}
  if(!['fixasConfirmar','fixasRejeitar'].includes(b.acao)||typeof b.sugestao_id!=='string'||typeof b.pedidoId!=='string'||!b.pedidoId||b.pedidoId.length>80||typeof b.motivo!=='string'||b.motivo.length<10||b.motivo.length>500)throw new Error('Confirme a sugestão individualmente, com motivo.');
  const s=await base44.entities.SugestaoConciliacao.get(b.sugestao_id);
  if(s.entidade_tipo!=='RegraRecorrente'||s.competencia!==b.mes)throw new Error('Sugestão fora do recorte.');
  const audit=await auditarBaixa(base44,user,'RegraRecorrente',s.entidade_id,b.acao,b.pedidoId,b.motivo,s,{sugestao_id:s.id});
  try{const res=await base44.functions.invoke('revisarDespesasFixas',{acao:b.acao==='fixasConfirmar'?'confirmar':'rejeitar',sugestao_id:s.id});if(res.data?.error)throw new Error(res.data.error);await concluirBaixa(base44,audit,res.data);return res.data;}
  catch(error){await concluirBaixa(base44,audit,null,error);throw error;}
}