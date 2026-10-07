import { lerCompleto } from './conciliacaoLeitura.ts';
import { compraReal, evidenciasCartao } from './conciliacaoCartaoRegras.ts';
import { carregarCandidatosCartao } from './conciliacaoCartaoDados.ts';
import { aplicarVinculoCartao } from './conciliacaoCartaoAplicar.ts';
export async function conciliarComprasCartao(db, payload, userId, escopo = ['ItemCompra','DespesaOperacional','ObraReforma']) {
  const mes = payload.mes || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0,7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido.');
  const acao = payload.acao || (payload.dry_run ? 'analisar' : 'aplicar');
  if (!['analisar','aplicar','confirmar'].includes(acao)) throw new Error('Ação inválida.');
  if (payload.cursor && (typeof payload.cursor !== 'string' || payload.cursor.length > 4096)) throw new Error('Página inválida.');
  const faturas = await lerCompleto(db, 'FaturaCartao', { mes_referencia: mes }, ['conta_cartao_id']);
  const ids = faturas.map(f=>f.id);
  const page = ids.length ? await db.LancamentoCartao.filter({ fatura_id: { $in: ids }, valor: { $gt: 0 } }, { sort: 'id', limit: 20, cursor: payload.cursor }) : { items: [], has_more: false };
  const charges = page.items.filter(compraReal);
  const dados = await carregarCandidatosCartao(db, charges);
  const ocupado = l => l.item_compra_id || dados.referencias.some(d=>d.reg.lancamento_cartao_id === l.id) || dados.trilhas.some(t=>t.lancamento_cartao_id === l.id);
  const candidatosPara = l => dados.documentos.map(d=>({ ...d, evidencia: evidenciasCartao(l,d.reg,d.tipo) })).filter(d=>d.evidencia.elegivel && !dados.bancos.some(v=>v.entidade_tipo===d.tipo && v.entidade_id===d.reg.id));
  const detalhes = charges.map(l=>{
    const refs = dados.referencias.filter(d=>d.reg.lancamento_cartao_id===l.id);
    const trilhas = dados.trilhas.filter(t=>t.lancamento_cartao_id===l.id);
    const destinos = new Set([...refs.map(d=>`${d.tipo}|${d.reg.id}`), ...trilhas.map(t=>`${t.entidade_tipo}|${t.entidade_id}`), ...(l.item_compra_id ? [`ItemCompra|${l.item_compra_id}`] : [])]);
    const candidatos = ocupado(l) ? [] : candidatosPara(l).map(d=>{
      const outros = dados.concorrentes.filter(x=>compraReal(x) && !ocupado(x) && evidenciasCartao(x,d.reg,d.tipo).elegivel);
      return { id:d.reg.id,tipo:d.tipo,versao:d.reg.updated_date,...d.evidencia,auto:d.evidencia.auto && outros.length===1, motivos:[...d.evidencia.motivos,...(outros.length!==1 ? ['Documento disputado por mais de uma compra'] : [])] };
    });
    const automatico = candidatos.length===1 && candidatos[0].auto;
    return { id:l.id,versao:l.updated_date,descricao:l.estabelecimento, data:l.data_lancamento,valor:l.valor,empresa:l.empresa_beneficiada||'',tipo_compra:l.tipo_compra||'',origem_compra:l.origem_compra||'',fatura_id:l.fatura_id,candidatos,
      status: destinos.size>1 ? 'conflito' : ocupado(l) ? 'vinculado' : automatico ? 'automatico' : candidatos.length ? 'revisao' : 'sem_correspondencia',
      vinculos:[...destinos], auditado:trilhas.length>0,
    };
  });
  const aplicados=[]; const erros=[];
  if (acao==='confirmar') {
    if (typeof payload.motivo !== 'string' || payload.motivo.trim().length<10 || payload.motivo.length>500) throw new Error('Descreva a evidência conferida (10 a 500 caracteres).');
    const row=detalhes.find(d=>d.id===payload.lancamento_cartao_id);
    const candidato=row?.candidatos.find(c=>c.tipo===payload.entidade_tipo && c.id===payload.entidade_id);
    if (!candidato || !escopo.includes(candidato.tipo) || payload.versao!==candidato.versao) throw new Error('Candidato desatualizado ou não elegível. Atualize a análise.');
    aplicados.push(await aplicarVinculoCartao(db,row,candidato,userId,true,payload.motivo.trim()));
    row.status='vinculado';
  } else if (acao==='aplicar') {
    for (const row of detalhes.filter(d=>d.status==='automatico' && escopo.includes(d.candidatos[0].tipo))) {
      try { aplicados.push(await aplicarVinculoCartao(db,row,row.candidatos[0],userId,false,'')); row.status='vinculado'; }
      catch(error) { erros.push({ id:row.id,error:error.message }); }
    }
  }
  return { success:erros.length===0, mes, dry_run:acao==='analisar', baixas_automaticas:aplicados.length, sugestoes_criadas:0, aplicados,erros,detalhes,next_cursor:page.next_cursor,has_more:page.has_more,
    resumo:{ avaliados:detalhes.length,automaticos:detalhes.filter(d=>d.status==='automatico').length,revisao:detalhes.filter(d=>d.status==='revisao').length,conflitos:detalhes.filter(d=>d.status==='conflito').length,vinculados:detalhes.filter(d=>d.status==='vinculado').length },
    regra:'Compra por competência; quitação da fatura somente no caixa. Valores e classificações originais preservados.' };
}