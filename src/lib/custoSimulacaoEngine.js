// Motor de simulação de custo efetivo — permite "what-if" sobre regime tributário
// e fornecedor sem alterar dados persistidos.

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
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

// Agrupa produtos de todas as NFeAnalise em SKUs virtuais
// Cada SKU traz histórico completo de preços, fornecedores, NCMs e impostos
export function agruparProdutosNFe(analises) {
  const flat = [];
  for (const nfe of analises || []) {
    for (const p of nfe.produtos || []) {
      flat.push({
        ...p,
        nfe_id: nfe.id,
        nfe_numero: nfe.numero_nota,
        data_emissao: nfe.data_emissao,
        emitente_nome: nfe.emitente_nome,
        emitente_cnpj: nfe.emitente_cnpj,
        emitente_uf: nfe.emitente_uf,
        destinatario_uf: nfe.destinatario_uf,
        operacao_interestadual: nfe.operacao_interestadual,
        emitente_regime: nfe.emitente_regime,
      });
    }
  }

  const grupos = [];
  const usados = new Set();

  for (let i = 0; i < flat.length; i++) {
    if (usados.has(i)) continue;
    const base = flat[i];
    const itens = [base];
    usados.add(i);

    for (let j = i + 1; j < flat.length; j++) {
      if (usados.has(j)) continue;
      const outro = flat[j];
      // mesmo NCM (se existir) tem prioridade
      const mesmoNCM = base.ncm && outro.ncm && base.ncm === outro.ncm;
      const sim = jaccard(base.descricao, outro.descricao);
      if (mesmoNCM && sim >= 0.35) { itens.push(outro); usados.add(j); }
      else if (sim >= 0.55) { itens.push(outro); usados.add(j); }
    }

    const descricao = itens.reduce((a, b) => (b.descricao || '').length > (a.descricao || '').length ? b : a).descricao;
    const ncm = itens.find(x => x.ncm)?.ncm || '';
    const fornecedoresMap = {};
    itens.forEach(it => {
      const k = it.emitente_nome || '—';
      if (!fornecedoresMap[k]) fornecedoresMap[k] = { nome: k, cnpj: it.emitente_cnpj, uf: it.emitente_uf, count: 0, soma_valor: 0, soma_qtd: 0 };
      fornecedoresMap[k].count++;
      fornecedoresMap[k].soma_valor += it.valor_total || 0;
      fornecedoresMap[k].soma_qtd += it.quantidade || 0;
    });
    const fornecedores = Object.values(fornecedoresMap).map(f => ({
      ...f,
      unitario_medio: f.soma_qtd > 0 ? f.soma_valor / f.soma_qtd : 0,
    })).sort((a, b) => b.soma_valor - a.soma_valor);

    const unitarios = itens.map(it => it.valor_unitario || (it.quantidade > 0 ? it.valor_total / it.quantidade : 0)).filter(v => v > 0);
    const custoMin = unitarios.length ? Math.min(...unitarios) : 0;
    const custoMax = unitarios.length ? Math.max(...unitarios) : 0;
    const variacaoPct = custoMin > 0 ? ((custoMax - custoMin) / custoMin) * 100 : 0;

    grupos.push({
      sku_key: `sku_${grupos.length}`,
      descricao,
      ncm,
      itens,
      fornecedores,
      custoMin,
      custoMax,
      variacaoPct,
      total_ocorrencias: itens.length,
    });
  }

  return grupos
    .filter(g => g.total_ocorrencias >= 1)
    .sort((a, b) => b.total_ocorrencias - a.total_ocorrencias);
}

// Calcula custo efetivo de UM item segundo regime escolhido.
// Retorna breakdown detalhado para exibir no DRE simulado.
export function calcularCustoEfetivo(item, regime) {
  const valor = item.valor_total || 0;
  const qtd = item.quantidade || 1;
  const icms = item.icms_valor || 0;
  const icmsST = item.icms_st_valor || 0;
  const ipi = item.ipi_valor || 0;
  const pis = item.pis_valor || 0;
  const cofins = item.cofins_valor || 0;

  let custoEfetivo, creditos, adicoes;
  if (regime === 'simples_nacional') {
    adicoes = { icms_st: icmsST, ipi };
    creditos = { icms: 0, pis: 0, cofins: 0, total: 0 };
    custoEfetivo = valor + icmsST + ipi;
  } else {
    // lucro_presumido_real: ICMS, PIS, COFINS são créditos recuperáveis
    adicoes = { icms_st: icmsST, ipi };
    creditos = { icms, pis, cofins, total: icms + pis + cofins };
    custoEfetivo = valor + icmsST + ipi - icms - pis - cofins;
  }

  return {
    valor_produto: valor,
    quantidade: qtd,
    adicoes,
    creditos,
    custo_efetivo: custoEfetivo,
    custo_unitario_efetivo: qtd > 0 ? custoEfetivo / qtd : custoEfetivo,
    impacto_pct: valor > 0 ? ((custoEfetivo - valor) / valor) * 100 : 0,
  };
}

// Monta série histórica (para gráfico) com custo efetivo por compra ao longo do tempo
export function serieHistoricaCusto(sku, regime) {
  return (sku.itens || [])
    .filter(it => it.data_emissao)
    .map(it => {
      const calc = calcularCustoEfetivo(it, regime);
      return {
        data: it.data_emissao,
        fornecedor: it.emitente_nome,
        nfe: it.nfe_numero,
        valor_unitario: it.valor_unitario || (it.quantidade > 0 ? it.valor_total / it.quantidade : 0),
        custo_unitario_efetivo: calc.custo_unitario_efetivo,
        icms_st: it.icms_st_valor || 0,
        ipi: it.ipi_valor || 0,
        impacto_pct: calc.impacto_pct,
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data));
}