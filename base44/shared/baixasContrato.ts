import { devidoTributo, empresaExtrato } from './tributoRegras.ts';
export const MODULOS_BAIXA = { ItemCompra:'Compras', DespesaOperacional:'Despesas e pró-labore', Tributo:'Tributos', FolhaPagamento:'Folha', FaturaCartao:'Faturas', ObraReforma:'Obras', LancamentoBancario:'Extrato', LancamentoCartao:'Compras no cartão' };
export const ehMovimento = tipo => ['LancamentoBancario','LancamentoCartao'].includes(tipo);
export const dinheiroBaixa = v => Math.round(Number(v || 0)*100)/100;
export function totalBaixa(tipo,r) { return dinheiroBaixa(tipo==='Tributo'?devidoTributo(r):tipo==='FolhaPagamento'?r.salario_liquido:tipo==='ItemCompra'||tipo==='FaturaCartao'?r.valor_total:Math.abs(r.valor||0)); }
export function normalizarBaixa(tipo,r) {
  const total=totalBaixa(tipo,r), status=r.status_pagamento||r.status||'';
  const pago=dinheiroBaixa(r.valor_pago || (['pago','paga_total'].includes(status)?total:0));
  const movimento=ehMovimento(tipo), data=r.data_vencimento||r.data_lancamento||r.data_emissao||r.data||`${r.competencia||r.mes_referencia||''}-01`;
  return {tipo,id:r.id,versao:r.updated_date,descricao:r.descricao||r.descricao_produto||r.estabelecimento||r.funcionario_nome||(tipo==='FaturaCartao'?`Fatura ${r.mes_referencia}`:`${r.tipo||MODULOS_BAIXA[tipo]} ${r.competencia||''}`),contraparte:r.fornecedor||r.responsavel||r.funcionario_nome||r.estabelecimento||'',empresa:r.empresa||r.empresa_beneficiada||(tipo==='LancamentoBancario'?empresaExtrato(r):'')||'',data,total,pago,saldo:movimento?dinheiroBaixa(Math.max(0,total-Number(r.valor_conciliado||0))):dinheiroBaixa(Math.max(0,total-pago)),canal:r.forma_pagamento||(tipo==='LancamentoBancario'?'extrato':tipo==='LancamentoCartao'?'cartao':''),estado:r.alerta_duplicidade||r.duplicidade_ref||r.status_conciliacao==='ignorar'?'bloqueado':r.lancamento_cartao_id?'no_cartao':tipo==='LancamentoBancario'?(r.status_conciliacao||'nao_conciliado'):pago>=total&&total>0?'pago':pago>0?'parcial':'pendente',raw:r};
}
export const camposFinanceirosBaixa = ['valor_pago','status','status_pagamento','forma_pagamento','data_pagamento','lancamento_bancario_id','lancamento_cartao_id','pagamentos_manuais'];
export const estadoBaixa = r => Object.fromEntries(camposFinanceirosBaixa.filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]]));
export function patchPagamentoBaixa(tipo,r,pago,data,forma) {
  const quitado=dinheiroBaixa(pago)>=totalBaixa(tipo,r), hoje=new Date().toISOString().slice(0,10);
  const patch={valor_pago:dinheiroBaixa(pago)};
  if(tipo==='ItemCompra'||tipo==='ObraReforma')patch.status_pagamento=quitado?'pago':pago>0?'parcial':'pendente';
  else patch.status=tipo==='FaturaCartao'?(quitado?'paga_total':r.data_vencimento<hoje?'vencida':'aberta'):tipo==='FolhaPagamento'?(quitado?'pago':pago>0?'adiantamento':'pendente'):tipo==='Tributo'?(quitado?'pago':r.data_vencimento<hoje?'vencido':'a_vencer'):(quitado?'pago':'pendente');
  if(tipo!=='ItemCompra')patch.data_pagamento=data||null;
  if(tipo!=='Tributo'&&tipo!=='FaturaCartao')patch.forma_pagamento=tipo==='ItemCompra'?({pix:'banco_pix',boleto:'banco_boleto',transferencia:'banco_transferencia',dinheiro:'dinheiro'}[forma]||forma):forma;
  return patch;
}