// Carteira em aberto (a receber × a pagar) com aging, e adimplência do mês — posição na data "hoje".
import { linha, arred, noMes, dentroPerimetro } from './evidencia.ts';

const FAIXAS = [['0-30', 0, 30], ['31-60', 31, 60], ['61-90', 61, 90], ['>90', 91, Infinity]];
const dias = (a, b) => Math.floor((new Date(a) - new Date(b)) / 86400000);
const somaV = (itens) => arred(itens.reduce((s, i) => s + (i.valor || 0), 0));

// itens normalizados: { id, entidade, data_vencimento, valor, descricao }
function agrupar(itens, hoje) {
  const vencidos = itens.filter((i) => i.data_vencimento && i.data_vencimento < hoje);
  const aVencer = itens.filter((i) => !(i.data_vencimento && i.data_vencimento < hoje));
  const faixas = FAIXAS.map(([faixa, de, ate]) => ({
    faixa,
    aVencer: somaV(aVencer.filter((i) => { const d = i.data_vencimento ? dias(i.data_vencimento, hoje) : 0; return d >= de && d <= ate; })),
    vencido: somaV(vencidos.filter((i) => { const d = dias(hoje, i.data_vencimento); return d >= de && d <= ate; })),
  }));
  const porEntidade = {};
  for (const i of itens) {
    porEntidade[i.entidade] ??= [];
    porEntidade[i.entidade].push(i);
  }
  return {
    total: somaV(itens), registros: itens.length,
    aVencer: somaV(aVencer), vencido: somaV(vencidos), faixas,
    componentes: Object.fromEntries(Object.entries(porEntidade).map(([e, arr]) => [e, linha(arr, (i) => i.valor, { entidade: e })])),
  };
}

export function calcularAberto(dados, mes, perimetro, hoje) {
  const titulos = dados.TituloCobranca.filter((t) => t.status !== 'pago')
    .map((t) => ({ id: t.id, entidade: 'TituloCobranca', data_vencimento: t.data_vencimento, valor: (t.valor_titulo || 0) - (t.valor_pago || 0) }));

  const aPagar = [
    ...dados.Tributo.filter((t) => ['a_vencer', 'vencido'].includes(t.status) && dentroPerimetro(t.empresa, perimetro))
      .map((t) => ({ id: t.id, entidade: 'Tributo', data_vencimento: t.data_vencimento, valor: t.valor_original })),
    ...dados.DespesaOperacional.filter((d) => ['pendente', 'vencido'].includes(d.status) && dentroPerimetro(d.empresa, perimetro))
      .map((d) => ({ id: d.id, entidade: 'DespesaOperacional', data_vencimento: d.data_vencimento || d.data, valor: d.valor })),
    ...dados.FolhaPagamento.filter((f) => f.status === 'pendente' && dentroPerimetro(f.empresa, perimetro))
      .map((f) => ({ id: f.id, entidade: 'FolhaPagamento', data_vencimento: f.data_pagamento || null, valor: f.salario_liquido })),
    ...dados.FaturaCartao.filter((f) => f.status !== 'paga_total')
      .map((f) => ({ id: f.id, entidade: 'FaturaCartao', data_vencimento: f.data_vencimento, valor: (f.valor_total || 0) - (f.valor_pago || 0) })),
  ];

  // adimplência: títulos com vencimento no mês já vencidos até hoje → pagos / total (quantidade)
  const vencidosNoMes = dados.TituloCobranca.filter((t) => noMes(t.data_vencimento, mes) && t.data_vencimento <= hoje);
  const pagos = vencidosNoMes.filter((t) => t.status === 'pago').length;

  return {
    aReceber: agrupar(titulos, hoje),
    aPagar: agrupar(aPagar, hoje),
    adimplencia: { percentual: vencidosNoMes.length ? arred((pagos / vencidosNoMes.length) * 100) : null, pagos, total: vencidosNoMes.length },
  };
}