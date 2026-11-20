import { nomeCompativel, itemTitulo } from './evidenciaFinanceira.ts';
import { centavos, dias, ehLote, ehPix, nomeNoExtrato, creditoLivre, saldoTitulo, saldoCredito, origemCredito, sobrepoeRelatorio, sugerirParcelasExtrato, padraoCobranca, padraoPix, janelaParcela } from './recebimentosExtrato.ts';

// Painel único de recebimentos: boleto liquidado × parcela em aberto × crédito do extrato.
// Apenas sugere; a baixa continua exigindo confirmação do usuário.
const NEUTRAS = ['transferencia', 'transferencia_interna', 'interno', 'aporte', 'emprestimo', 'aplicacao', 'resgate'];
const arred = v => Math.round(v * 100) / 100;
const maisDias = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const itemSaldo = t => ({ ...itemTitulo(t), saldo: saldoTitulo(t) });
const CREDITOS_ABERTOS = { valor: { $gt: 0 }, status_conciliacao: { $nin: ['conciliado', 'ignorar'] }, categoria: { $nin: NEUTRAS }, alerta_duplicidade: { $ne: true } };
const RELATORIO_PENDENTE = { direcao: 'entrada', tipo: 'boletos_liquidados', estado: 'pendente' };
const resumirCredito = c => ({ id: c.id, data: c.data, valor: c.valor, disponivel: saldoCredito(c), nome: c.descricao });

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
  return (await db.TituloCobranca.filter({ status: { $ne: 'pago' }, cliente: { $regex: busca } }, { limit: 50, sort: 'data_vencimento' })).items.filter(t => saldoTitulo(t) > 0).map(itemSaldo);
}

async function creditosSemVinculo(db, titulos) {
  const consultaPix = { ...CREDITOS_ABERTOS, descricao: { $regex: padraoPix, $options: 'i' } };
  const consultaSicredi = { ...CREDITOS_ABERTOS, descricao: { $regex: padraoCobranca, $options: 'i' }, conta_bancaria: { $regex: 'sicredi|36092\\s*-?\\s*2', $options: 'i' } };
  const [p, s] = await Promise.all([consultaPix, consultaSicredi].map(q => db.LancamentoBancario.filter(q, { limit: 200, sort: '-data' })));
  const creditos = [...new Map([...p.items, ...s.items].map(c => [c.id, c])).values()].filter(c => c.data && creditoLivre(c) && origemCredito(c));
  if (!creditos.length) return { pix: [], cobrancas_extrato: [], total_pix: 0, janela_parcela: janelaParcela };
  const datas = creditos.map(c => c.data).sort();
  const relatorio = await todos(db.EvidenciaFinanceira, { ...RELATORIO_PENDENTE, data: { $gte: maisDias(datas[0], -3), $lte: datas.at(-1) } }, '-data');
  const porDia = new Map();
  for (const ev of relatorio) porDia.set(ev.data, [...(porDia.get(ev.data) || []), ev]);
  const linhas = creditos.map(c => {
    const origem = origemCredito(c);
    const sobreposicao = [0, -1, -2, -3].some(offset => (porDia.get(maisDias(c.data, offset)) || []).some(ev => sobrepoeRelatorio(c, ev)));
    const candidatos = sugerirParcelasExtrato(c, titulos);
    return { ...resumirCredito(c), origem, sobreposicao, titulos: candidatos.slice(0, 8), titulo_id: !sobreposicao && candidatos.length === 1 ? candidatos[0].id : '', ambigua: candidatos.length > 1 };
  });
  const pix = linhas.filter(c => c.origem === 'pix'), cobrancas_extrato = linhas.filter(c => c.origem === 'sicredi');
  return { pix, cobrancas_extrato, total_pix: pix.length, janela_parcela: janelaParcela, pix_tem_mais: p.has_more, sicredi_tem_mais: s.has_more };
}

export async function relatorioSobreposto(db, credito) {
  const relatorio = await todos(db.EvidenciaFinanceira, { ...RELATORIO_PENDENTE, data: { $gte: maisDias(credito.data, -3), $lte: credito.data } }, '-data');
  return relatorio.some(ev => sobrepoeRelatorio(credito, ev));
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
  const extra = arquivoHash ? { pix: [], total_pix: 0 } : await creditosSemVinculo(db, titulos);
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
    const cred = creditos.filter(c => creditoLivre(c) && c.data >= ev.data && dias(c.data, ev.data) <= 3 && centavos(c.disponivel) >= centavos(ev.valor) && ehLote(c));
    const pixPagador = creditos.filter(c => creditoLivre(c) && ehPix(c) && dias(c.data, ev.data) <= 3 && centavos(c.disponivel) === centavos(ev.valor) && nomeNoExtrato(ev.contraparte, c.descricao));
    const motivoCredito = c => ehPix(c) ? 'PIX: valor e nome compatíveis' : centavos(c.disponivel) === centavos(ev.valor) ? 'Saldo igual ao valor do boleto' : centavos(c.disponivel) === centavos(somaDia[ev.data]) ? 'Saldo igual à soma do dia' : 'Lote com saldo suficiente; confira a composição';
    const fortes = [...cred.filter(c => centavos(c.disponivel) === centavos(somaDia[ev.data]) || centavos(c.disponivel) === centavos(ev.valor)), ...pixPagador];
    const sugerido = fortes.length === 1 ? fortes[0] : null;
    const lista = [...new Set([...fortes, ...cred])].slice(0, 8);
    return {
      id: ev.id, tipo: ev.tipo, direcao: ev.direcao, contraparte: ev.contraparte, valor: ev.valor, data: ev.data, vencimento: ev.vencimento, arquivo_nome: ev.arquivo_nome,
      baixado: pago ? { titulo_id: pago.id, credito_id: pago.lancamento_bancario_id, referencia: pago.nosso_numero || pago.seu_numero || '', data_pagamento: pago.data_pagamento } : null,
      titulos: tit.slice(0, 8).map(itemTitulo), titulo_id: tit[0]?.id || '', ambigua: tit.length > 1,
      creditos: lista.map(c => ({ ...resumirCredito(c), motivo: motivoCredito(c) })), credito_id: sugerido?.id || '',
    };
  });
  return { linhas, total, ...extra };
}