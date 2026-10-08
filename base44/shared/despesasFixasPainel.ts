import { lerCompleto } from './conciliacaoLeitura.ts';
import { totaisPrevisoes } from './despesasFixasPrevisao.ts';
export async function painelDespesasFixas(db,body) {
  const {mes,inicio=mes,fim=mes}=body;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes||'')||!/^\d{4}-(0[1-9]|1[0-2])$/.test(inicio||'')||!/^\d{4}-(0[1-9]|1[0-2])$/.test(fim||'')||inicio>fim)throw new Error('Período inválido.');
  if(body.cursor&&String(body.cursor).length>6000)throw new Error('Página inválida.');
  const [contas,meta]=await Promise.all([lerCompleto(db,'CadastroClassificacao',{eixo:'categoria',ativo:true}),db.RegraRecorrente.aggregate({groupBy:['categoria','empresa','tipo_compra','origem_compra'],limit:1000})]);
  if(meta.truncated)throw new Error('Cadastro excede o limite seguro do agrupamento.');
  const porConta=new Map(contas.map(c=>[c.chave,c]));
  const operacional=c=>(c?.naturezas_vinculadas?.length?c.naturezas_vinculadas:[c?.natureza_vinculada]).includes('despesas');
  const grupos=new Map();let total=0,pendentes=0;
  for(const g of meta.rows){const c=porConta.get(g.categoria),incompleto=!operacional(c)||g.tipo_compra!=='despesas'||g.origem_compra!=='empresa'||!['NeuralTec','Liesch'].includes(g.empresa);
    total+=g.count;if(incompleto)pendentes+=g.count;
    if(!grupos.has(g.categoria))grupos.set(g.categoria,{chave:g.categoria,rotulo:c?.rotulo||g.categoria||'Conta não definida',ordem:c?.ordem??9999,count:0});
    grupos.get(g.categoria).count+=g.count;
  }
  const lista=[...grupos.values()].sort((a,b)=>a.ordem-b.ordem||a.rotulo.localeCompare(b.rotulo,'pt-BR'));
  const pos=body.cursor?JSON.parse(body.cursor):{grupo:0};
  if(!Number.isInteger(pos.grupo)||pos.grupo<0||pos.grupo>lista.length)throw new Error('Página inválida.');
  const items=[];let next_cursor=null;
  for(let i=pos.grupo;i<lista.length;i++){
    const page=await db.RegraRecorrente.filter({categoria:lista[i].chave??null},{sort:'nome',limit:50-items.length,cursor:i===pos.grupo?pos.cursor:undefined});
    items.push(...page.items);
    if(page.has_more){next_cursor=JSON.stringify({grupo:i,cursor:page.next_cursor});break;}
    if(items.length===50){if(i+1<lista.length)next_cursor=JSON.stringify({grupo:i+1});break;}
  }
  const ids=items.map(r=>r.id),esc=ids.map(id=>id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const despesas=ids.length?await db.DespesaOperacional.aggregate({query:{recorrente:true,data:{$gte:`${inicio}-01`,$lte:`${fim}-31`},$or:[{regra_recorrente_id:{$in:ids}},{observacoes:{$regex:`Regra recorrente (${esc}) ·`}}]},groupBy:['regra_recorrente_id','observacoes','lancamento_bancario_id','lancamento_cartao_id'],sum:['valor','valor_pago'],limit:1000}):{rows:[]};
  if(despesas.truncated)throw new Error('Histórico excede o limite seguro do período.');
  const realizados={};
  for(const g of despesas.rows){const id=g.regra_recorrente_id||g.observacoes?.match(/Regra recorrente ([^ ]+) ·/)?.[1];if(!ids.includes(id))continue;
    const d=realizados[id]||{valor:0,documentos:0,extrato:false,cartao:false};d.valor+=g.sum_valor||0;d.documentos+=g.count;d.extrato||=Boolean(g.lancamento_bancario_id||g.sum_valor_pago>0);d.cartao||=Boolean(g.lancamento_cartao_id);realizados[id]=d;
  }
  let totais;
  if(!body.cursor){const previsoes=await db.RegraRecorrente.aggregate({query:{is_ativa:true,tipo_compra:'despesas',origem_compra:'empresa',empresa:{$in:['NeuralTec','Liesch']},categoria:{$in:contas.filter(operacional).map(c=>c.chave)}},groupBy:['frequencia','dia_vencimento','mes_inicio','data_inicio'],sum:'valor_esperado',limit:1000});if(previsoes.truncated)throw new Error('Previsões excedem o limite seguro.');totais=totaisPrevisoes(previsoes.rows,Number(mes.slice(0,4)));}
  return {success:true,items:items.map(r=>({...r,revisao_cadastro:!operacional(porConta.get(r.categoria))||r.tipo_compra!=='despesas'||r.origem_compra!=='empresa'||!['NeuralTec','Liesch'].includes(r.empresa),realizado:realizados[r.id]||{valor:0,documentos:0}})),grupos:lista,total,pendentes,totais,next_cursor};
}