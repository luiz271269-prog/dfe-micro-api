// Motor de simulação de custo — agrupa produtos das NFeAnalise por SKU virtual
// e calcula custo efetivo sob diferentes cenários (regime / fornecedor).

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  return new Set(norm(s).split(' ').filter(w => w.length >= 3));
}

function jaccard(a, b) {
  const sa = tokens(a), sb = tokens(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// Achata todos os produtos de todas as NFeAnalise em linhas individuais com contexto da NF
export function achatarProdutosNFe(analises) {
  const linhas = [];
  for (const nfe of analises || []) {
    for (const p of nfe.produtos || []) {
      linhas.push({
        // contexto NF
        nfe_id: nfe.id,
        nfe_numero: nfe.numero_nota,
        data_emissao: nfe.data_emissao,
        fornecedor: nfe.emitente_nome || '—',
        fornecedor_cnpj: nfe.emitente_cnpj,
        fornecedor_uf: nfe.emitente_uf,
        emitente_regime: nfe.emitente_regime,
        operacao_interestadual: nfe.operacao_interestadual,
        // produto
        codigo: p.codigo,
        descricao: p.descricao,
        ncm: p.ncm,
        cfop: p.cfop,
        quantidade: p.quantidade || 1,
        valor_unitario: p.valor_unitario || 0,
        valor_total: p.valor_total || 0,
        // impostos
        icms_valor: p.icms_valor || 0,
        icms_aliquota: p.icms_aliquota || 0,
        icms_st_valor: p.icms_st_valor || 0,
        icms_st_aliquota: p.icms_st_aliquota || 0,
        ipi_valor: p.ipi_valor || 0,
        ipi_aliquota: p.ipi_aliquota || 0,
        pis_valor: p.pis_valor || 0,
        pis_aliquota: p.pis_aliquota || 0,
        cofins_valor: p.cofins_valor || 0,
        cofins_aliquota: p.cofins_aliquota || 0,
      });
    }
  }
  return linhas;
}

// Agrupa linhas em SKUs virtuais por NCM + similaridade de descrição
export function agruparSKUs(linhas) {
  const grupos = [];
  const usados = new Set();

  for (let i = 0; i < linhas.length; i++) {
    if (usados.has(i)) continue;
    const grupo = { linhas: [linhas[i]] };
    usados.add(i);

    for (let j = i + 1; j < linhas.length; j++) {
      if (usados.has(j)) continue;
      const a = linhas[i], b = linhas[j];
      // mesmo NCM (quando ambos existem) OU mesmo código OU alta similaridade textual
      const mesmoNCM = a.ncm && b.ncm && a.ncm === b.ncm;
      const mesmoCod = a.codigo && b.codigo && a.codigo === b.codigo && a.fornecedor === b.fornecedor;
      const sim = jaccard(a.descricao, b.descricao);
      if (mesmoCod || (mesmoNCM && sim >= 0.45) || sim >= 0.65) {
        grupo.linhas.push(b);
        usados.add(j);
      }
    }
    grupos.push(grupo);
  }

  return grupos.map((g, idx) => {
    const linhas = g.linhas.sort((a, b) => (a.data_emissao || '').localeCompare(b.data_emissao || ''));
    const descricao_canonica = linhas.reduce((a, b) => (b.descricao || '').length > (a.descricao || '').length ? b : a).descricao;
    const ncms = [...new Set(linhas.map(l => l.ncm).filter(Boolean))];
    const fornecedores = [...new Set(linhas.map(l => l.fornecedor))];
    const qtd_total = linhas.reduce((s, l) => s + l.quantidade, 0);
    const valor_total = linhas.reduce((s, l) => s + l.valor_total, 0);
    const custo_medio_unitario = qtd_total > 0 ? valor_total / qtd_total : 0;
    const unitarios = linhas.map(l => l.valor_unitario).filter(v => v > 0);
    const min = unitarios.length ? Math.min(...unitarios) : 0;
    const max = unitarios.length ? Math.max(...unitarios) : 0;
    const variacao_pct = min > 0 ? ((max - min) / min) * 100 : 0;
    return {
      sku_key: `sku_${idx}`,
      descricao_canonica,
      ncms, ncm_principal: ncms[0] || null,
      fornecedores, qtd_fornecedores: fornecedores.length,
      linhas,
      qtd_ocorrencias: linhas.length,
      qtd_total,
      valor_total,
      custo_medio_unitario,
      min_unitario: min,
      max_unitario: max,
      variacao_pct,
      recorrente: linhas.length >= 2,
    };
  }).sort((a, b) => b.valor_total - a.valor_total);
}

// Calcula custo efetivo de uma linha sob um cenário (regime do comprador)
// Retorna { custo_efetivo, custo_unitario, adicoes: {icms_st, ipi, pis_cofins}, creditos: {icms, pis, cofins} }
export function calcularCustoEfetivo(linha, regimeComprador) {
  const valor = linha.valor_total || 0;
  const qtd = linha.quantidade || 1;
  const icmsST = linha.icms_st_valor || 0;
  const ipi = linha.ipi_valor || 0;
  const icms = linha.icms_valor || 0;
  const pis = linha.pis_valor || 0;
  const cofins = linha.cofins_valor || 0;

  let custoEfetivo, adicoes, creditos;
  if (regimeComprador === 'simples_nacional') {
    // Simples: ICMS-ST + IPI compõem custo; ICMS/PIS/COFINS destacados NÃO geram crédito (compõem custo também na prática,
    // mas no XML de compra o Simples não destaca — aqui mantemos apenas ST+IPI como adições explícitas)
    custoEfetivo = valor + icmsST + ipi;
    adicoes = { icms_st: icmsST, ipi, pis_cofins: 0 };
    creditos = { icms: 0, pis: 0, cofins: 0 };
  } else {
    // Lucro Presumido/Real: ICMS, PIS, COFINS são recuperáveis (créditos) — ICMS-ST e IPI permanecem no custo
    custoEfetivo = valor + icmsST + ipi - icms - pis - cofins;
    adicoes = { icms_st: icmsST, ipi, pis_cofins: 0 };
    creditos = { icms, pis, cofins };
  }

  return {
    valor_base: valor,
    custo_efetivo: custoEfetivo,
    custo_unitario: qtd > 0 ? custoEfetivo / qtd : custoEfetivo,
    adicoes,
    creditos,
    impacto_pct: valor > 0 ? ((custoEfetivo - valor) / valor) * 100 : 0,
  };
}

// Simula substituição de fornecedor: pega uma linha de referência e aplica os
// parâmetros fiscais médios observados para o fornecedor alvo (mesmo SKU, outras NFs)
export function simularTrocaFornecedor(sku, linhaRef, fornecedorAlvo, regimeComprador) {
  const linhasAlvo = sku.linhas.filter(l => l.fornecedor === fornecedorAlvo);
  if (linhasAlvo.length === 0) return null;

  // Média ponderada por quantidade dos parâmetros do fornecedor alvo
  const qtdAlvo = linhasAlvo.reduce((s, l) => s + l.quantidade, 0);
  const valorAlvo = linhasAlvo.reduce((s, l) => s + l.valor_total, 0);
  const unitarioMedio = qtdAlvo > 0 ? valorAlvo / qtdAlvo : 0;

  const aliqMedia = (campo) => {
    const somaPonderada = linhasAlvo.reduce((s, l) => s + ((l[campo] || 0) * l.quantidade), 0);
    return qtdAlvo > 0 ? somaPonderada / qtdAlvo : 0;
  };

  const icmsAliq = aliqMedia('icms_aliquota');
  const icmsSTAliq = aliqMedia('icms_st_aliquota');
  const ipiAliq = aliqMedia('ipi_aliquota');
  const pisAliq = aliqMedia('pis_aliquota');
  const cofinsAliq = aliqMedia('cofins_aliquota');

  // Reconstruir linha simulada mantendo a quantidade da linha de referência
  const qtd = linhaRef.quantidade || 1;
  const valorSimulado = unitarioMedio * qtd;

  const linhaSim = {
    ...linhaRef,
    fornecedor: fornecedorAlvo,
    valor_unitario: unitarioMedio,
    valor_total: valorSimulado,
    icms_aliquota: icmsAliq,
    icms_valor: valorSimulado * icmsAliq / 100,
    icms_st_aliquota: icmsSTAliq,
    icms_st_valor: valorSimulado * icmsSTAliq / 100,
    ipi_aliquota: ipiAliq,
    ipi_valor: valorSimulado * ipiAliq / 100,
    pis_aliquota: pisAliq,
    pis_valor: valorSimulado * pisAliq / 100,
    cofins_aliquota: cofinsAliq,
    cofins_valor: valorSimulado * cofinsAliq / 100,
  };

  return {
    linha_simulada: linhaSim,
    custo: calcularCustoEfetivo(linhaSim, regimeComprador),
    ocorrencias_fornecedor: linhasAlvo.length,
  };
}

// Histórico de preços por data para um SKU (agrupado por fornecedor)
export function historicoPorFornecedor(sku) {
  const map = {};
  for (const l of sku.linhas) {
    const k = l.fornecedor;
    if (!map[k]) map[k] = [];
    map[k].push({
      data: l.data_emissao,
      valor_unitario: l.valor_unitario,
      custo_unitario_efetivo_simples: (l.valor_total + l.icms_st_valor + l.ipi_valor) / (l.quantidade || 1),
      custo_unitario_efetivo_normal: (l.valor_total + l.icms_st_valor + l.ipi_valor - l.icms_valor - l.pis_valor - l.cofins_valor) / (l.quantidade || 1),
      quantidade: l.quantidade,
      nfe: l.nfe_numero,
    });
  }
  // Ordenar cada série por data
  Object.values(map).forEach(arr => arr.sort((a, b) => (a.data || '').localeCompare(b.data || '')));
  return map;
}