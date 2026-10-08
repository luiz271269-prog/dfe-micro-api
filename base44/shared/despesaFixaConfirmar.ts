import { avaliarFixa, validarClassificacaoFixa, carregarFixas } from './despesasFixas.ts';
import { obterDocumentoFixa } from './despesaFixaDocumento.ts';
import { reservarDespesa, liberarDespesa } from './despesaReserva.ts';
import { aplicarVinculoCartao } from './conciliacaoCartaoAplicar.ts';
import { lerCompleto } from './conciliacaoLeitura.ts';
export async function confirmarDespesaFixa(base44,body,userId) {
  const db=base44.entities,canal=body.canal||'extrato';
  if(!['cartao','extrato'].includes(canal))throw new Error('Canal inválido.');
  const reserva=await reservarDespesa(db,'RegraRecorrente',body.regra_id);
  try {
    const r=reserva.registro,l=await db[canal==='cartao'?'LancamentoCartao':'LancamentoBancario'].get(body.lancamento_id);
    const match=avaliarFixa(r,l,canal);
    if(!match||match.bloqueada||l.alerta_duplicidade||l.duplicidade_ref)throw new Error(match?.motivo||'Lançamento incompatível ou com duplicidade.');
    await validarClassificacaoFixa(db,r);
    const campo=canal==='cartao'?'lancamento_cartao_id':'lancamento_bancario_id';
    const conflitos=await Promise.all((canal==='cartao'?['ItemCompra','ObraReforma']:['Tributo','FolhaPagamento','ObraReforma','ItemCompra','FaturaCartao','MovimentoFinanceiro']).map(t=>db[t].count({[campo]:l.id})));
    if(l.item_compra_id||conflitos.some(Boolean))throw new Error('Lançamento já pertence a outro módulo. Preserve o vínculo existente.');
    if(body.simular)return {success:true,simulacao:true,canal,competencia:match.vencimento.slice(0,7),valor:match.valor};
    const regras=await carregarFixas(db,'RegraRecorrente',{is_ativa:true});
    if(regras.filter(x=>{const m=avaliarFixa(x,l,canal);return m&&!m.bloqueada;}).length!==1)throw new Error('Mais de uma regra compatível. Revise antes de confirmar.');
    const d=await obterDocumentoFixa(db,r,l,canal,match);
    if(canal==='cartao'){
      const fatura=await db.FaturaCartao.get(l.fatura_id);
      if(!fatura?.id)throw new Error('Fatura não encontrada.');
      const trilhas=await lerCompleto(db,'VinculoCartao',{lancamento_cartao_id:l.id,fase:{$ne:'cancelado'}});
      if(!(d.lancamento_cartao_id===l.id&&trilhas.some(t=>t.entidade_id===d.id&&t.fase==='confirmado'))){
        if(d.status==='pago'||d.lancamento_bancario_id)throw new Error('Despesa já paga: revisão necessária para não duplicar a baixa.');
        const row={id:l.id,versao:l.updated_date,valor:l.valor,data:l.data_lancamento,empresa:l.empresa_beneficiada||'',tipo_compra:l.tipo_compra,origem_compra:l.origem_compra,fatura_id:l.fatura_id};
        await aplicarVinculoCartao(db,row,{id:d.id,tipo:'DespesaOperacional',versao:d.updated_date},userId,true,`Despesa fixa ${r.nome}: regra, empresa, documento, valor e ciclo conferidos pelo usuário.`);
      }
    }else{
      const {data}=await base44.functions.invoke('vincularExtrato',{acao:'criar',entidade_tipo:'DespesaOperacional',entidade_id:d.id,lancamento_bancario_id:l.id,valor_alocado:match.valor,conciliado_por:'regra_recorrente',observacao:`Despesa fixa ${r.nome}; competência ${d.competencia||d.data?.slice(0,7)} preservada.`});
      if(!data?.success)throw new Error(data?.error||'Pagamento não confirmado.');
    }
    await db.DespesaOperacional.update(d.id,{recorrente:true,regra_recorrente_id:r.id,ocorrencia_vencimento:match.vencimento,...(!d.competencia?{competencia:d.data.slice(0,7)}:{})});
    return {success:true,canal,despesa_id:d.id};
  }finally{await liberarDespesa(db,'RegraRecorrente',body.regra_id,reserva.token);}
}