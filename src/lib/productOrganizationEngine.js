// Motor de organização de produtos — SKU virtual, custo médio ponderado, saúde financeira
// Padrão contábil global (3-Way Matching simplificado: Compra ↔ Pagamento ↔ Produto)

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

// Agrupa ItemCompra em SKUs virtuais por similaridade de descrição + mesma categoria
export function agruparProdutos(itens) {
  const grupos = [];
  const usados = new Set();

  for (const item of itens) {
    if (usados.has(item.id)) continue;
    const grupo = { itens: [item], categoria: item.categoria_produto };
    usados.add(item.id);

    for (const outro of itens) {
      if (usados.has(outro.id)) continue;
      if (outro.categoria_produto !== item.categoria_produto) continue;
      const sim = jaccard(item.descricao_produto, outro.descricao_produto);
      if (sim >= 0.5) {
        grupo.itens.push(outro);
        usados.add(outro.id);
      }
    }

    grupos.push(grupo);
  }

  // Calcula métricas de cada grupo
  return grupos.map((g, idx) => {
    const itens = g.itens;
    const total_quantidade = itens.reduce((s, i) => s + (i.quantidade || 1), 0);
    const total_gasto = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
    const custo_medio = total_quantidade > 0 ? total_gasto / total_quantidade : 0;
    const unitarios = itens.map(i => i.valor_unitario || (i.valor_total / (i.quantidade || 1))).filter(v => v > 0);
    const maxU = Math.max(...unitarios, 0);
    const minU = Math.min(...unitarios, Infinity);
    const variacao_preco_percentual = minU > 0 && isFinite(minU) ? ((maxU - minU) / minU) * 100 : 0;

    const fornecedores = [...new Set(itens.map(i => i.fornecedor).filter(Boolean))];
    const qtd_fornecedores = fornecedores.length;

    const pagos = itens.filter(i => i.status_pagamento === 'pago').length;
    const pct_pagos = itens.length > 0 ? (pagos / itens.length) * 100 : 0;
    const saude_pagamento = pct_pagos >= 80 ? 'ok' : pct_pagos >= 40 ? 'parcial' : 'critico';

    // Descrição canônica = a mais longa/informativa do grupo
    const descricao_canonica = itens.reduce((a, b) =>
      (b.descricao_produto || '').length > (a.descricao_produto || '').length ? b : a
    ).descricao_produto;

    return {
      sku_key: `sku_${idx}`,
      descricao_canonica,
      categoria: g.categoria,
      itens,
      total_quantidade,
      total_gasto,
      custo_medio,
      variacao_preco_percentual,
      fornecedores,
      qtd_fornecedores,
      pct_pagos,
      saude_pagamento,
    };
  }).sort((a, b) => b.total_gasto - a.total_gasto);
}

// Gera alertas de governança
export function gerarAlertasProdutos(grupos, itens) {
  const alertas = [];

  // 1. Variação de preço alta (>20%)
  grupos.filter(g => g.variacao_preco_percentual > 20 && g.itens.length >= 2).forEach(g => {
    alertas.push({
      tipo: 'variacao_preco',
      severidade: 'alta',
      titulo: `Variação de preço de ${g.variacao_preco_percentual.toFixed(1)}%`,
      detalhe: `${g.descricao_canonica} — revisar se é o mesmo produto ou negociar com fornecedor`,
    });
  });

  // 2. Concentração de fornecedor (um único fornecedor >80% do gasto na categoria)
  const gastoPorCat = {};
  const gastoPorCatForn = {};
  itens.forEach(i => {
    const c = i.categoria_produto || 'outro';
    gastoPorCat[c] = (gastoPorCat[c] || 0) + (i.valor_total || 0);
    const k = `${c}__${i.fornecedor}`;
    gastoPorCatForn[k] = (gastoPorCatForn[k] || 0) + (i.valor_total || 0);
  });
  Object.entries(gastoPorCatForn).forEach(([k, v]) => {
    const [cat, forn] = k.split('__');
    const totalCat = gastoPorCat[cat];
    if (totalCat > 1000 && v / totalCat > 0.8) {
      alertas.push({
        tipo: 'concentracao_fornecedor',
        severidade: 'media',
        titulo: `${((v / totalCat) * 100).toFixed(0)}% das compras de ${cat} são de ${forn}`,
        detalhe: `Risco de dependência. Buscar fornecedores alternativos.`,
      });
    }
  });

  // 3. Compras sem pagamento vinculado (pendente)
  const semPag = itens.filter(i => i.status_pagamento !== 'pago').length;
  if (semPag > 0) {
    const totalPend = itens.filter(i => i.status_pagamento !== 'pago').reduce((s, i) => s + (i.valor_total || 0), 0);
    alertas.push({
      tipo: 'pagamento_pendente',
      severidade: semPag > 10 ? 'alta' : 'media',
      titulo: `${semPag} compra(s) sem pagamento vinculado`,
      detalhe: `Total pendente: R$ ${totalPend.toFixed(2)} — revisar em Compras × Pagamentos`,
    });
  }

  return alertas.slice(0, 10);
}

// KPIs estratégicos
export function calcularKPIs(grupos, itens) {
  const totalCompras = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
  const totalSKUs = grupos.length;
  const totalFornecedores = new Set(itens.map(i => i.fornecedor).filter(Boolean)).size;
  const pagos = itens.filter(i => i.status_pagamento === 'pago').length;
  const pctConformidade = itens.length > 0 ? (pagos / itens.length) * 100 : 0;
  const variacoesAltas = grupos.filter(g => g.variacao_preco_percentual > 20).length;

  return {
    totalCompras,
    totalSKUs,
    totalFornecedores,
    pctConformidade,
    variacoesAltas,
    totalItens: itens.length,
  };
}