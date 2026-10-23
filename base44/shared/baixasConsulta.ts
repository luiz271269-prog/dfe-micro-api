import { MODULOS_BAIXA,ehMovimento,normalizarBaixa } from './baixasContrato.ts';
import { lerCompleto } from './conciliacaoLeitura.ts';
const camposBusca={ItemCompra:['descricao_produto','fornecedor','numero_nota','pedido_central_id'],DespesaOperacional:['descricao','fornecedor'],Tributo:['descricao','tipo','competencia'],FolhaPagamento:['funcionario_nome','competencia'],FaturaCartao:['mes_referencia'],ObraReforma:['descricao','responsavel'],LancamentoBancario:['descricao','detalhe','conta_bancaria'],LancamentoCartao:['estabelecimento','observacao']};
export const camposEditaveisBaixa={ItemCompra:['descricao_produto','fornecedor','numero_nota','data_vencimento','origem_compra','tipo_compra'],DespesaOperacional:['descricao','fornecedor','data_vencimento','categoria','origem_compra','tipo_compra'],Tributo:['descricao','data_vencimento','origem_compra','tipo_compra'],FolhaPagamento:['origem_compra','tipo_compra'],FaturaCartao:['data_vencimento','origem_compra','tipo_compra'],ObraReforma:['descricao','responsavel','data_vencimento','origem_compra','tipo_compra'],LancamentoBancario:['categoria','origem_compra','tipo_compra','detalhe'],LancamentoCartao:['categoria','origem_compra','tipo_compra','observacao']};
export function queryBaixas(tipo,b) {
  const q=[];
  if(tipo==='LancamentoBancario')q.push({valor:{$lt:0}});
  if(tipo==='LancamentoCartao')q.push({valor:{$gt:0}});
  const campoData=tipo==='ItemCompra'?'data_emissao':tipo==='FolhaPagamento'?'competencia':tipo==='FaturaCartao'?'mes_referencia':tipo==='LancamentoCartao'?'data_lancamento':tipo==='Tributo'?'data_vencimento':'data';
  if(b.mes){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.mes))throw new Error('Mês inválido.');q.push({[campoData]:{$gte:b.mes,$lt:new Date(Date.UTC(Number(b.mes.slice(0,4)),Number(b.mes.slice(5)),1)).toISOString().slice(0,7)}});}
  if(b.empresa&&b.empresa!=='todas'&&!['FaturaCartao','LancamentoBancario'].includes(tipo))q.push({[tipo==='LancamentoCartao'?'empresa_beneficiada':'empresa']:b.empresa});
  if(b.busca){const texto=String(b.busca).slice(0,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');q.push({$or:camposBusca[tipo].map(c=>({[c]:{$regex:texto,$options:'i'}}))});}
  if(b.canal&&b.canal!=='todos'&&['ItemCompra','DespesaOperacional','FolhaPagamento','ObraReforma'].includes(tipo))q.push({forma_pagamento:{$in:({pix:['pix','banco_pix'],boleto:['boleto','banco_boleto'],transferencia:['transferencia','banco_transferencia']}[b.canal]||[b.canal])}});
  if(b.estado&&b.estado!=='todos'){
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
  return {...page,items:page.items.map(r=>normalizarBaixa(tipo,r))};
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
  return {registro:normalizarBaixa(tipo,r),vinculos,trilhas,evidencias,auditoria:auditoria.items,editaveis:camposEditaveisBaixa[tipo],admin:user.role==='admin',historicoMais:!!auditoria.has_more};
}