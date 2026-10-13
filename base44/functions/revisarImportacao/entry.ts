import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { reverterCorrecao } from '../../shared/reversaoImportacao.ts';
import { ENTIDADES,CAMPOS,preparar,diferenca,bloqueio } from '../../shared/revisaoImportacao.ts';
export default async function(req){try{
 const b=createClientFromRequest(req),user=await b.auth.me();if(!user)return Response.json({error:'Unauthorized'},{status:401});if(user.role!=='admin')return Response.json({error:'Forbidden'},{status:403});
 const body=await req.json(),db=b.entities;
 if(!['comparar','aplicar','preverReversao','reverter'].includes(body.acao)||(['comparar','aplicar'].includes(body.acao)&&!ENTIDADES[body.tipo])||JSON.stringify(body).length>400000)return Response.json({error:'Revisão inválida.'},{status:400});
 const batch=await db.ImportBatch.get(body.batch_id);if(!batch)return Response.json({error:'Importação não encontrada.'},{status:404});
 if(['preverReversao','reverter'].includes(body.acao))return Response.json(await reverterCorrecao(db,batch.id,body,user));
 if(body.acao==='comparar'){
  if(!Array.isArray(body.registros)||body.registros.length>100)return Response.json({error:'Máximo de 100 registros por comparação.'},{status:400});
  const resultados=[];
  let faturaId=null;
  if(body.tipo==='fatura_cartao'&&body.fatura?.conta_cartao_id&&body.fatura?.mes_referencia){const f=await db.FaturaCartao.filter({conta_cartao_id:body.fatura.conta_cartao_id,mes_referencia:body.fatura.mes_referencia},{limit:2});if(f.items.length===1&&!f.has_more)faturaId=f.items[0].id;}
  for(const data of body.registros){const entity=ENTIDADES[body.tipo].includes('EvidenciaFinanceira')?'EvidenciaFinanceira':data.__type || body.entity;
   try{const entrada=entity==='LancamentoCartao'&&faturaId?{...data,fatura_id:faturaId}:data;const {r,query}=preparar(body.tipo,entity,entrada,batch);const p=await db[entity].filter(query,{limit:2});
    if(p.items.length!==1||p.has_more){resultados.push({entity,bloqueio:p.items.length?'Correspondência ambígua; nenhum registro será alterado.':'Não localizado pela identidade. Use nova importação para registros ausentes.'});continue;}
    const atual=p.items[0],patch=diferenca(entity,r,atual),erro=await bloqueio(db,entity,atual,patch);
    resultados.push({entity,id:atual.id,versao:atual.updated_date,antes:Object.fromEntries(Object.keys(patch).map(k=>[k,atual[k] ?? null])),...(Object.keys(patch).length?{patch}:{}),bloqueio:erro,mensagem:Object.keys(patch).length?'Diferenças para confirmação':'Sem diferenças; histórico preservado.'});
   }catch(e){resultados.push({entity,bloqueio:e.message});}}
  return Response.json({success:true,resultados});
 }
 if(!Array.isArray(body.mudancas)||!body.mudancas.length||body.mudancas.length>100||String(body.motivo || '').trim().length<10||body.motivo.length>1000)return Response.json({error:'Selecione correções e informe justificativa entre 10 e 1000 caracteres.'},{status:400});
 const planos=[];
 for(const m of body.mudancas){if(!ENTIDADES[body.tipo].includes(m.entity)||!m.patch||Object.keys(m.patch).some(k=>!CAMPOS[m.entity].includes(k)))throw new Error('Campo de pagamento, vínculo ou destino não permitido.');const atual=await db[m.entity].get(m.id);if(atual.updated_date!==m.versao)throw new Error('Registro mudou após a comparação. Compare novamente.');const erro=await bloqueio(db,m.entity,atual,m.patch);if(erro)throw new Error(erro);const patch={...m.patch};if(m.entity==='NotaFiscal'&&patch.valor_total!==undefined)patch.valor_aberto=Math.max(0,Number(patch.valor_total)-Number(atual.valor_recebido || 0));if(m.entity==='LancamentoBancario'&&patch.data)patch.mes_referencia=patch.data.slice(0,7);planos.push({m,atual,patch});}
 let applied=0;
 for(const {m,atual,patch} of planos){const audit=await db.AuditoriaImportacao.create({batch_id:batch.id,entidade_tipo:m.entity,entidade_id:m.id,antes_json:JSON.stringify(Object.fromEntries(Object.keys(patch).map(k=>[k,atual[k] ?? null]))),depois_json:JSON.stringify(patch),arquivo_uri:String(body.arquivo_uri || '').slice(0,3000),motivo:body.motivo.trim(),usuario_id:user.id,fase:'preparada'});try{await db[m.entity].update(m.id,patch);await db.AuditoriaImportacao.update(audit.id,{fase:'confirmada'});applied++;}catch(e){await db.AuditoriaImportacao.update(audit.id,{fase:'falha',erro:e.message.slice(0,1000)});throw e;}}
 return Response.json({success:true,applied});
}catch(e){return Response.json({error:e.message},{status:422});}}