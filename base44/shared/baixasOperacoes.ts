import { totalBaixa,normalizarBaixa,estadoBaixa,ehMovimento,patchPagamentoBaixa } from './baixasContrato.ts';
import { camposEditaveisBaixa } from './baixasConsulta.ts';
import { registrarDeclarado,reabrirDeclarado,auditarBaixa,concluirBaixa,gravarCondicionalBaixa } from './baixasDeclaradas.ts';
import { aplicarVinculoCartao } from './conciliacaoCartaoAplicar.ts';
import { vincularCompraCartao } from './vincularCompraCartao.ts';
import { cancelarCartaoCentral } from './baixasCartaoCancelar.ts';
import { reservarRegistroBaixa,liberarRegistroBaixa } from './baixasReserva.ts';
import { lerCompleto } from './conciliacaoLeitura.ts';
import { empresaExtrato } from './tributoRegras.ts';
export async function executarBaixaCentral(base44,user,b) {
  const db=base44.entities;let r=await db[b.tipo].get(b.id);
  if(b.versao!==r.updated_date)throw new Error('Registro alterado. Atualize antes de confirmar.');
  if(b.acao==='manual')return registrarDeclarado(base44,user,{...b,entidade:b.tipo});
  if(b.acao==='reabrir'){const a=await db.AuditoriaConciliacao.get(b.auditoria_id);if(a.entidade_tipo!==b.tipo||a.entidade_id!==b.id)throw new Error('Auditoria não pertence ao registro.');return reabrirDeclarado(base44,user,b);}
  if(!['banco','cartao','removerBanco','cancelarCartao','editar','reabrirManual'].includes(b.acao))throw new Error('Operação inválida.');
  let audit,reserva;
  try {
    if(['editar','reabrirManual'].includes(b.acao)){reserva=await reservarRegistroBaixa(db,b.tipo,b.id,b.versao);r=reserva.registro;}
    if(b.acao==='editar'){
      const patch=b.patch;
      if(!patch||!Object.keys(patch).length||Object.keys(patch).some(k=>!camposEditaveisBaixa[b.tipo].includes(k)||typeof patch[k]!=='string'||patch[k].length>500))throw new Error('A edição aceita somente os campos indicados, sem alterar valores ou situação diretamente.');
      for(const [k,v] of Object.entries(patch)){
        if(k==='data_vencimento'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))throw new Error('Vencimento inválido.');
        if(['descricao','descricao_produto','fornecedor','responsavel'].includes(k)&&!v.trim())throw new Error('A identificação do documento não pode ficar vazia.');
        if(['tipo_compra','origem_compra','categoria'].includes(k)&&v){const cadastrada=await db.CadastroClassificacao.count({eixo:k==='tipo_compra'?'tipo':k==='origem_compra'?'origem':'categoria',chave:v,ativo:true});const padrao=k==='tipo_compra'?['estoque','fretes','despesas','folha','pro_labore','impostos','obras','financeiro','outro']:k==='origem_compra'?['empresa','pro_labore','pessoal','condominio','investimento']:[];if(!cadastrada&&!padrao.includes(v))throw new Error('Classificação não cadastrada ou inativa. Use uma chave válida do cadastro de classificação.');}
      }
      const [vb,vc]=await Promise.all([db.VinculoExtrato.count(ehMovimento(b.tipo)?{lancamento_bancario_id:b.id}:{entidade_tipo:b.tipo,entidade_id:b.id}),db.VinculoCartao.count(b.tipo==='LancamentoCartao'?{lancamento_cartao_id:b.id,fase:{$ne:'cancelado'}}:{entidade_tipo:b.tipo,entidade_id:b.id,fase:{$ne:'cancelado'}})]);
      if(vb||vc||r.lancamento_bancario_id||r.lancamento_cartao_id||r.item_compra_id)throw new Error('Desvincule antes de alterar dados de um registro conciliado.');
      audit=await auditarBaixa(base44,user,b.tipo,b.id,'editar',b.pedidoId,b.motivo,Object.fromEntries(Object.keys(patch).map(k=>[k,r[k]??null])),{patch});
      const result=await gravarCondicionalBaixa(db,b.tipo,r,patch);await concluirBaixa(base44,audit,Object.fromEntries(Object.keys(patch).map(k=>[k,result[k]??null])));return {ok:true};
    }
    if(b.acao==='reabrirManual'){
      if(!['FolhaPagamento','FaturaCartao'].includes(b.tipo))throw new Error('Use a reversão no histórico auditado para este módulo.');
      const h=r.pagamentos_manuais||[],p=h.at(-1);
      if(!p||p.id!==b.pagamento_id||Math.abs(h.reduce((s,x)=>s+x.valor,0)-Number(r.valor_pago||0))>0.01)throw new Error('Só é possível reabrir o último pagamento íntegro do histórico.');
      if(await db.VinculoExtrato.count({entidade_tipo:b.tipo,entidade_id:b.id})||r.lancamento_bancario_id)throw new Error('Desvincule o extrato antes de reabrir.');
      const patch={...patchPagamentoBaixa(b.tipo,r,Math.max(0,Number(r.valor_pago)-p.valor),h.slice(0,-1).map(x=>x.data).sort().at(-1),h.at(-2)?.forma||p.forma),pagamentos_manuais:h.slice(0,-1)};
      audit=await auditarBaixa(base44,user,b.tipo,b.id,'reabrir_manual',b.pedidoId,b.motivo,estadoBaixa(r),{pagamento:p});
      const result=await gravarCondicionalBaixa(db,b.tipo,r,patch);await concluirBaixa(base44,audit,estadoBaixa(result));return {ok:true};
    }
    if(b.acao==='removerBanco'){
      const v=await db.VinculoExtrato.get(b.vinculo_id);
      if(!(b.tipo==='LancamentoBancario'?v.lancamento_bancario_id===b.id:v.entidade_tipo===b.tipo&&v.entidade_id===b.id)||!['ItemCompra','DespesaOperacional','Tributo','FolhaPagamento','FaturaCartao','ObraReforma'].includes(v.entidade_tipo))throw new Error('Vínculo incompatível com as saídas desta central.');
      audit=await auditarBaixa(base44,user,b.tipo,b.id,'desvincular_banco',b.pedidoId,b.motivo,{registro:estadoBaixa(r),vinculo:v});
      const res=await base44.functions.invoke('vincularExtrato',{acao:'remover',vinculo_id:v.id,observacao:b.motivo});if(res.data?.error)throw new Error(res.data.error);await concluirBaixa(base44,audit,res.data);return res.data;
    }
    if(b.acao==='cancelarCartao'){
      const t=await db.VinculoCartao.get(b.vinculo_id);
      if(!(b.tipo==='LancamentoCartao'?t.lancamento_cartao_id===b.id:t.entidade_tipo===b.tipo&&t.entidade_id===b.id))throw new Error('Vínculo não pertence ao registro.');
      audit=await auditarBaixa(base44,user,b.tipo,b.id,'cancelar_cartao',b.pedidoId,b.motivo,{trilha:t,registro:estadoBaixa(r)});
      const result=await cancelarCartaoCentral(db,t,user.id,b.motivo);await concluirBaixa(base44,audit,result);return result;
    }
    if(!['LancamentoBancario','LancamentoCartao'].includes(b.tipo)||!['ItemCompra','DespesaOperacional','Tributo','FolhaPagamento','FaturaCartao','ObraReforma'].includes(b.destino))throw new Error('Selecione movimento e obrigação válidos.');
    const doc=await db[b.destino].get(b.destino_id);
    if(doc.updated_date!==b.destino_versao)throw new Error('A obrigação mudou desde a busca. Refaça a consulta.');
    const m=normalizarBaixa(b.tipo,r),d=normalizarBaixa(b.destino,doc);
    if(m.empresa&&d.empresa&&m.empresa!==d.empresa)throw new Error('Empresas diferentes.');
    if(m.estado==='bloqueado')throw new Error('Movimento ignorado ou com possível duplicidade.');
    if(b.acao==='banco'){
      if(b.tipo!=='LancamentoBancario'||!(r.valor<0)||['transferencia','interno','aplicacoes','resgates'].includes(r.categoria))throw new Error('Movimento não elegível para baixa de saída.');
      const valor=Number(b.valor);if(!Number.isFinite(valor)||valor<=0||valor>m.saldo+0.001)throw new Error('Alocação excede o saldo disponível no débito.');
      if(doc.lancamento_cartao_id)throw new Error('A obrigação está no cartão; baixe a fatura.');
      const vincs=await lerCompleto(db,'VinculoExtrato',{entidade_tipo:b.destino,entidade_id:doc.id});
      const soma=vincs.reduce((s,v)=>s+Number(v.valor_alocado||0),0);
      if(Number(doc.valor_pago||0)>soma+0.01||['pago','paga_total'].includes(doc.status)&&!vincs.length||doc.status_pagamento==='pago'&&!vincs.length)throw new Error('Há pagamento declarado. Reabra-o antes de conciliar para não duplicar a baixa.');
      if(valor>totalBaixa(b.destino,doc)-soma+0.001)throw new Error('Alocação excede o saldo da obrigação.');
      if(b.destino==='FolhaPagamento'&&(!doc.funcionario_id||!doc.funcionario_nome))throw new Error('Folha sem identidade completa do funcionário. Corrija na origem.');
      audit=await auditarBaixa(base44,user,b.tipo,b.id,'banco',b.pedidoId,b.motivo,{movimento:estadoBaixa(r),documento:estadoBaixa(doc)},{destino:b.destino,destino_id:doc.id,valor});
      const res=await base44.functions.invoke('vincularExtrato',{acao:'criar',lancamento_bancario_id:r.id,entidade_tipo:b.destino,entidade_id:doc.id,valor_alocado:valor,tipo_vinculo:valor<d.saldo?'pagamento_parcial':'pagamento_integral',conciliado_por:'manual',observacao:b.motivo});
      if(res.data?.error)throw new Error(res.data.error);await concluirBaixa(base44,audit,res.data);return res.data;
    }
    if(b.tipo!=='LancamentoCartao'||!['ItemCompra','DespesaOperacional','ObraReforma'].includes(b.destino))throw new Error('Destino incompatível com compra no cartão.');
    await db.FaturaCartao.get(r.fatura_id);
    audit=await auditarBaixa(base44,user,b.tipo,b.id,'cartao',b.pedidoId,b.motivo,{registro:estadoBaixa(doc)},{destino:b.destino,destino_id:doc.id});
    const result=b.destino==='ItemCompra'?await vincularCompraCartao(db,doc,r.id,user.id,{automatico:false,motivo:b.motivo}):await aplicarVinculoCartao(db,{id:r.id,versao:r.updated_date,valor:r.valor,data:r.data_lancamento,empresa:r.empresa_beneficiada||'',tipo_compra:r.tipo_compra,origem_compra:r.origem_compra,fatura_id:r.fatura_id},{tipo:b.destino,id:doc.id,versao:doc.updated_date},user.id,true,b.motivo);
    await concluirBaixa(base44,audit,result);return {ok:true,...result};
  }catch(error){if(audit)await concluirBaixa(base44,audit,null,error);throw error;}
  finally{if(reserva)await liberarRegistroBaixa(db,b.tipo,b.id,reserva.token);}
}