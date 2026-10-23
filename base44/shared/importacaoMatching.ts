import { normalizarBaixa } from './baixasContrato.ts';
import { empresaExtrato } from './tributoRegras.ts';
import { direcaoBanco,PAGAVEIS } from './direcaoFinanceira.ts';
import { norm } from './evidenciaFinanceira.ts';
export const valorDocumento=(tipo,r)=>Number(tipo==='TituloCobranca'?r.valor_titulo:tipo==='NotaFiscal'?r.valor_total:tipo==='FolhaPagamento'?r.salario_liquido:tipo==='Tributo'?Number(r.valor_original||0)+Number(r.juros_multa||0):r.valor_total??r.valor??0);
export async function empresaDocumento(db,tipo,r,fallback=''){
  if(tipo==='FaturaCartao')return (await db.ContaCartao.get(r.conta_cartao_id)).empresa_vinculada||'';
  if(tipo==='LancamentoCartao'){const f=await db.FaturaCartao.get(r.fatura_id);return r.empresa_beneficiada||await empresaDocumento(db,'FaturaCartao',f);}
  const direta=tipo==='LancamentoBancario'?empresaExtrato(r):r.empresa;if(direta)return direta;
  const page=await db.RegistroImportacao.filter({entidade_tipo:tipo,entidade_id:r.id},{limit:50});
  const empresas=[...new Set(page.items.map(i=>i.empresa).filter(Boolean))];
  return !page.has_more&&empresas.length===1?empresas[0]:'';
}
export async function saldoDocumento(db,tipo,r){
  const a=await db.VinculoExtrato.aggregate({query:{entidade_tipo:tipo,entidade_id:r.id},sum:'valor_alocado'}),alocado=Number(a.rows[0]?.sum_valor_alocado||0);
  const pago=Math.max(alocado,Number(r.valor_pago??r.valor_recebido??0));
  if(pago>alocado+0.01)return 0; // Pagamento anterior sem vínculo requer revisão na origem, nunca substituição.
  if(r.lancamento_cartao_id||r.status_pagamento==='pago'||['pago','paga_total'].includes(r.status)&&!pago)return 0;
  return Math.max(0,Math.round((valorDocumento(tipo,r)-pago)*100)/100);
}
export async function criarCandidato(db,tipo,doc,movTipo,mov,info){
  const entrada=['TituloCobranca','NotaFiscal'].includes(tipo),cartao=movTipo==='LancamentoCartao';
  if(cartao&&!['ItemCompra','DespesaOperacional','ObraReforma'].includes(tipo))return null;
  if(!cartao&&(direcaoBanco(mov)!==(entrada?'entrada':'saida')||mov.alerta_duplicidade||mov.duplicidade_ref))return null;
  if(cartao&&(mov.valor<=0||mov.item_compra_id||!mov.fatura_id))return null;
  const [ed,em,saldo]=await Promise.all([empresaDocumento(db,tipo,doc,info.empresa),empresaDocumento(db,movTipo,mov,info.empresa),saldoDocumento(db,tipo,doc)]);
  if(!ed||!em||ed!==em||saldo<=0)return null;
  if(tipo==='FolhaPagamento'&&!doc.funcionario_id)return null;
  if(tipo==='NotaFiscal'&&await db.TituloCobranca.count({nota_fiscal_id:doc.id}))return null;
  if(!entrada&&tipo!=='FaturaCartao'&&mov.tipo_compra&&doc.tipo_compra&&mov.tipo_compra!==doc.tipo_compra)return null;
  if(cartao&&await db.VinculoCartao.count({lancamento_cartao_id:mov.id,fase:{$ne:'cancelado'}}))return null;
  if(!cartao&&await db.VinculoExtrato.count({lancamento_bancario_id:mov.id,entidade_tipo:tipo,entidade_id:doc.id}))return null;
  const [links,doclinks]=await Promise.all([db.VinculoExtrato.aggregate({query:{lancamento_bancario_id:mov.id},sum:'valor_alocado'}),db.VinculoCartao.count({entidade_tipo:tipo,entidade_id:doc.id,fase:{$ne:'cancelado'}})]);
  if(doclinks||doc.lancamento_cartao_id)return null;
  const disponivel=Math.max(0,Math.abs(mov.valor)-Number(links.rows[0]?.sum_valor_alocado||0));
  const informado=Number(info.valor_pago_informado||0),valor=cartao?Number(mov.valor):informado>0?informado:Math.min(saldo,disponivel);
  if(!(valor>0)||valor>saldo+0.001||valor>disponivel+0.001)return null;
  const nome=String(doc.cliente||doc.fornecedor||doc.funcionario_nome||doc.responsavel||doc.descricao||'');
  const texto=norm(`${mov.descricao||mov.estabelecimento||''} ${mov.detalhe||''}`),palavras=nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\W+/).filter(t=>t.length>3);
  const identidade=palavras.some(p=>texto.includes(norm(p)));
  const data=mov.data||mov.data_lancamento,ref=info.data_pagamento_informada||doc.data_pagamento_informada||doc.data_vencimento||doc.data_emissao||doc.data||`${doc.competencia||doc.mes_referencia||''}-01`;
  const dias=Math.abs(Date.parse(data)-Date.parse(ref))/86400000;if(!Number.isFinite(dias)||dias>15)return null;
  const forte=identidade&&dias<=3&&Math.abs(valor-disponivel)<=0.01&&Math.abs(valor-saldo)<=0.01;
  return {chave:`${movTipo}:${mov.id}:${tipo}:${doc.id}`,entidade_tipo:tipo,entidade_id:doc.id,entidade_versao:doc.updated_date,movimento_tipo:movTipo,movimento_id:mov.id,movimento_versao:mov.updated_date,descricao_documento:nome||`${tipo} ${doc.mes_referencia||doc.numero||''}`,descricao_movimento:mov.descricao||mov.estabelecimento,empresa:ed,data,valor:Math.round(valor*100)/100,saldo_documento:saldo,saldo_movimento:disponivel,forte,efeito:cartao?'composicao':'financeira',criterio:`Empresa ${ed}; valor disponível; intervalo ${Math.round(dias)} dia(s); ${identidade?'contraparte identificada':'identidade exige conferência manual'}; ${cartao?'somente composição, sem pagamento':'pagamento/recebimento sujeito a autorização'}`};
}
export async function candidatosDocumento(db,tipo,doc,info){
  const cartao=info.forma_informada==='cartao'&&['ItemCompra','DespesaOperacional','ObraReforma'].includes(tipo),movTipo=cartao?'LancamentoCartao':'LancamentoBancario';
  const valor=Number(info.valor_pago_informado||0)||await saldoDocumento(db,tipo,doc);if(valor<=0)return {items:[],has_more:false};
  const ref=info.data_pagamento_informada||doc.data_vencimento||doc.data_emissao||doc.data||`${doc.competencia||doc.mes_referencia||''}-01`;
  if(!Number.isFinite(Date.parse(ref)))return {items:[],has_more:false};
  const range=n=>new Date(Date.parse(ref)+n*86400000).toISOString().slice(0,10),entrada=['TituloCobranca','NotaFiscal'].includes(tipo);
  const alvo=cartao||entrada?valor:-valor;
  const page=await db[movTipo].filter({valor:entrada?{$gte:alvo-0.01}:{$gte:alvo-0.01,$lte:alvo+0.01},[cartao?'data_lancamento':'data']:{$gte:range(-15),$lte:range(15)}},{limit:21,sort:cartao?'data_lancamento':'data'});
  const items=[];for(const mov of page.items){const c=await criarCandidato(db,tipo,doc,movTipo,mov,info);if(c)items.push(c);}
  return {items:items.slice(0,20),has_more:page.has_more||items.length>20};
}
export async function candidatosMovimento(db,mov,info){
  const tipos=mov.valor>0?['TituloCobranca','NotaFiscal']:PAGAVEIS,items=[];let has_more=false;
  const fields={TituloCobranca:'valor_titulo',NotaFiscal:'valor_total',FolhaPagamento:'salario_liquido',Tributo:'valor_original',ItemCompra:'valor_total',FaturaCartao:'valor_total',DespesaOperacional:'valor',ObraReforma:'valor'};
  for(const tipo of tipos){
    const dataCampo={TituloCobranca:'data_vencimento',NotaFiscal:'data_emissao',FolhaPagamento:'competencia',Tributo:'data_vencimento',ItemCompra:'data_emissao',FaturaCartao:'data_vencimento',DespesaOperacional:'data',ObraReforma:'data'}[tipo];
    const antes=new Date(Date.parse(mov.data)-15*86400000).toISOString().slice(0,tipo==='FolhaPagamento'?7:10),depois=new Date(Date.parse(mov.data)+15*86400000).toISOString().slice(0,tipo==='FolhaPagamento'?7:10);
    const page=await db[tipo].filter({[fields[tipo]]:{$gte:Math.abs(mov.valor)-0.01},[dataCampo]:{$gte:antes,$lte:depois}},{limit:21,sort:'-created_date'});has_more=has_more||page.has_more;
    for(const doc of page.items){const c=await criarCandidato(db,tipo,doc,'LancamentoBancario',mov,{...info,valor_pago_informado:0});if(c)items.push(c);}
  }
  return {items:items.slice(0,20),has_more:has_more||items.length>20};
}