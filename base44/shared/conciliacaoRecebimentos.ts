import { nomeCompativel, itemTitulo } from './evidenciaFinanceira.ts';

// Painel único de recebimentos: boleto liquidado × parcela em aberto × crédito do extrato.
// Apenas sugere; a baixa continua exigindo confirmação do usuário.
const NEUTRAS = ['transferencia', 'transferencia_interna', 'interno', 'aporte', 'emprestimo', 'aplicacao', 'resgate'];
const arred = v => Math.round(v * 100) / 100;
const maisDias = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dias = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
const ehLote = c => /LIQ\.?\s*COBRAN/i.test(c.descricao || '');

async function todos(entidade, query, sort) {
  const out = []; let cursor;
  do {
    const p = await entidade.filter(query, { limit: 500, sort, ...(cursor ? { cursor } : {}) });
    out.push(...p.items); cursor = p.has_more ? p.next_cursor : null;
  } while (cursor && out.length < 5000);
  return out;
}

export async function painelRecebimentos(db, arquivoHash) {
  const query = { direcao: 'entrada', tipo: 'boletos_liquidados', estado: 'pendente', ...(arquivoHash ? { arquivo_hash: arquivoHash } : {}) };
  const [pagina, total] = await Promise.all([db.EvidenciaFinanceira.filter(query, { limit: 200, sort: '-data' }), db.EvidenciaFinanceira.count(query)]);
  const evs = pagina.items.filter(e => e.data);
  if (!evs.length) return { linhas: [], total };
  const datas = evs.map(e => e.data).sort();
  const [titulos, bancos] = await Promise.all([
    todos(db.TituloCobranca, { status: { $ne: 'pago' } }, 'data_vencimento'),
    todos(db.LancamentoBancario, { valor: { $gt: 0 }, data: { $gte: datas[0], $lte: maisDias(datas.at(-1), 3) }, status_conciliacao: { $nin: ['conciliado', 'ignorar'] }, categoria: { $nin: NEUTRAS } }, 'data'),
  ]);
  const creditos = bancos.map(c => ({ ...c, disponivel: arred(c.valor - (c.valor_conciliado || 0)) }));
  const somaDia = {};
  for (const e of evs) somaDia[e.data] = arred((somaDia[e.data] || 0) + e.valor);

  const linhas = evs.map(ev => {
    const base = ev.vencimento || ev.data;
    const tit = titulos.filter(t => Math.abs(Number(t.valor_titulo || 0) - ev.valor) <= 0.01 && nomeCompativel(t.cliente, ev.contraparte))
      .sort((a, b) => dias(a.data_vencimento, base) - dias(b.data_vencimento, base));
    const cred = creditos.filter(c => c.data >= ev.data && c.data <= maisDias(ev.data, 3) && c.disponivel >= ev.valor - 0.01);
    const sugerido = cred.find(c => ehLote(c) && Math.abs(c.disponivel - somaDia[ev.data]) <= 0.01)
      || cred.find(c => Math.abs(c.valor - ev.valor) <= 0.01)
      || cred.find(c => ehLote(c) && c.data > ev.data)
      || cred.find(ehLote);
    const lista = cred.slice(0, 8);
    if (sugerido && !lista.includes(sugerido)) lista.push(sugerido);
    return {
      id: ev.id, tipo: ev.tipo, direcao: ev.direcao, contraparte: ev.contraparte, valor: ev.valor, data: ev.data, vencimento: ev.vencimento, arquivo_nome: ev.arquivo_nome,
      titulos: tit.slice(0, 8).map(itemTitulo), titulo_id: tit[0]?.id || '', ambigua: tit.length > 1,
      creditos: lista.map(c => ({ id: c.id, data: c.data, valor: c.valor, disponivel: c.disponivel, nome: c.descricao })), credito_id: sugerido?.id || '',
    };
  });
  return { linhas, total };
}