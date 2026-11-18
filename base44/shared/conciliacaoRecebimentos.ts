import { nomeCompativel, itemTitulo, norm } from './evidenciaFinanceira.ts';

// Painel único de recebimentos: boleto liquidado × parcela em aberto × crédito do extrato.
// Apenas sugere; a baixa continua exigindo confirmação do usuário.
const NEUTRAS = ['transferencia', 'transferencia_interna', 'interno', 'aporte', 'emprestimo', 'aplicacao', 'resgate'];
const arred = v => Math.round(v * 100) / 100;
const maisDias = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dias = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
const ehLote = c => /LIQ\.?\s*COBRAN/i.test(c.descricao || '');
const ehPix = c => /PIX/i.test(c.descricao || '');
const saldoTitulo = t => arred(Number(t.valor_titulo || 0) - Number(t.valor_pago || 0));
const itemSaldo = t => ({ ...itemTitulo(t), saldo: saldoTitulo(t) });
// O extrato traz o nome do pagador truncado: basta uma palavra do cliente (4+ letras) na descrição.
const nomeNoExtrato = (cliente, descricao) => { const d = norm(descricao); return String(cliente || '').split(/[^\p{L}\p{N}]+/u).map(norm).filter(p => p.length >= 4).some(p => d.includes(p)); };

async function todos(entidade, query, sort) {
  const out = []; let cursor;
  do {
    const p = await entidade.filter(query, { limit: 500, sort, ...(cursor ? { cursor } : {}) });
    out.push(...p.items); cursor = p.has_more ? p.next_cursor : null;
  } while (cursor && out.length < 5000);
  return out;
}

// Parcelas em aberto pelo nome do cliente (baixa manual de boleto ou de PIX).
export async function titulosAbertos(db, termo) {
  const busca = String(termo || '').trim().toUpperCase().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (busca.length < 3) return [];
  return (await db.TituloCobranca.filter({ status: { $ne: 'pago' }, cliente: { $regex: busca } }, { limit: 50, sort: 'data_vencimento' })).items.map(itemSaldo);
}

// PIX recebidos direto na conta, sem boleto liquidado: sugere a parcela em aberto de mesmo saldo.
async function pixSemBoleto(db, titulos) {
  const query = { valor: { $gt: 0 }, descricao: { $regex: 'PIX', $options: 'i' }, status_conciliacao: { $nin: ['conciliado', 'ignorar'] }, categoria: { $nin: NEUTRAS } };
  const [pagina, total_pix] = await Promise.all([db.LancamentoBancario.filter(query, { limit: 200, sort: '-data' }), db.LancamentoBancario.count(query)]);
  const pix = pagina.items.map(c => {
    const disponivel = arred(c.valor - (c.valor_conciliado || 0));
    const tit = titulos.filter(t => Math.abs(saldoTitulo(t) - disponivel) <= 0.01).map(t => ({ t, nome: nomeNoExtrato(t.cliente, c.descricao) })).sort((a, b) => b.nome - a.nome);
    return { id: c.id, data: c.data, valor: c.valor, disponivel, nome: c.descricao, titulos: tit.slice(0, 8).map(x => itemSaldo(x.t)), titulo_id: tit[0]?.nome ? tit[0].t.id : '', ambigua: tit.length > 1 };
  }).filter(c => c.disponivel > 0.01);
  return { pix, total_pix };
}

// Baixa manual: qualquer parcela em aberto do cliente buscado e todos os créditos livres do período.
export async function opcoesManuais(db, ev, termo) {
  const [titulos, bancos] = await Promise.all([
    titulosAbertos(db, termo),
    db.LancamentoBancario.filter({ valor: { $gt: 0 }, data: { $gte: maisDias(ev.data, -5), $lte: maisDias(ev.data, 15) }, status_conciliacao: { $nin: ['conciliado', 'ignorar'] }, categoria: { $nin: NEUTRAS } }, { limit: 200, sort: 'data' }).then(p => p.items),
  ]);
  return {
    titulos,
    creditos: bancos.map(c => ({ id: c.id, data: c.data, valor: c.valor, disponivel: arred(c.valor - (c.valor_conciliado || 0)), nome: c.descricao })).filter(c => c.disponivel > 0.01),
  };
}

export async function painelRecebimentos(db, arquivoHash) {
  const query = { direcao: 'entrada', tipo: 'boletos_liquidados', estado: 'pendente', ...(arquivoHash ? { arquivo_hash: arquivoHash } : {}) };
  const [pagina, total] = await Promise.all([db.EvidenciaFinanceira.filter(query, { limit: 200, sort: '-data' }), db.EvidenciaFinanceira.count(query)]);
  const evs = pagina.items.filter(e => e.data);
  const titulos = await todos(db.TituloCobranca, { status: { $ne: 'pago' } }, 'data_vencimento');
  const extra = arquivoHash ? { pix: [], total_pix: 0 } : await pixSemBoleto(db, titulos);
  if (!evs.length) return { linhas: [], total, ...extra };
  const datas = evs.map(e => e.data).sort();
  const bancos = await todos(db.LancamentoBancario, { valor: { $gt: 0 }, data: { $gte: maisDias(datas[0], -3), $lte: maisDias(datas.at(-1), 3) }, status_conciliacao: { $nin: ['conciliado', 'ignorar'] }, categoria: { $nin: NEUTRAS } }, 'data');
  const creditos = bancos.map(c => ({ ...c, disponivel: arred(c.valor - (c.valor_conciliado || 0)) }));
  const somaDia = {};
  for (const e of evs) somaDia[e.data] = arred((somaDia[e.data] || 0) + e.valor);

  // Parcelas já baixadas por outro caminho (ou em tentativa anterior): o boleto só precisa ser concluído.
  const pagos = (await todos(db.TituloCobranca, { status: 'pago', data_pagamento: { $gte: maisDias(datas[0], -5), $lte: maisDias(datas.at(-1), 5) } }, 'data_pagamento')).filter(t => t.lancamento_bancario_id);
  const jaConferidos = pagos.length ? new Set((await todos(db.EvidenciaFinanceira, { estado: 'confirmada', tipo: 'boletos_liquidados', entidade_id: { $in: pagos.map(t => t.id) } }, 'data')).map(e => e.entidade_id)) : new Set();

  const linhas = evs.map(ev => {
    const base = ev.vencimento || ev.data;
    const pago = pagos.find(t => !jaConferidos.has(t.id) && Math.abs(Number(t.valor_titulo || 0) - ev.valor) <= 0.01 && nomeCompativel(t.cliente, ev.contraparte) && dias(t.data_pagamento, ev.data) <= 5);
    if (pago) jaConferidos.add(pago.id);
    const tit = pago ? [] : titulos.filter(t => Math.abs(Number(t.valor_titulo || 0) - ev.valor) <= 0.01 && nomeCompativel(t.cliente, ev.contraparte))
      .sort((a, b) => dias(a.data_vencimento, base) - dias(b.data_vencimento, base));
    const cred = creditos.filter(c => c.data >= ev.data && c.data <= maisDias(ev.data, 3) && c.disponivel >= ev.valor - 0.01);
    const sugerido = cred.find(c => ehLote(c) && Math.abs(c.disponivel - somaDia[ev.data]) <= 0.01)
      || cred.find(c => Math.abs(c.valor - ev.valor) <= 0.01)
      || cred.find(c => ehLote(c) && c.data > ev.data)
      || cred.find(ehLote);
    // PIX do mesmo pagador (até 3 dias antes ou depois) entram como opção de crédito.
    const pixPagador = creditos.filter(c => ehPix(c) && dias(c.data, ev.data) <= 3 && c.disponivel >= ev.valor - 0.01 && nomeNoExtrato(ev.contraparte, c.descricao));
    const lista = [...new Set([...pixPagador, ...cred.slice(0, 8), ...(sugerido ? [sugerido] : [])])];
    return {
      id: ev.id, tipo: ev.tipo, direcao: ev.direcao, contraparte: ev.contraparte, valor: ev.valor, data: ev.data, vencimento: ev.vencimento, arquivo_nome: ev.arquivo_nome,
      baixado: pago ? { titulo_id: pago.id, credito_id: pago.lancamento_bancario_id, referencia: pago.nosso_numero || pago.seu_numero || '', data_pagamento: pago.data_pagamento } : null,
      titulos: tit.slice(0, 8).map(itemTitulo), titulo_id: tit[0]?.id || '', ambigua: tit.length > 1,
      creditos: lista.map(c => ({ id: c.id, data: c.data, valor: c.valor, disponivel: c.disponivel, nome: c.descricao })), credito_id: sugerido?.id || '',
    };
  });
  return { linhas, total, ...extra };
}