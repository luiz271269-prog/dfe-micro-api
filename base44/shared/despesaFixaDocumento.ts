import { lerCompleto } from './conciliacaoLeitura.ts';
import { normalizarFixa } from './despesasFixas.ts';
export async function obterDocumentoFixa(db,r,l,canal,match) {
  const campo=canal==='cartao'?'lancamento_cartao_id':'lancamento_bancario_id';
  const [porCiclo,diretas,candidatas]=await Promise.all([
    lerCompleto(db,'DespesaOperacional',{regra_recorrente_id:r.id,ocorrencia_vencimento:match.vencimento}),
    lerCompleto(db,'DespesaOperacional',{[campo]:l.id}),
    lerCompleto(db,'DespesaOperacional',{empresa:r.empresa,data:{$gte:`${match.vencimento.slice(0,7)}-01`,$lte:`${match.vencimento.slice(0,7)}-31`},valor:match.valor})
  ]);
  const palavras=normalizarFixa(r.padrao_descricao).split(' ').filter(p=>p.length>2);
  const rows=[...new Map([...porCiclo,...diretas,...candidatas.filter(d=>palavras.every(p=>normalizarFixa(`${d.descricao} ${d.fornecedor||''}`).includes(p)))].map(d=>[d.id,d])).values()];
  if(rows.length>1)throw new Error('Mais de uma despesa corresponde ao ciclo. Revise os documentos antes de confirmar.');
  const d=rows[0];
  if(d){
    if(d.regra_recorrente_id&&d.regra_recorrente_id!==r.id)throw new Error('Despesa já associada a outra regra.');
    if(d.empresa!==r.empresa||Math.abs(d.valor-match.valor)>0.01||d.tipo_compra&&d.tipo_compra!=='despesas'||d.origem_compra&&d.origem_compra!==r.origem_compra)throw new Error('Documento existente com valor, empresa ou classificação divergente.');
    if(d.lancamento_cartao_id&&d.lancamento_cartao_id!==l.id||d.lancamento_bancario_id&&d.lancamento_bancario_id!==l.id)throw new Error('Despesa já vinculada a outro lançamento.');
    return d;
  }
  return await db.DespesaOperacional.create({data:match.vencimento,competencia:match.vencimento.slice(0,7),data_vencimento:match.vencimento,descricao:r.nome,fornecedor:r.fornecedor||r.nome,categoria:r.categoria,origem_compra:r.origem_compra,tipo_compra:'despesas',empresa:r.empresa,valor:match.valor,valor_pago:0,status:'pendente',forma_pagamento:r.forma_pagamento||'pix',recorrente:true,regra_recorrente_id:r.id,ocorrencia_vencimento:match.vencimento,observacoes:`Regra recorrente ${r.id} · ${r.nome}`});
}