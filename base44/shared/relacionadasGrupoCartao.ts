import { carregarGrupoCartao, estabelecimentoChave, estabelecimentoGenerico, parcelaDe, assinaturaClassificacao, CAMPOS_GRUPO_CARTAO } from './grupoCartaoRevisao.ts';

export const ESCOPOS_RELACIONADAS = ['parcelas', 'mesmo_mes', 'outros_meses'];
export const LIMITE_RELACIONADAS = 100;
const TOLERANCIA_PARCELA = 0.1;

// Meses entre duas referências YYYY-MM: a parcela seguinte da mesma compra cai na fatura do mês seguinte.
const mesesEntre = (mes, base) => (Number(String(mes).slice(0, 4)) - Number(String(base).slice(0, 4))) * 12 + Number(String(mes).slice(5, 7)) - Number(String(base).slice(5, 7));

// A mesma compra pode vir abreviada ou com código extra em outra importação (ex.: "ANUIDADE MASTERCARD" e "ANUIDADE MASTERCARD (1992)").
const nomeCompativel = (a, b) => { const x = a.split(' '), y = b.split(' '); return !!a && !!b && x.slice(0, y.length).every((p, i) => p.startsWith(y[i]) || y[i].startsWith(p)); };

// Variação do nome do mesmo estabelecimento entre importações (ex.: "BASE44V", "BASE44", "BASE44E NEW YORK", "BASE44V WWW.BASE44.CO"):
// um dos dois nomes é uma palavra só e a primeira palavra do outro é igual ou difere apenas na última letra. Palavras de ramo ficam de fora.
const RAMO = /^(restaurante|supermercado|farmacia|drogaria|padaria|mercado|lanchonete|pizzaria|churrascaria|hotel|pousada|estacionamento|pedagio|livraria|academia|clinica|hospital|laboratorio|transporte|comercio|comercial|distribuidora|atacado|magazine|pagamento|anuidade|seguro|tarifa)\w?$/;
const variacaoDoNome = (a, b) => {
  const x = a.split(' '), y = b.split(' ');
  if (a === b || (x.length > 1 && y.length > 1) || RAMO.test(x[0]) || RAMO.test(y[0])) return false;
  let n = 0; while (n < x[0].length && n < y[0].length && x[0][n] === y[0][n]) n++;
  return n >= 6 && x[0].length - n <= 1 && y[0].length - n <= 1;
};

// Outras compras ligadas ao grupo: parcelas da mesma compra e demais compras do mesmo estabelecimento, no mês e fora dele.
export async function carregarRelacionadas(db, grupo, registros) {
  const chave = estabelecimentoChave(grupo.estabelecimento);
  const parcelasGrupo = registros.map(r => ({ parcela: parcelaDe({ estabelecimento: grupo.estabelecimento, observacao: r.observacao }), valor: Number(r.valor || 0) })).filter(x => x.parcela);
  const resultado = { generico: estabelecimentoGenerico(chave), parcela: parcelasGrupo[0]?.parcela || null, variacoes: [], escopos: { parcelas: [], mesmo_mes: [], outros_meses: [] } };
  const palavras = chave.split(' ').filter(Boolean);
  if (!palavras.length) return resultado;
  const compras = { valor: { $gt: 0 }, observacao: { $not: { $regex: 'Não faz parte', $options: 'i' } } };
  const opcoes = { limit: 1000, fields: ['fatura_id', 'estabelecimento', ...CAMPOS_GRUPO_CARTAO] };
  const excesso = 'Há compras demais com este nome para analisar em conjunto. Classifique este estabelecimento mês a mês.';
  // Busca ampla no servidor (tolera acentos); a igualdade exata do estabelecimento é conferida abaixo.
  const padrao = palavras.map(p => p.replace(/[aeioucn]/g, '.')).join('.*');
  const [pagina, faturas] = await Promise.all([
    db.LancamentoCartao.filter({ ...compras, estabelecimento: { $regex: padrao, $options: 'i' } }, opcoes),
    db.FaturaCartao.list({ limit: 1000, fields: ['mes_referencia', 'conta_cartao_id'] }),
  ]);
  if (pagina.has_more || faturas.has_more) throw new Error(excesso);
  const fatMap = new Map(faturas.items.map(f => [f.id, f]));
  const fatGrupo = fatMap.get(grupo.fatura_id);
  if (!fatGrupo) return resultado;
  const proprios = new Set(registros.map(r => r.id));
  const distancia = f => mesesEntre(f.mes_referencia, fatGrupo.mes_referencia);
  const anotar = l => ({ ...l, mes: fatMap.get(l.fatura_id).mes_referencia, conta_cartao_id: fatMap.get(l.fatura_id).conta_cartao_id });

  // Parcelas da mesma compra: mesmo cartão, mesmo valor e a posição esperada na fatura de cada mês, mesmo sem a parcela escrita.
  const naJanela = (g, f) => { const n = g.parcela.numero + distancia(f); return n >= 1 && n <= g.parcela.total && n !== g.parcela.numero; };
  const janela = faturas.items.filter(f => f.conta_cartao_id === fatGrupo.conta_cartao_id && parcelasGrupo.some(g => naJanela(g, f)));
  if (janela.length) {
    const valores = [...new Set(parcelasGrupo.map(g => g.valor))];
    const candidatas = await db.LancamentoCartao.filter({ ...compras, fatura_id: { $in: janela.map(f => f.id) }, $or: valores.map(v => ({ valor: { $gte: v - TOLERANCIA_PARCELA, $lte: v + TOLERANCIA_PARCELA } })) }, opcoes);
    if (candidatas.has_more) throw new Error(excesso);
    resultado.escopos.parcelas = candidatas.items.filter(l => {
      const fat = fatMap.get(l.fatura_id), parcela = parcelaDe(l);
      return !proprios.has(l.id) && nomeCompativel(chave, estabelecimentoChave(l.estabelecimento)) && parcelasGrupo.some(g => naJanela(g, fat) && Math.abs(g.valor - Number(l.valor || 0)) <= TOLERANCIA_PARCELA && (!parcela || (parcela.total === g.parcela.total && parcela.numero === g.parcela.numero + distancia(fat))));
    }).map(anotar);
  }

  // Demais compras do mesmo estabelecimento, separadas entre o mês em revisão e os outros meses.
  const idsParcelas = new Set(resultado.escopos.parcelas.map(l => l.id));
  const incluidos = new Set();
  const incluir = (l) => {
    const fat = fatMap.get(l.fatura_id);
    if (!fat || proprios.has(l.id) || idsParcelas.has(l.id) || incluidos.has(l.id)) return false;
    incluidos.add(l.id);
    resultado.escopos[fat.mes_referencia === fatGrupo.mes_referencia ? 'mesmo_mes' : 'outros_meses'].push(anotar(l));
    return true;
  };
  for (const l of pagina.items) if (estabelecimentoChave(l.estabelecimento) === chave) incluir(l);

  // Mesmo estabelecimento escrito de outra forma em outra fatura: entra junto, e os nomes são informados na tela.
  const raiz = palavras[0].slice(0, 6);
  if (!resultado.generico && raiz.length === 6 && !RAMO.test(palavras[0])) {
    const parecidos = await db.LancamentoCartao.filter({ ...compras, estabelecimento: { $regex: `^[^a-z0-9]*${raiz.replace(/[aeioucn]/g, '.')}`, $options: 'i' } }, opcoes);
    const nomes = new Set();
    if (!parecidos.has_more) for (const l of parecidos.items) {
      const outra = estabelecimentoChave(l.estabelecimento);
      if (variacaoDoNome(chave, outra) && !estabelecimentoGenerico(outra) && incluir(l)) nomes.add(l.estabelecimento);
    }
    resultado.variacoes = [...nomes].sort();
  }
  return resultado;
}

// Resumo somente leitura para a tela decidir onde aplicar a mesma classificação.
export async function analisarRelacionadas(db, grupo) {
  const registros = await carregarGrupoCartao(db, grupo);
  const [analise, cards] = await Promise.all([carregarRelacionadas(db, grupo, registros), db.ContaCartao.list({ limit: 100, fields: ['nome'] })]);
  const nomes = new Map(cards.items.map(c => [c.id, c.nome]));
  const escopos = Object.fromEntries(ESCOPOS_RELACIONADAS.map(escopo => {
    const itens = analise.escopos[escopo];
    return [escopo, { quantidade: itens.length, valor: itens.reduce((s, l) => s + Number(l.valor || 0), 0), meses: [...new Set(itens.map(l => l.mes))].sort(), cartoes: [...new Set(itens.map(l => nomes.get(l.conta_cartao_id) || l.conta_cartao_id || 'Cartão não identificado'))].sort(), classificacoes: new Set(itens.map(assinaturaClassificacao)).size }];
  }));
  return { success: true, generico: analise.generico, variacoes: analise.variacoes, parcela: analise.parcela ? `${String(analise.parcela.numero).padStart(2, '0')}/${String(analise.parcela.total).padStart(2, '0')}` : null, limite: LIMITE_RELACIONADAS, escopos };
}