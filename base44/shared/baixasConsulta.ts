import { MODULOS_BAIXA,ehMovimento,normalizarBaixa } from './baixasContrato.ts';
import { lerCompleto } from './conciliacaoLeitura.ts';
const camposBusca={ItemCompra:['descricao_produto','fornecedor','numero_nota','pedido_central_id'],DespesaOperacional:['descricao','fornecedor'],Tributo:['descricao','tipo','competencia'],FolhaPagamento:['funcionario_nome','competencia'],FaturaCartao:['mes_referencia'],ObraReforma:['descricao','responsavel'],LancamentoBancario:['descricao','detalhe','conta_bancaria'],LancamentoCartao:['estabelecimento','observacao']};
export const camposEditaveisBaixa={ItemCompra:['descricao_produto','fornecedor','numero_nota','data_vencimento','origem_compra','tipo_compra'],DespesaOperacional:['descricao','fornecedor','data_vencimento','categoria','origem_compra','tipo_compra'],Tributo:['descricao','data_vencimento','origem_compra','tipo_compra'],FolhaPagamento:['origem_compra','tipo_compra'],FaturaCartao:['data_vencimento','origem_compra','tipo_compra'],ObraReforma:['descricao','responsavel','data_vencimento','origem_compra','tipo_compra'],LancamentoBancario:['categoria','origem_compra','tipo_compra','detalhe'],LancamentoCartao:['categoria','origem_compra','tipo_compra','observacao']};
export function queryBaixas(tipo,b) {
  const q=[];
  if(b.registro_id){if(typeof b.registro_id!=='string'||b.registro_id.length>200)throw new Error('Referência inválida.');q.push({id:b.registro_id});}
  if(b.estado==='disponivel'&&tipo==='LancamentoBancario')q.push({$or:[{status_conciliacao:{$in:['nao_conciliado','parcial']}},{status_conciliacao:{$exists:false}},{status_conciliacao:null}]});
  if(tipo==='LancamentoBancario')q.push({valor:{$lt:0}});
  if(tipo==='LancamentoCartao')q.push({valor:{$gt:0}});
  const campoData=tipo==='ItemCompra'?'data_emissao':tipo==='FolhaPagamento'?'competencia':tipo==='FaturaCartao'?'mes_referencia':tipo==='LancamentoCartao'?'data_lancamento':tipo==='Tributo'?'data_vencimento':'data';
  if(b.mes){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.mes))throw new Error('Mês inválido.');q.push({[campoData]:{$gte:b.mes,$lt:new Date(Date.UTC(Number(b.mes.slice(0,4)),Number(b.mes.slice(5)),1)).toISOString().slice(0,7)}});}
  if(b.empresa&&b.empresa!=='todas'&&!['FaturaCartao','LancamentoBancario'].includes(tipo))q.push({[tipo==='LancamentoCartao'?'empresa_beneficiada':'empresa']:b.empresa});
  if(b.busca){const texto=String(b.busca).slice(0,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');q.push({$or:camposBusca[tipo].map(c=>({[c]:{$regex:texto,$options:'i'}}))});}
  if(b.canal&&b.canal!=='todos'&&['ItemCompra','DespesaOperacional','FolhaPagamento','ObraReforma'].includes(tipo))q.push({forma_pagamento:{$in:({pix:['pix','banco_pix'],boleto:['boleto','banco_boleto'],transferencia:['transferencia','banco_transferencia']}[b.canal]||[b.canal])}});
  if(b.estado&&b.estado!=='todos'&&b.estado!=='disponivel'){
    if(tipo==='LancamentoBancario')q.push(b.estado==='bloqueado'?{$or:[{status_conciliacao:'ignorar'},{alerta_duplicidade:true},{duplicidade_ref:{$exists:true,$ne:null}}]}:{status_conciliacao:b.estado==='pendente'?'nao_conciliado':b.estado==='pago'?'conciliado':b.estado});
    else if(tipo!=='LancamentoCartao') {const campo=['ItemCompra','ObraReforma'].includes(tipo)?'status_pagamento':'status';const estados={pago:tipo==='FaturaCartao'?['paga_total']:['pago'],parcial:tipo==='FolhaPagamento'?['adiantamento']:tipo==='ItemCompra'||tipo==='ObraReforma'?['parcial']:['pendente','aberta','vencida','a_vencer','vencido'],pendente:['pendente','parcial','adiantamento','nao_identificado','a_vencer','vencido','aberta','vencida','parcelado']};if(estados[b.estado])q.push(tipo==='ObraReforma'&&b.estado==='pendente'?{$or:[{[campo]:{$in:estados[b.estado]}},{[campo]:{$exists:false}},{[campo]:null}]}:{[campo]:{$in:estados[b.estado]}});if(b.estado==='parcial')q.push({valor_pago:{$gt:0}});}
  }
  return {$and:q.length?q:[{}]};
}
export async function consultarListaBaixas(db,b) {
  const tipo=b.tipo;if(!MODULOS_BAIXA[tipo])throw new Error('Módulo inválido.');
  const q=queryBaixas(tipo,b);
  if(b.empresa&&b.empresa!=='todas'&&tipo==='FaturaCartao'){const ids=await lerCompleto(db,'ContaCartao',{empresa_vinculada:b.empresa},['id']);q.$and.push({conta_cartao_id:{$in:ids.map(x=>x.id)}});}
  if(b.empresa&&b.empresa!=='todas'&&tipo==='LancamentoBancario'){const contas=await lerCompleto(db,'ContaCartao',{},['conta_bancaria_pagamento','empresa_vinculada']);const conhecidas=contas.filter(c=>c.empresa_vinculada===b.empresa).map(c=>c.conta_bancaria_pagamento).filter(Boolean);q.$and.push({$or:[{conta_bancaria:{$in:conhecidas}},{conta_bancaria:{$regex:b.empresa==='NeuralTec'?'NeuralTec|36092':'Liesch|37101',$options:'i'}}]});}
  const page=await db[tipo].filter(q,{sort:'-created_date',limit:40,cursor:b.cursor||undefined});
  const ids=page.items.map(r=>r.id);
  const [bancos,cartoes,contas]=await Promise.all([
    db.VinculoExtrato.aggregate({query:tipo==='LancamentoBancario'?{lancamento_bancario_id:{$in:ids}}:{entidade_tipo:tipo,entidade_id:{$in:ids}},groupBy:tipo==='LancamentoBancario'?'lancamento_bancario_id':'entidade_id',sum:'valor_alocado'}),
    db.VinculoCartao.aggregate({query:tipo==='LancamentoCartao'?{lancamento_cartao_id:{$in:ids},fase:'confirmado'}:{entidade_tipo:tipo,entidade_id:{$in:ids},fase:'confirmado'},groupBy:tipo==='LancamentoCartao'?'lancamento_cartao_id':'entidade_id',sum:'valor_alocado'}),
    tipo==='FaturaCartao'?lerCompleto(db,'ContaCartao',{id:{$in:page.items.map(r=>r.conta_cartao_id).filter(Boolean)}},['id','empresa_vinculada']):Promise.resolve([])]);
  return {...page,items:page.items.map(r=>{const row=normalizarBaixa(tipo,r),vb=bancos.rows.find(x=>(x.lancamento_bancario_id||x.entidade_id)===r.id),vc=cartoes.rows.find(x=>(x.lancamento_cartao_id||x.entidade_id)===r.id);row.conciliado=Number(vb?.sum_valor_alocado||0);if(tipo==='LancamentoBancario')row.saldo=Math.max(0,Math.round((row.total-row.conciliado)*100)/100);if(vc||r.lancamento_cartao_id)row.estado='no_cartao';if(tipo==='LancamentoCartao'&&vc){row.saldo=0;row.estado='no_cartao';}if(tipo==='FaturaCartao')row.empresa=contas.find(c=>c.id===r.conta_cartao_id)?.empresa_vinculada||'';if(vb&&!ehMovimento(tipo)&&row.conciliado>=row.total-0.01)row.estado='conciliado';return row;})};
}
export async function detalheBaixas(base44,user,tipo,id) {
  const db=base44.entities,r=await db[tipo].get(id);
  if(tipo==='LancamentoBancario'&&!(r.valor<0))throw new Error('A central aceita apenas saídas.');
  const banco=tipo==='LancamentoBancario'?{lancamento_bancario_id:id}:{entidade_tipo:tipo,entidade_id:id};
  const cartao=tipo==='LancamentoCartao'?{lancamento_cartao_id:id}:{entidade_tipo:tipo,entidade_id:id};
  const [vinculos,trilhas,evidencias,auditoria]=await Promise.all([
    lerCompleto(db,'VinculoExtrato',banco),lerCompleto(db,'VinculoCartao',cartao),
    user.role==='admin'?lerCompleto(db,'EvidenciaFinanceira',tipo==='LancamentoBancario'?{lancamento_bancario_id:id,direcao:'saida'}:{entidade_tipo:tipo,entidade_id:id,direcao:'saida'}):Promise.resolve([]),
    user.role==='admin'?db.AuditoriaConciliacao.filter({entidade_tipo:tipo,entidade_id:id},{sort:'-created_date',limit:60}):Promise.resolve({items:[]})]);
  const refs=new Map();
  const adicionar=(t,i)=>{if(MODULOS_BAIXA[t]&&i&&!(t===tipo&&i===id)){const set=refs.get(t)||new Set();set.add(i);refs.set(t,set);}};
  vinculos.forEach(v=>{adicionar('LancamentoBancario',v.lancamento_bancario_id);adicionar(v.entidade_tipo,v.entidade_id);});
  trilhas.forEach(v=>{adicionar('LancamentoCartao',v.lancamento_cartao_id);adicionar(v.entidade_tipo,v.entidade_id);adicionar('FaturaCartao',v.fatura_id);});
  if(r.lancamento_bancario_id)adicionar('LancamentoBancario',r.lancamento_bancario_id);if(r.lancamento_cartao_id)adicionar('LancamentoCartao',r.lancamento_cartao_id);if(r.fatura_id)adicionar('FaturaCartao',r.fatura_id);
  const relacionados=[];const entradas=[...refs.entries()];for(let i=0;i<entradas.length;i+=6){const partes=await Promise.all(entradas.slice(i,i+6).map(async([t,set])=>(await lerCompleto(db,t,{id:{$in:[...set]}})).map(doc=>({tipo:t,registro:doc}))));relacionados.push(...partes.flat());}
  const registro=normalizarBaixa(tipo,r);if(trilhas.some(t=>t.fase==='confirmado')){registro.estado='no_cartao';if(tipo==='LancamentoCartao')registro.saldo=0;}
  if(tipo==='LancamentoBancario'){registro.conciliado=vinculos.reduce((s,v)=>s+Number(v.valor_alocado||0),0);registro.saldo=Math.max(0,Math.round((registro.total-registro.conciliado)*100)/100);if(registro.estado!=='bloqueado')registro.estado=registro.conciliado>=registro.total-0.01?'conciliado':registro.conciliado>0?'parcial':'nao_conciliado';}
  return {registro,vinculos,trilhas,evidencias,relacionados,auditoria:auditoria.items,editaveis:camposEditaveisBaixa[tipo],admin:user.role==='admin',historicoMais:!!auditoria.has_more};
}