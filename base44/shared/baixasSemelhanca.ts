import { consultarListaBaixas } from './baixasConsulta.ts';
import { normalizarBaixa } from './baixasContrato.ts';
import { normConciliacao,lerCompleto } from './conciliacaoLeitura.ts';
import { evidenciasCartao } from './conciliacaoCartaoRegras.ts';
export function pontuarBaixa(mov,candidato,evidencias=[]) {
  const m=mov,c=candidato,razoes=[],bloqueios=[];let pontos=0;
  const referencia=m.tipo==='LancamentoCartao'?(c.raw.data_emissao||c.raw.data):c.data;
  const diff=Math.abs(m.saldo-c.saldo),dias=Math.abs(Date.parse(m.data)-Date.parse(referencia))/86400000;
  if(diff<0.01){pontos+=45;razoes.push('Valor e saldo coincidem em centavos');}else if(c.saldo>m.saldo){pontos+=15;razoes.push('Possível pagamento parcial');}else razoes.push('Valores diferentes: confira a alocação');
  if(dias<=3){pontos+=15;razoes.push('Datas próximas: até três dias');}else if(Number.isFinite(dias))razoes.push(`Intervalo de ${Math.round(dias)} dias`);
  const termos=normConciliacao(c.contraparte||c.descricao).split(' ').filter(x=>x.length>3),texto=normConciliacao(`${m.descricao} ${m.raw.detalhe||''}`);
  if(termos.some(t=>texto.split(' ').includes(t))){pontos+=20;razoes.push('Termo de contraparte/descrição coincide');}
  if(m.empresa&&c.empresa){if(m.empresa===c.empresa){pontos+=10;razoes.push('Empresa coincide');}else bloqueios.push('Empresas diferentes');}else razoes.push('Empresa incompleta: exige conferência');
  if(m.raw.tipo_compra&&c.raw.tipo_compra){if(m.raw.tipo_compra===c.raw.tipo_compra){pontos+=10;razoes.push('Natureza econômica coincide');}else bloqueios.push('Naturezas econômicas conflitantes');}
  const ev=evidencias.filter(e=>e.entidade_tipo===c.tipo&&e.entidade_id===c.id);
  if(ev.length)razoes.push(`${ev.length} evidência(s) documental(is) vinculada(s)`);
  if(c.saldo<=0||c.raw.lancamento_cartao_id)bloqueios.push('Obrigação paga ou reconhecida no cartão');
  if(m.estado==='bloqueado')bloqueios.push('Movimento ignorado ou com suspeita de duplicidade');
  if(m.tipo==='LancamentoCartao'){const e=evidenciasCartao(m.raw,c.raw,c.tipo,true);if(!e.elegivel)bloqueios.push(...e.motivos,'Regras do cartão não permitem este vínculo');}
  return {...c,pontos,razoes,bloqueios:[...new Set(bloqueios)]};
}
export async function candidatosBaixas(base44,user,b) {
  if(!['LancamentoBancario','LancamentoCartao'].includes(b.tipo)||!['ItemCompra','DespesaOperacional','Tributo','FolhaPagamento','FaturaCartao','ObraReforma'].includes(b.destino))throw new Error('Escolha um movimento e um módulo de destino.');
  if(b.tipo==='LancamentoCartao'&&!['ItemCompra','DespesaOperacional','ObraReforma'].includes(b.destino))return {items:[],has_more:false};
  const r=await base44.entities[b.tipo].get(b.id),mov=normalizarBaixa(b.tipo,r);
  if(b.tipo==='LancamentoBancario'){const a=await base44.entities.VinculoExtrato.aggregate({query:{lancamento_bancario_id:b.id},sum:'valor_alocado'});mov.saldo=Math.max(0,mov.total-Number(a.rows[0]?.sum_valor_alocado||0));}
  const page=await consultarListaBaixas(base44.entities,{tipo:b.destino,busca:b.busca,cursor:b.cursor,estado:'pendente'});
  const ev=user.role==='admin'?await lerCompleto(base44.entities,'EvidenciaFinanceira',{direcao:'saida',...(b.tipo==='LancamentoBancario'?{lancamento_bancario_id:b.id}:{entidade_tipo:b.destino,entidade_id:{$in:page.items.map(x=>x.id)}})}):[];
  const ordenados=page.items.map(c=>pontuarBaixa(mov,c,ev)).sort((a,b)=>a.bloqueios.length-b.bloqueios.length||b.pontos-a.pontos);
  const elegiveis=ordenados.filter(c=>!c.bloqueios.length);const ambiguo=elegiveis.length>1&&Math.abs(elegiveis[0].pontos-elegiveis[1].pontos)<=5;
  return {...page,items:ordenados.map(c=>({...c,ambiguo:ambiguo&&!c.bloqueios.length&&c.pontos>=elegiveis[0].pontos-5})),aviso:'Ordem por semelhança nesta página; não é confirmação de pagamento. Outros candidatos podem existir nas próximas páginas.'};
}