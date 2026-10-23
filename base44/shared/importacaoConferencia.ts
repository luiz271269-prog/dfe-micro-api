import { contratoImportacao } from './importacaoContrato.ts';
import { candidatosDocumento,candidatosMovimento,valorDocumento } from './importacaoMatching.ts';
import { candidatosEvidencia,norm } from './evidenciaFinanceira.ts';
import { PAGAVEIS } from './direcaoFinanceira.ts';
export async function resumoImportacao(db,batchId){
  const a=await db.RegistroImportacao.aggregate({query:{import_batch_id:batchId},groupBy:['resultado_importacao','conferencia','estado','pagamento_informado']});
  const s={total:0,criados:0,atualizados:0,ignorados:0,erros:0,encontrados:0,divergentes:0,ambiguos:0,sem_par:0,pagamentos_informados:0,propostas:0,aguardando_busca:0,executados:0,falhas:0};
  for(const r of a.rows){const n=r.count;s.total+=n;s[{criado:'criados',atualizado:'atualizados',ignorado:'ignorados',erro:'erros'}[r.resultado_importacao]||'erros']+=n;if(r.conferencia==='encontrado')s.encontrados+=n;if(r.conferencia==='divergente')s.divergentes+=n;if(r.conferencia==='ambiguo'||r.estado==='ambiguo')s.ambiguos+=n;if(r.conferencia==='sem_par'||r.estado==='pendente')s.sem_par+=n;if(r.pagamento_informado)s.pagamentos_informados+=n;if(['proposta','ambiguo','revisao'].includes(r.estado))s.propostas+=n;if(r.estado==='aguardando_busca'||r.conferencia==='pendente')s.aguardando_busca+=n;if(r.estado==='concluido')s.executados+=n;if(r.estado==='falhou')s.falhas+=n;}
  const batch=await db.ImportBatch.get(batchId),meta=JSON.parse(batch.notes||'{}');
  s.lidos=Number(batch.total_records)||s.total;s.ignorados+=Number(meta.ignorados_selecao)||0;
  return s;
}
async function conferirEvidencia(db,item){
  const ev=await db.EvidenciaFinanceira.get(item.entidade_id),encontrados=[];let incompleto=false;
  if(ev.tipo==='boletos_liquidados'&&ev.estado!=='pendente')return {conferencia:ev.estado==='confirmada'?'encontrado':'pendente',estado:'nao_aplicavel',candidatos:[],detalhe:'Evidência já resolvida no histórico. Nenhuma nova execução proposta.'};
  for(const tipo of ev.tipo==='dda_boletos'?PAGAVEIS:[ev.tipo==='relatorio_nfs'?'NotaFiscal':'TituloCobranca']){
    const res=await candidatosEvidencia(db,ev,tipo);
    for(const c of res.itens){const doc=await db[res.tipo].get(c.id);const nome=doc.cliente||doc.fornecedor||doc.funcionario_nome||doc.responsavel||doc.descricao||'';
      const valorOk=ev.tipo==='boletos_liquidados'?valorDocumento(res.tipo,doc)>=ev.valor-0.01:Math.abs(valorDocumento(res.tipo,doc)-ev.valor)<=0.01,identidade=norm(nome)===norm(ev.contraparte),empresaOk=!doc.empresa||doc.empresa===item.empresa;
      const emissao=ev.tipo!=='relatorio_nfs'||String(doc.data_emissao||'').slice(0,10)===ev.data;
      encontrados.push({tipo:res.tipo,doc,ok:valorOk&&identidade&&empresaOk&&emissao});}
    incompleto=incompleto||res.itens.length>=50;
  }
  const validos=encontrados.filter(c=>c.ok),conferencia=incompleto||validos.length>1?'ambiguo':validos.length===1?'encontrado':encontrados.length?'divergente':'sem_par';
  const lista=encontrados.slice(0,5).map(c=>`${c.tipo} ${c.doc.numero||c.doc.numero_nota||c.doc.descricao||c.doc.funcionario_nome||c.doc.id}: ${c.ok?'corresponde':'divergente'}`).join('; ');
  const patch={conferencia,detalhe:`${lista} · ${encontrados.length} documento(s) candidato(s). ${ev.tipo==='dda_boletos'?'Conferência de obrigação; nenhuma baixa permitida.':ev.tipo==='relatorio_nfs'?'Conferência fiscal; nenhum recebimento alterado.':'A certificação exige título e crédito bancário.'}`};
  if(ev.tipo==='boletos_liquidados'){
    if(validos.length!==1||incompleto)return {...patch,estado:validos.length>1?'ambiguo':'pendente',candidatos:[]};
    const c=validos[0];const result=await candidatosDocumento(db,c.tipo,c.doc,{...item,valor_pago_informado:ev.valor,data_pagamento_informada:ev.data});
    result.items=result.items.map(c=>({...c,evidencia_versao:ev.updated_date}));
    return {...patch,...estadoCandidatos(result)};
  }
  return {...patch,estado:'nao_aplicavel',candidatos:[]};
}
function estadoCandidatos(r){return {candidatos:r.items,estado:r.has_more||r.items.length>1?'ambiguo':!r.items.length?'pendente':r.items[0].forte?'proposta':'revisao',detalhe:r.has_more?'Busca com mais resultados possíveis; revise os candidatos e refine na origem.':'Busca concluída. Nenhuma operação financeira executada.'};}
export async function buscarRegistroImportacao(base44,item){
  if(['executando','concluido','falhou'].includes(item.estado))return item;
  const db=base44.entities,m=contratoImportacao(item.tipo_importacao);let patch={};
  if(!item.entidade_id)return item;
  if(m.evidencia)patch=await conferirEvidencia(db,item);
  else if(m.tipo==='relatorio_vendas'){
    const r=await db.RelatorioFaturamento.get(item.entidade_id);if(!/^\d{4}-\d{2}$/.test(r.mes))throw new Error('Mês inválido para conferência.');
    const [ano,mes]=r.mes.split('-').map(Number),fim=new Date(Date.UTC(ano,mes,0)).toISOString().slice(0,10);
    const soma=await db.NotaFiscal.aggregate({query:{empresa:item.empresa,data_emissao:{$gte:r.mes+'-01',$lte:fim},status:{$ne:'anulada'},is_espelho_ci:{$ne:true}},sum:'valor_total'});
    const total=Number(soma.rows[0]?.sum_valor_total||0),diff=Math.round((item.valor-total)*100)/100;
    patch={conferencia:Math.abs(diff)<=0.01?'encontrado':'divergente',estado:'nao_aplicavel',detalhe:`Resumo ${Number(item.valor).toFixed(2)}; notas Nexus ${total.toFixed(2)}; diferença ${diff.toFixed(2)}. Empresa ${item.empresa}, mês ${r.mes}.`};
  }else if(item.entidade_tipo==='LancamentoBancario')patch=estadoCandidatos(await candidatosMovimento(db,await db.LancamentoBancario.get(item.entidade_id),item));
  else if(item.entidade_tipo==='LancamentoCartao'){
    const r=await db.LancamentoCartao.get(item.entidade_id),n=await db.VinculoCartao.count({lancamento_cartao_id:r.id,fase:'confirmado'});
    patch={conferencia:n?'encontrado':'sem_par',estado:'nao_aplicavel',detalhe:`${n?'Componente explicado por documento':'Componente sem documento vinculado'}; ${r.tipo_compra?'classificado':'classificação pendente'}. Não representa pagamento da fatura.`};
  }else if(item.entidade_tipo==='FaturaCartao'){
    const r=await db.FaturaCartao.get(item.entidade_id),a=await db.LancamentoCartao.aggregate({query:{fatura_id:r.id},sum:'valor'}),soma=Number(a.rows[0]?.sum_valor||0),diff=r.valor_total-soma;
    patch={...estadoCandidatos(await candidatosDocumento(db,'FaturaCartao',r,item)),conferencia:Math.abs(diff)<=0.02?'encontrado':'divergente',detalhe:`Composição ${soma.toFixed(2)}; fatura ${r.valor_total.toFixed(2)}; diferença ${diff.toFixed(2)}. Eventuais candidatos abaixo pagam somente a fatura.`};
  }else if(item.pagamento_informado&&item.entidade_tipo!=='NotaFiscal')patch=estadoCandidatos(await candidatosDocumento(db,item.entidade_tipo,await db[item.entidade_tipo].get(item.entidade_id),item));
  else return item;
  // Busca nunca muda estado financeiro nem chama executores.
  const result=await db.RegistroImportacao.updateMany({id:item.id,updated_date:item.updated_date,estado:{$nin:['executando','concluido','falhou']}},{$set:patch});
  if(result.updated!==1)throw new Error('A proposta mudou durante a busca. Atualize.');
  return {...item,...patch};
}