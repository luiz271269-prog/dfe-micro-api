import { lerCompleto } from './conciliacaoLeitura.ts';
import { avaliarFixa, normalizarFixa } from './despesasFixas.ts';

const FATOR = { semanal: 52 / 12, mensal: 1, trimestral: 1 / 3, anual: 1 / 12 };
const r2 = v => Math.round(v * 100) / 100;
const somar = (mapa, chave, valor) => mapa.set(chave, (mapa.get(chave) || 0) + valor);
const maior = mapa => [...mapa.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

// Análise somente leitura: previsão vem do cadastro; pagamento vem do extrato e do cartão.
export async function analiseDespesasFixas(db, body) {
  const fim = body.mes;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(fim || '')) throw new Error('Período inválido.');
  const [ano, mes] = fim.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 12, 1)).toISOString().slice(0, 7);
  const periodo = { $gte: `${inicio}-01`, $lt: new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10) };
  const [regras, cadastro, extrato, cartoes, faturas] = await Promise.all([
    lerCompleto(db, 'RegraRecorrente', {}),
    lerCompleto(db, 'CadastroClassificacao', { ativo: true }, ['id', 'eixo', 'chave', 'rotulo']),
    lerCompleto(db, 'LancamentoBancario', { data: periodo, valor: { $lt: 0 } }, ['id', 'data', 'descricao', 'detalhe', 'valor', 'categoria', 'origem_compra', 'conta_bancaria', 'duplicidade_ref']),
    lerCompleto(db, 'LancamentoCartao', { data_lancamento: periodo, valor: { $gt: 0 } }, ['id', 'data_lancamento', 'estabelecimento', 'observacao', 'valor', 'categoria', 'origem_compra', 'empresa_beneficiada']),
    lerCompleto(db, 'FaturaCartao', { lancamento_bancario_id: { $exists: true, $ne: '' } }, ['id', 'lancamento_bancario_id']),
  ]);
  const ids = regras.map(r => r.id);
  const conciliadas = ids.length ? await db.DespesaOperacional.aggregate({ query: { data: periodo, regra_recorrente_id: { $in: ids } }, groupBy: ['regra_recorrente_id'], sum: ['valor'], limit: 1000 }) : { rows: [] };
  const conciliado = new Map(conciliadas.rows.map(g => [g.regra_recorrente_id, g.sum_valor || 0]));
  const rotulo = (eixo, chave) => cadastro.find(c => c.eixo === eixo && c.chave === chave)?.rotulo || chave || null;
  const pagaFatura = new Set(faturas.map(f => f.lancamento_bancario_id));
  const palavras = new Map(regras.map(r => [r.id, normalizarFixa(r.padrao_descricao).split(' ').filter(p => p.length > 2).length]));
  const achados = new Map(regras.map(r => [r.id, { total: 0, ocorrencias: 0, meses: new Set(), canais: new Set(), contas: new Set(), origens: new Map(), categorias: new Map(), ultima: null }]));

  for (const [canal, lancs] of [['extrato', extrato], ['cartao', cartoes]]) {
    for (const l of lancs) {
      if (canal === 'extrato' && (pagaFatura.has(l.id) || l.duplicidade_ref)) continue;
      // Um lançamento conta para uma única despesa fixa: a de palavra-chave mais específica.
      const regra = regras.filter(r => avaliarFixa({ ...r, is_ativa: true }, l, canal)).sort((a, b) => palavras.get(b.id) - palavras.get(a.id))[0];
      if (!regra) continue;
      const a = achados.get(regra.id), valor = Math.abs(l.valor), data = canal === 'cartao' ? l.data_lancamento : l.data;
      a.total += valor; a.ocorrencias++; a.meses.add(data.slice(0, 7)); a.canais.add(canal);
      if (l.conta_bancaria) a.contas.add(l.conta_bancaria);
      somar(a.origens, l.origem_compra || '', valor); somar(a.categorias, l.categoria || '', valor);
      if (!a.ultima || data > a.ultima) a.ultima = data;
    }
  }

  const itens = regras.map(r => {
    const a = achados.get(r.id), ativa = r.is_ativa !== false, origem = maior(a.origens), categoria = maior(a.categorias);
    return {
      id: r.id, nome: r.nome, ativa,
      cadastro: { origem: r.origem_compra || null, origem_rotulo: rotulo('origem', r.origem_compra), categoria: r.categoria || null, categoria_rotulo: rotulo('categoria', r.categoria) || 'Conta não definida', empresa: r.empresa || null, forma: r.forma_pagamento || null, frequencia: r.frequencia || 'mensal', valor_esperado: Number(r.valor_esperado) || 0, padrao: r.padrao_descricao || '' },
      previsto: { media_mensal: ativa ? r2((Number(r.valor_esperado) || 0) * (FATOR[r.frequencia || 'mensal'] || 0)) : 0 },
      pago: { total: r2(a.total), media_mensal: r2(a.total / 12), ocorrencias: a.ocorrencias, meses: a.meses.size, canais: [...a.canais], contas: [...a.contas], origem: origem || null, origem_rotulo: rotulo('origem', origem), categoria: categoria || null, categoria_rotulo: rotulo('categoria', categoria), ultima_data: a.ultima, conciliado_total: r2(conciliado.get(r.id) || 0) },
    };
  });
  const totais = { itens: itens.length, sem_pagamento: itens.filter(i => !i.pago.ocorrencias).length, conciliado_total: r2(itens.reduce((s, i) => s + i.pago.conciliado_total, 0)) };
  for (const base of ['previsto', 'pago']) {
    const total = itens.reduce((s, i) => s + i[base].media_mensal, 0), topo = Math.max(0, ...itens.map(i => i[base].media_mensal));
    totais[`${base}_mensal`] = r2(total);
    // Participação e largura da barra são fatos separados do valor exibido.
    for (const i of itens) { i[base].pct = total ? r2(i[base].media_mensal / total * 100) : 0; i[base].barra = topo ? r2(i[base].media_mensal / topo * 100) : 0; }
  }
  return { success: true, periodo: { inicio, fim, meses: 12 }, totais, itens };
}