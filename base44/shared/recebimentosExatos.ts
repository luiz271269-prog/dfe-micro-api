import { centavos, creditoLivre, dias, ehLote, nomeNoExtrato, origemCredito, saldoCredito, saldoTitulo, janelaParcela } from './recebimentosExtrato.ts';
import { norm, nomeCompativel } from './evidenciaFinanceira.ts';

export const TITULO_ABERTO = ['em_aberto', 'vencido'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const creditoIntegral = c => DATA.test(c.data || '') && creditoLivre(c) && !c.vinculos_count && centavos(c.valor) === centavos(saldoCredito(c));
export const parcelaIntegral = t => TITULO_ABERTO.includes(t.status) && !t.data_pagamento && !t.lancamento_bancario_id && centavos(t.valor_pago) === 0;
const diasBoleto = (c, e) => dias(c.data, e.data) <= 3 && (!ehLote(c) || c.data >= e.data);
const identificaBoleto = (t, e) => nomeCompativel(t.cliente, e.contraparte) && (!e.referencia_nota || norm(t.seu_numero) === norm(e.referencia_nota));
const referenciaBoleto = (t, e) => !!norm(e.referencia) && norm(t.nosso_numero) === norm(e.referencia);
const palavras = s => String(s || '').split(/[^\p{L}\p{N}]+/u).map(norm).filter(Boolean).join(' ');
const pagadorIdentificado = (t, c) => {
  const nome = palavras(t.cliente).replace(/(?: (?:LTDA|SA|S A|ME|EPP))+$/, '');
  return nome.length >= 5 && ` ${palavras(c.descricao)} `.includes(` ${nome} `);
};
export const notaAceitaRecebimentoExato = (n, t, c, jaRecebido = n.valor_recebido) => n.status !== 'anulada' && !n.is_espelho_ci && (!n.empresa || !t.empresa || n.empresa === t.empresa) && centavos(jaRecebido) + centavos(c.valor) <= centavos(n.valor_total);
const agrupar = (items, key) => { const mapa = new Map(); for (const item of items) { const k = key(item); if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(item); } return mapa; };

// Grafo construído antes de qualquer baixa: unicidade nos dois sentidos, sem desempate por ordem.
export function planejarRecebimentos(creditos, titulos, evidencias) {
  const porSaldo = agrupar(titulos, t => centavos(saldoTitulo(t)));
  const porDia = agrupar(evidencias, e => e.data);
  const pares = [], concorrenciaTitulos = new Map(), concorrenciaEvidencias = new Map();
  for (const c of creditos) {
    if (!creditoIntegral(c)) continue;
    const valor = centavos(c.valor), origem = origemCredito(c);
    const data = Date.parse(c.data);
    if (!Number.isFinite(data)) continue;
    const relatorio = [-3,-2,-1,0,1,2,3].flatMap(d => porDia.get(new Date(data + d * 86400000).toISOString().slice(0, 10)) || [])
      .filter(e => diasBoleto(c, e) && (ehLote(c) ? centavos(e.valor) <= valor : centavos(e.valor) === valor && nomeNoExtrato(e.contraparte, c.descricao)));
    for (const e of relatorio) concorrenciaEvidencias.set(e.id, (concorrenciaEvidencias.get(e.id) || 0) + 1);
    const candidatos = (porSaldo.get(valor) || []).filter(t => dias(c.data, t.data_vencimento) <= janelaParcela && (origem !== 'sicredi' || t.canal_cobranca?.toLowerCase() === 'sicredi'));
    for (const t of candidatos) concorrenciaTitulos.set(t.id, (concorrenciaTitulos.get(t.id) || 0) + 1);
    if (candidatos.length !== 1 || relatorio.length > 1 || (ehLote(c) && origem !== 'sicredi')) continue;
    const t = candidatos[0], e = relatorio[0];
    if (!parcelaIntegral(t)) continue;
    if (e) {
      if (centavos(e.valor) !== valor || !identificaBoleto(t, e) || (!ehLote(c) && !pagadorIdentificado(t, c)) || !(referenciaBoleto(t, e) || (e.vencimento && t.data_vencimento === e.vencimento))) continue;
    } else if (ehLote(c) || !pagadorIdentificado(t, c) || (origem !== 'pix' && (c.categoria !== 'recebimento' || c.data !== (t.data_pagamento_informada || t.data_vencimento)))) continue;
    pares.push({ c, t, e });
  }
  return pares.filter(({ t, e }) => concorrenciaTitulos.get(t.id) === 1 && (!e || concorrenciaEvidencias.get(e.id) === 1));
}

export async function listarParaConciliacao(entidade, query) {
  const rows = []; let cursor;
  do {
    const p = await entidade.filter(query, { sort: 'id', limit: 500, ...(cursor ? { cursor } : {}) });
    rows.push(...p.items);
    if (!p.has_more) return rows;
    if (!p.next_cursor || p.next_cursor === cursor || rows.length >= 10000) throw new Error('Consulta incompleta: nenhuma baixa automática executada.');
    cursor = p.next_cursor;
  } while (cursor);
  return rows;
}

export async function carregarRecebimentosExatos(db, data = '') {
  const janela = (campo, n) => data ? { [campo]: { $gte: new Date(Date.parse(data) - n * 86400000).toISOString().slice(0,10), $lte: new Date(Date.parse(data) + n * 86400000).toISOString().slice(0,10) } } : {};
  const [creditos, titulos, evidencias] = await Promise.all([
    listarParaConciliacao(db.LancamentoBancario, { valor: { $gt: 0 }, status_conciliacao: { $nin: ['conciliado','ignorar','parcial'] }, alerta_duplicidade: { $ne: true }, categoria: { $nin: ['transferencia','transferencia_interna','interno','aporte','emprestimo','aplicacao','resgate'] }, ...janela('data', 14) }),
    listarParaConciliacao(db.TituloCobranca, { status: { $in: TITULO_ABERTO }, ...janela('data_vencimento', 7) }),
    listarParaConciliacao(db.EvidenciaFinanceira, { tipo: 'boletos_liquidados', direcao: 'entrada', estado: 'pendente', ...janela('data', 17) }),
  ]);
  return { creditos, titulos, pares: planejarRecebimentos(creditos, titulos, evidencias) };
}