import { norm, nomeCompativel } from './evidenciaFinanceira.ts';
import { centavos } from './recebimentosExtrato.ts';
import { listarParaConciliacao as listar } from './recebimentosExatos.ts';

const somar = (rows, key) => rows.reduce((s, r) => s + centavos(r[key]), 0);
const valores = (rows, key) => [...new Set(rows.map(r => r[key]).filter(Boolean))];
const porId = rows => new Map(rows.map(r => [r.id, r]));
const buscar = async (entity, queries) => {
  const rows = [];
  for (let i = 0; i < queries.length; i += 3) rows.push(...(await Promise.all(queries.slice(i,i+3).map(q => listar(entity,q)))).flat());
  return [...porId(rows).values()];
};
const grupos = ['todos','confere','diferenca','duplicidade','sem_par'];
export async function conferenciaBoletos(db, lote, body) {
  const origens = await listar(db.RegistroImportacao, { import_batch_id: lote.id });
  const registros = origens.filter(r => r.entidade_tipo === 'EvidenciaFinanceira' && r.entidade_id);
  const ids = valores(registros, 'entidade_id');
  const lotes = chunks(ids).map(x => ({ id: { $in: x } }));
  const evs = await buscar(db.EvidenciaFinanceira, lotes);
  const datas = [...new Set([...valores(evs, 'vencimento'), ...valores(evs.filter(e => !e.vencimento),'data')])];
  const referencias = valores(evs, 'referencia');
  const notasRef = valores(evs, 'referencia_nota');
  const query = (xs, key) => chunks(xs).map(x => ({ [key]: { $in: x } }));
  const titulos = await buscar(db.TituloCobranca, [...query(datas, 'data_vencimento'), ...query(referencias, 'nosso_numero'), ...query(notasRef, 'seu_numero'), ...query(valores(evs,'entidade_id'), 'id')]);
  const pares = evs.map(e => ({ e, ts: candidatos(e, titulos) }));
  const nfIds = valores(pares.flatMap(x => x.ts), 'nota_fiscal_id');
  const [notas, parcelas] = await Promise.all([buscar(db.NotaFiscal, query(nfIds, 'id')), buscar(db.TituloCobranca, query(nfIds, 'nota_fiscal_id'))]);
  const nf = porId(notas), parcelasPorNota = agrupar(parcelas, 'nota_fiscal_id'), origensPorEv = agrupar(registros, 'entidade_id');
  const porTitulo = agrupar(pares.filter(x => x.ts.length === 1).map(x => ({ id: x.ts[0].id })), 'id');
  const rows = pares.map(({e, ts}) => montar(e, ts, nf, parcelasPorNota, origensPorEv.get(e.id) || [], porTitulo));
  const unicos = pares.filter(x => x.ts.length === 1 && porTitulo.get(x.ts[0].id).length === 1);
  const total = somar(evs, 'valor'), comparavel = somar(unicos.map(x => x.e), 'valor'), receber = somar(unicos.map(x => x.ts[0]), 'valor_titulo');
  const counts = Object.fromEntries(grupos.map(g => [g, rows.filter(r => g === 'todos' || r.grupos.includes(g)).length]));
  const keys = ['order','customer','date','total','status'];
  const key = keys.includes(body.sort) ? body.sort : 'date', dir = body.dir === 'asc' ? 1 : -1;
  const filtered = rows.filter(r => !grupos.includes(body.filtro) || body.filtro === 'todos' || r.grupos.includes(body.filtro)).sort((a,b) => dir * (key === 'total' ? a.total - b.total : String(a[key]).localeCompare(String(b[key]), 'pt-BR', { numeric:true })) || a.id.localeCompare(b.id));
  if (body.exportar === true) {
    const selected = Array.isArray(body.ids) ? new Set(body.ids.slice(0,10000)) : null;
    const items = selected ? filtered.filter(r => selected.has(r.id)) : filtered;
    return { quantidade: items.length, csv: ['Referência;Pagador;Liquidação;Valor liquidado;Situação;Achados', ...items.map(r => [r.order,r.customer,r.date,(r.total/100).toFixed(2).replace('.',','),r.status,r.achados.join(' | ')].map(csv).join(';'))].join('\r\n') };
  }
  const page = Math.min(Math.max(1, Math.ceil(filtered.length/8)), Math.max(1, Math.floor(Number(body.pagina) || 1)));
  return { rows: filtered.slice((page-1)*8,page*8), page, count: filtered.length, counts, total, comparavel, receber, repetidos: registros.filter(r => r.resultado_importacao === 'ignorado').length, semLeitura: Math.max(0, (lote.total_records || 0) - registros.length) + ids.length - evs.length };
}

const chunks = xs => Array.from({length:Math.ceil(xs.length/100)},(_,i)=>xs.slice(i*100,i*100+100));
const agrupar = (xs,k) => { const m = new Map(); for (const x of xs) { if (!m.has(x[k])) m.set(x[k], []); m.get(x[k]).push(x); } return m; };
const moeda = cents => (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const csv = v => { const s = String(v ?? ''); return `"${(/^[\s]*[=+@-]|^[\t\r\n]/.test(s) ? "'"+s : s).replace(/"/g,'""')}"`; };
function candidatos(e, ts) {
  if (e.estado === 'confirmada' && e.entidade_id) return ts.filter(t => t.id === e.entidade_id);
  const empresa = e.chave.split('|')[0];
  const comp = ts.filter(t => (!t.empresa || !['NeuralTec','Liesch'].includes(empresa) || t.empresa === empresa) && nomeCompativel(t.cliente,e.contraparte));
  const boleto = comp.filter(t => e.referencia && norm(t.nosso_numero) === norm(e.referencia));
  if (boleto.length) return boleto;
  const ref = comp.filter(t => e.referencia_nota && norm(t.seu_numero) === norm(e.referencia_nota));
  const base = ref.length ? ref : comp;
  const dia = base.filter(t => t.data_vencimento === (e.vencimento || e.data));
  return dia.length ? dia : ref;
}
const resumir = t => ({id:t.id, referencia:t.nosso_numero, nota:t.seu_numero, data:t.data_vencimento, valor:t.valor_titulo, pago:t.valor_pago, status:t.status});
function montar(e, ts, nf, parcelas, origens, porTitulo) {
  const achados = [], grupos = new Set();
  const add = (g, texto) => { grupos.add(g); achados.push(texto); };
  if (origens.length > 1) add('duplicidade', `${origens.length} linhas do lote apontam para o mesmo boleto; valor contado uma vez.`);
  if (!ts.length) add('sem_par', 'Nenhuma parcela identificada por pagador e referência ou vencimento.');
  if (ts.length > 1) add('duplicidade', `${ts.length} parcelas candidatas; possível duplicidade ou correspondência ambígua.`);
  if (ts.length === 1) {
    const [t] = ts, n = nf.get(t.nota_fiscal_id), ps = parcelas.get(t.nota_fiscal_id) || [];
    if (porTitulo.get(t.id).length > 1) add('duplicidade','Mais de um boleto deste lote aponta para a mesma parcela.');
    if (centavos(t.valor_titulo) !== centavos(e.valor)) add('diferenca', `Relatório ${moeda(centavos(e.valor))} × parcela original ${moeda(centavos(t.valor_titulo))}. Confira juros, descontos ou pagamentos parciais.`);
    if (!n) add('diferenca','Parcela sem nota vinculada encontrada.');
    else if (centavos(n.valor_total) !== somar(ps,'valor_titulo')) add('diferenca', `${t.seu_numero || n.numero}: total da nota ${moeda(centavos(n.valor_total))} × ${ps.length} parcelas vinculadas somando ${moeda(somar(ps,'valor_titulo'))}.`);
    const chaves = ps.map(p => [norm(p.cliente), p.data_vencimento, centavos(p.valor_titulo)].join('|'));
    if (new Set(chaves).size < chaves.length) add('duplicidade','Há parcelas da nota com mesmo cliente, vencimento e valor.');
    if (n && ps.some(p => p.data_vencimento && n.data_emissao && p.data_vencimento < n.data_emissao)) add('diferenca','Há parcelas vinculadas com vencimento anterior à emissão da nota.');
  }
  if (!grupos.size) grupos.add('confere');
  return {id:e.id, order:e.referencia || e.referencia_nota || (ts.length === 1 ? ts[0].seu_numero || ts[0].nosso_numero : 'Sem referência'), customer:e.contraparte, date:e.data, total:centavos(e.valor), grupos:[...grupos], status:[...grupos].map(g=>({confere:'Confere',diferenca:'Diferença',duplicidade:'Possível duplicata',sem_par:'Sem parcela'}[g])).join(' · '), achados, estado:e.estado, parcelas:ts.slice(0,20).map(resumir), vinculadas:ts.length === 1 ? (parcelas.get(ts[0].nota_fiscal_id) || []).filter(p => p.id !== ts[0].id).slice(0,30).map(resumir) : []};
}