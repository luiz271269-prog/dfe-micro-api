import { calcularConsolidado } from './motor.ts';
import { arred } from './evidencia.ts';

const CAMPOS = ['receita_bruta', 'das', 'cmv', 'folha', 'prolabore', 'despesas', 'obras', 'outros_tributos'];
const mesesEntre = (inicio, fim) => { const out = []; let [y, m] = inicio.split('-').map(Number); while (`${y}-${String(m).padStart(2, '0')}` <= fim) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } return out; };
const somaLinha = (...linhas) => arred(linhas.reduce((s, l) => s + (l?.valor || 0), 0));

function montar(base) {
  const receita_liquida = arred(base.receita_bruta - base.das);
  const lucro_bruto = arred(receita_liquida - base.cmv);
  const total_despesas_operacionais = arred(base.folha + base.prolabore + base.despesas + base.obras + base.outros_tributos);
  const lucro_operacional = arred(lucro_bruto - total_despesas_operacionais);
  return { ...base, receita_liquida, lucro_bruto, total_despesas_operacionais, lucro_operacional, margem_bruta: base.receita_bruta ? arred(lucro_bruto / base.receita_bruta * 100) : 0, margem_operacional: base.receita_bruta ? arred(lucro_operacional / base.receita_bruta * 100) : 0 };
}

function detalhe(registro, origem, valor) {
  return { data: registro.data || registro.data_emissao || registro.data_referencia || registro.competencia, descricao: registro.descricao || registro.descricao_produto || registro.cliente || registro.funcionario_nome || registro.tipo || origem, empresa: registro.empresa || registro.empresa_beneficiada || '—', origem, valor: Math.abs(Number(valor) || 0) };
}

export function adaptarDRE({ dados, sourceStatus, mesInicio, mesFim, hoje }) {
  const competencia = Object.fromEntries(CAMPOS.map((c) => [c, 0]));
  const caixa = Object.fromEntries(CAMPOS.map((c) => [c, 0]));
  const itens = Object.fromEntries(CAMPOS.map((c) => [c, { competencia: [], caixa: [] }]));
  const mapas = Object.fromEntries(Object.entries(dados).map(([e, lista]) => [e, new Map(lista.map((r) => [r.id, r]))]));
  const anexar = (campo, regime, linha, entidade, valorFn) => { for (const id of linha?.ids || []) { const r = mapas[entidade]?.get(id); if (r && itens[campo][regime].length < 300) itens[campo][regime].push(detalhe(r, entidade, valorFn(r))); } };
  let ultimo;

  for (const mes of mesesEntre(mesInicio, mesFim)) {
    const r = calcularConsolidado({ dados, sourceStatus, mes, perimetro: 'grupo', hoje });
    ultimo = r;
    const op = r.operacao, cx = r.caixa;
    const c = { receita_bruta: op.faturamento.valor, das: op.tributos.componentes.das.valor, cmv: op.cmvEstimado.valor, folha: op.folha.valor, prolabore: 0, despesas: op.despesas.componentes.despesasOp.valor, obras: op.despesas.componentes.obrasManutencao.valor, outros_tributos: op.tributos.componentes.outros.valor };
    const k = { receita_bruta: cx.recebimentos.valor, das: Math.abs(cx.pagamentos.das.valor), cmv: Math.abs(cx.pagamentos.compras.valor + cx.pagamentos.cartao.valor), folha: Math.abs(cx.pagamentos.folha.valor), prolabore: Math.abs(cx.retiradas.proLabore.valor), despesas: Math.abs(cx.pagamentos.despesas.valor), obras: Math.abs(cx.investimentos.valor), outros_tributos: Math.abs(cx.pagamentos.outrosTributos.valor) };
    for (const campo of CAMPOS) { competencia[campo] = arred(competencia[campo] + c[campo]); caixa[campo] = arred(caixa[campo] + k[campo]); }

    anexar('receita_bruta', 'competencia', op.faturamento.componentes.vendasNF, 'NotaFiscal', (x) => x.valor_total);
    anexar('receita_bruta', 'competencia', op.faturamento.componentes.externos, 'IntegracaoFinanceira', (x) => x.valor);
    anexar('das', 'competencia', op.tributos.componentes.das, 'Tributo', (x) => x.valor_original);
    anexar('outros_tributos', 'competencia', op.tributos.componentes.outros, 'Tributo', (x) => x.valor_original);
    anexar('cmv', 'competencia', op.cmvEstimado, 'ItemCompra', (x) => x.valor_total);
    anexar('folha', 'competencia', op.folha, 'FolhaPagamento', (x) => x.salario_liquido);
    anexar('despesas', 'competencia', op.despesas.componentes.despesasOp, 'DespesaOperacional', (x) => x.valor);
    anexar('obras', 'competencia', op.despesas.componentes.obrasManutencao, 'ObraReforma', (x) => x.valor);
    anexar('receita_bruta', 'caixa', cx.recebimentos, 'LancamentoBancario', (x) => x.valor);
    anexar('das', 'caixa', cx.pagamentos.das, 'LancamentoBancario', (x) => x.valor);
    anexar('outros_tributos', 'caixa', cx.pagamentos.outrosTributos, 'LancamentoBancario', (x) => x.valor);
    anexar('cmv', 'caixa', cx.pagamentos.compras, 'LancamentoBancario', (x) => x.valor);
    anexar('cmv', 'caixa', cx.pagamentos.cartao, 'LancamentoBancario', (x) => x.valor);
    anexar('folha', 'caixa', cx.pagamentos.folha, 'LancamentoBancario', (x) => x.valor);
    anexar('prolabore', 'caixa', cx.retiradas.proLabore, 'LancamentoBancario', (x) => x.valor);
    anexar('despesas', 'caixa', cx.pagamentos.despesas, 'LancamentoBancario', (x) => x.valor);
    anexar('obras', 'caixa', cx.investimentos, 'LancamentoBancario', (x) => x.valor);
  }

  return { competencia: montar(competencia), caixa: montar(caixa), itens, motor: 'fluxoConsolidadoEngine', loopR: ultimo?.loopR, conciliacaoCache: ultimo?.conciliacaoCache };
}