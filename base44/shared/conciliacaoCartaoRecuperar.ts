import { lerCompleto, centavos } from './conciliacaoLeitura.ts';
import { TIPOS_VINCULO_CARTAO } from './conciliacaoCartaoRegras.ts';
export async function recuperarTrilhaCartao(db,id) {
  const trilhas=await lerCompleto(db,'VinculoCartao',{lancamento_cartao_id:id});
  if(trilhas.length!==1 || trilhas[0].fase==='confirmado') throw new Error('Não existe uma trilha pendente única para completar.');
  const t=trilhas[0];
  const [charge,doc]=await Promise.all([db.LancamentoCartao.get(id),db[t.entidade_tipo].get(t.entidade_id)]);
  const refs=(await Promise.all(TIPOS_VINCULO_CARTAO.map(async tipo=>(await lerCompleto(db,tipo,{lancamento_cartao_id:id},['id'])).map(r=>`${tipo}|${r.id}`)))).flat();
  if(refs.length!==1 || refs[0]!==`${t.entidade_tipo}|${doc.id}` || doc.lancamento_cartao_id!==id || doc.lancamento_bancario_id || centavos(charge.valor)!==centavos(t.valor_alocado) || charge.fatura_id!==t.fatura_id) throw new Error('A intenção não corresponde a um vínculo aplicado único. Revise os documentos, sem exclusão automática.');
  if(charge.conciliacao_token) throw new Error('Há outra execução em andamento. Aguarde antes de completar a trilha.');
  if(t.entidade_tipo==='ItemCompra') {
    if(charge.item_compra_id && charge.item_compra_id!==doc.id) throw new Error('Referência de compra conflitante.');
    await db.LancamentoCartao.update(id,{item_compra_id:doc.id});
  }
  await db.VinculoCartao.update(t.id,{fase:'confirmado',erro:''});
  return {id,entidade_tipo:t.entidade_tipo,entidade_id:t.entidade_id,valor_alocado:t.valor_alocado};
}