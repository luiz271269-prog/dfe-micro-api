const n = (v) => Number(v) || 0;
const norm = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const period = (value, selectedMonth, annual) => (value || '').startsWith(annual ? selectedMonth.slice(0, 4) : selectedMonth);
const total = (lines) => lines.reduce((sum, line) => sum + n(line.value), 0);

function modalidade(value, fallback = 'nao_identificado') {
  const text = norm(value);
  if (text.includes('cart')) return 'cartao';
  if (text.includes('bol')) return 'boleto';
  if (text.includes('pix') || text.includes('transfer') || text.includes('dinheiro') || text.includes('debito')) return 'avista';
  return fallback;
}

function linha(raw, source, category, date, description, counterparty, value, mode, link) {
  return { id: `${source}-${raw.id}`, raw, source, category, date, description: description || 'Sem descrição', counterparty: counterparty || '—', value: Math.abs(n(value)), mode, status: raw.status || raw.status_pagamento || '—', link };
}

function linhasPeriodo(raw, selectedMonth, annual, regime) {
  const by = (value) => period(value, selectedMonth, annual);
  const nfs = raw.nfs.filter((x) => !x.is_espelho_ci && x.status !== 'anulada' && by(x.data_emissao));
  const revenue = nfs.map((x) => linha(x, 'NotaFiscal', 'faturamento', x.data_emissao, `${x.tipo || 'NF'} ${x.numero}`, x.cliente, x.valor_total, 'competencia', '/faturamento'));
  const seenRevenue = new Set(revenue.map((x) => `${x.date}|${Math.round(x.value * 100)}|${norm(x.counterparty)}`));
  const integratedTypes = regime === 'caixa' ? ['recebimento_aluguel', 'recebimento_servico'] : ['contrato_locacao', 'contrato_assistencia', 'ordem_servico'];
  raw.integracoes.filter((x) => integratedTypes.includes(x.tipo_registro) && by(x.data_referencia) && !['cancelado', 'anulado'].includes(norm(x.status))).forEach((x) => {
    const key = `${x.data_referencia}|${Math.round(Math.abs(n(x.valor)) * 100)}|${norm(x.contraparte)}`;
    if (!seenRevenue.has(key)) revenue.push(linha(x, 'IntegracaoFinanceira', 'faturamento', x.data_referencia, x.descricao, x.contraparte, x.valor, regime, '/integracoes-financeiras'));
  });

  const compras = raw.comp.filter((x) => by(regime === 'caixa' ? (x.data_vencimento || x.data_emissao) : x.data_emissao) && (regime !== 'caixa' || ['pago', 'parcial'].includes(x.status_pagamento))).map((x) => linha(x, 'ItemCompra', 'compras', x.data_emissao, x.descricao_produto, x.fornecedor, regime === 'caixa' && x.valor_pago ? x.valor_pago : x.valor_total, modalidade(x.forma_pagamento), '/compras'));
  const despesas = raw.despesas.filter((x) => by(regime === 'caixa' ? (x.data_vencimento || x.data) : x.data) && (regime !== 'caixa' || x.status === 'pago')).map((x) => linha(x, 'DespesaOperacional', 'despesas', x.data, x.descricao, x.fornecedor, x.valor, modalidade(x.forma_pagamento), '/despesas'));
  const impostos = raw.trib.filter((x) => by(regime === 'caixa' ? x.data_pagamento : x.competencia) && (regime !== 'caixa' || x.status === 'pago')).map((x) => linha(x, 'Tributo', ['INSS', 'FGTS', 'GPS'].includes(x.tipo) ? 'encargos_folha' : 'impostos_vendas', x.data_pagamento || x.competencia, x.descricao || x.tipo, x.empresa, regime === 'caixa' ? (x.valor_pago || x.valor_original) : x.valor_original, modalidade(x.conta_pagamento), '/tributos'));
  const folha = raw.folhas.filter((x) => by(regime === 'caixa' ? x.data_pagamento : x.competencia) && (regime !== 'caixa' || x.status === 'pago')).map((x) => linha(x, 'FolhaPagamento', 'folha', x.data_pagamento || x.competencia, x.funcionario_nome, x.empresa, regime === 'caixa' ? (x.valor_pago || x.salario_liquido) : x.salario_bruto, modalidade(x.forma_pagamento), '/funcionarios'));
  const obras = raw.obras.filter((x) => by(regime === 'caixa' ? (x.data_vencimento || x.data) : x.data) && (regime !== 'caixa' || x.lancamento_bancario_id || x.lancamento_cartao_id)).map((x) => linha(x, 'ObraReforma', 'obras', x.data, x.descricao, x.responsavel, x.valor, modalidade(x.forma_pagamento || (x.lancamento_cartao_id ? 'cartao' : x.lancamento_bancario_id ? 'pix' : '')), '/obras'));
  const transferIds = new Set(raw.transferencias.flatMap((x) => [x.lancamento_debito_id, x.lancamento_credito_id]).filter(Boolean));
  const proBanco = raw.lanc.filter((x) => by(x.data) && x.valor < 0 && x.tipo_compra === 'pro_labore' && !transferIds.has(x.id)).map((x) => linha(x, 'LancamentoBancario', 'pro_labore', x.data, x.descricao, x.conta_bancaria, x.valor, 'banco', '/prolabore'));
  const proCartao = raw.lancCartoes.filter((x) => by(x.data_lancamento) && x.tipo_compra === 'pro_labore').map((x) => linha(x, 'LancamentoCartao', 'pro_labore', x.data_lancamento, x.estabelecimento, x.empresa_beneficiada, x.valor, 'cartao', '/prolabore'));
  return { revenue, compras, despesas, impostos, folha, obras, proLabore: [...proBanco, ...proCartao] };
}

function buckets(lines, modes = ['avista', 'cartao', 'boleto', 'nao_identificado']) {
  return Object.fromEntries(modes.map((mode) => [mode, total(lines.filter((x) => x.mode === mode))]));
}

function buildExceptions(raw, lines) {
  const exceptions = [];
  const transferIds = new Set(raw.transferencias.flatMap((x) => [x.lancamento_debito_id, x.lancamento_credito_id]).filter(Boolean));
  const linkedIds = new Set(raw.vinculos.map((x) => x.lancamento_bancario_id));
  raw.lanc.filter((x) => x.valor < 0 && x.status_conciliacao !== 'ignorar' && !transferIds.has(x.id) && !linkedIds.has(x.id)).forEach((x) => exceptions.push({ id: `orphan-${x.id}`, date: x.data, source: 'Extrato', description: x.descricao, category: x.tipo_compra || x.categoria, mode: 'banco', value: Math.abs(n(x.valor)), reason: 'Saída bancária sem vínculo', status: x.status_conciliacao, link: '/extrato' }));
  lines.filter((x) => x.mode === 'nao_identificado').forEach((x) => exceptions.push({ id: `mode-${x.id}`, date: x.date, source: x.source, description: x.description, category: x.category, mode: x.mode, value: x.value, reason: 'Modalidade de pagamento não identificada', status: x.status, link: x.link }));
  raw.comp.filter((x) => x.lancamento_bancario_id && x.lancamento_cartao_id).forEach((x) => exceptions.push({ id: `dup-${x.id}`, date: x.data_emissao, source: 'Compras', description: x.descricao_produto, category: 'compras', mode: x.forma_pagamento, value: n(x.valor_total), reason: 'Compra vinculada simultaneamente ao banco e cartão', status: x.status_pagamento, link: '/compras' }));
  const bankById = new Map(raw.lanc.map((x) => [x.id, Math.abs(n(x.valor))]));
  const allocated = raw.vinculos.reduce((map, x) => map.set(x.lancamento_bancario_id, n(map.get(x.lancamento_bancario_id)) + n(x.valor_alocado)), new Map());
  allocated.forEach((value, id) => { if (bankById.has(id) && Math.abs(bankById.get(id) - value) > 0.01) exceptions.push({ id: `diff-${id}`, source: 'Conciliação', description: 'Valor alocado diferente do lançamento', category: 'divergencia', mode: 'banco', value: Math.abs(bankById.get(id) - value), reason: 'Divergência entre obrigação e extrato', status: 'parcial', link: '/conciliacao360' }); });
  return exceptions;
}

function pct(value, base) { return base ? value / base * 100 : 0; }
function monthsUntil(selectedMonth) {
  const [year, month] = selectedMonth.split('-').map(Number); const out = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(year, month - 1 - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}

export function buildFluxoConsolidado(rawInput, selectedMonth, isAnnual, regime = 'competencia') {
  const raw = { nfs: [], integracoes: [], comp: [], despesas: [], trib: [], folhas: [], obras: [], lanc: [], lancCartoes: [], transferencias: [], vinculos: [], ...rawInput };
  const groups = linhasPeriodo(raw, selectedMonth, isAnnual, regime);
  const faturamento = total(groups.revenue), compras = total(groups.compras), despesas = total(groups.despesas);
  const impostosVendas = total(groups.impostos.filter((x) => x.category === 'impostos_vendas'));
  const encargosFolha = total(groups.impostos.filter((x) => x.category === 'encargos_folha'));
  const folha = total(groups.folha), obras = total(groups.obras), proLabore = total(groups.proLabore);
  const custosDiretos = compras + despesas + impostosVendas + encargosFolha + folha;
  const outrasSaidas = obras + proLabore, resultado = faturamento - custosDiretos - outrasSaidas;
  const allCostLines = [...groups.compras, ...groups.despesas, ...groups.impostos, ...groups.folha, ...groups.obras, ...groups.proLabore];
  const exceptions = buildExceptions(raw, allCostLines);
  const eligibleBank = raw.lanc.filter((x) => x.valor < 0 && x.status_conciliacao !== 'ignorar');
  const reconciledValue = eligibleBank.filter((x) => x.status_conciliacao === 'conciliado').reduce((s, x) => s + Math.abs(n(x.valor)), 0);
  const bankValue = eligibleBank.reduce((s, x) => s + Math.abs(n(x.valor)), 0);
  const classifiedValue = allCostLines.filter((x) => x.category && x.mode !== 'nao_identificado').reduce((s, x) => s + x.value, 0);
  const chart = monthsUntil(selectedMonth).map((month) => { const g = linhasPeriodo(raw, month, false, regime); const fat = total(g.revenue); const cd = total([...g.compras, ...g.despesas, ...g.impostos, ...g.folha]); const other = total([...g.obras, ...g.proLabore]); return { month, faturamento: fat, custos: cd, outras: other, resultado: fat - cd - other, margem: pct(fat - cd - other, fat) }; });
  return {
    regime, faturamento, custosDiretos, margemDireta: faturamento - custosDiretos, outrasSaidas, resultado, margemFinal: pct(resultado, faturamento),
    compras: { total: compras, percent: pct(compras, faturamento), count: groups.compras.length, ticket: groups.compras.length ? compras / groups.compras.length : 0, buckets: buckets(groups.compras), lines: groups.compras },
    despesas: { total: despesas, percent: pct(despesas, faturamento), buckets: buckets(groups.despesas), lines: groups.despesas },
    impostos: { total: impostosVendas + encargosFolha, vendas: impostosVendas, encargos: encargosFolha, percent: pct(impostosVendas + encargosFolha, faturamento), lines: groups.impostos },
    folha: { total: folha, percent: pct(folha, faturamento), ativos: raw.func?.filter((x) => x.status === 'ativo').length || 0, medio: groups.folha.length ? folha / groups.folha.length : 0, lines: groups.folha },
    obras: { total: obras, percent: pct(obras, faturamento), orcado: groups.obras.reduce((s, x) => s + n(x.raw.orcamento), 0), buckets: buckets(groups.obras), lines: groups.obras },
    proLabore: { total: proLabore, percent: pct(proLabore, faturamento), buckets: buckets(groups.proLabore, ['banco', 'cartao']), lines: groups.proLabore },
    integrity: { reconciled: pct(reconciledValue, bankValue), classified: pct(classifiedValue, total(allCostLines)), count: exceptions.length, value: exceptions.reduce((s, x) => s + n(x.value), 0) },
    exceptions, chart, groups,
  };
}

export function getConsolidatedDrill(key, data) {
  if (!data) return null;
  const map = { faturamentoConsolidado: data.groups.revenue, comprasConsolidadas: data.compras.lines, despesasConsolidadas: data.despesas.lines, impostosConsolidados: data.impostos.lines, folhaConsolidada: data.folha.lines, obrasConsolidadas: data.obras.lines, proLaboreConsolidado: data.proLabore.lines };
  const rows = map[key]; if (!rows) return null;
  return { title: key.replace('Consolidado', '').replace(/([A-Z])/g, ' $1').trim(), subtitle: `Regime de ${data.regime}`, rows, total: total(rows), link: rows[0]?.link, columns: [{ label: 'Data', get: (x) => x.date }, { label: 'Origem', get: (x) => x.source }, { label: 'Descrição', get: (x) => x.description }, { label: 'Contraparte', get: (x) => x.counterparty }, { label: 'Modalidade', get: (x) => x.mode }, { label: 'Valor', get: (x) => ({ money: true, value: x.value }) }] };
}