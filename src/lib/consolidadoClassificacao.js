// Consolida os gastos classificados (VinculoExtrato + lançamentos classificados direto no extrato)
// em linhas mensais {mes, origem, tipo, valor} e agregados para o relatório gerencial.

export function construirLinhas(vinculos, lancs) {
  const lancById = new Map(lancs.map((l) => [l.id, l]));
  const idsComVinculo = new Set(vinculos.map((v) => v.lancamento_bancario_id));
  const linhas = [];

  for (const v of vinculos) {
    const l = lancById.get(v.lancamento_bancario_id);
    if (!l || (l.valor || 0) >= 0) continue;
    linhas.push({
      mes: (l.data || '').slice(0, 7),
      origem: v.origem_compra || l.origem_compra || 'sem_classificacao',
      tipo: v.tipo_compra || l.tipo_compra || 'sem_classificacao',
      valor: Math.abs(v.valor_alocado || 0),
    });
  }

  for (const l of lancs) {
    if (idsComVinculo.has(l.id) || (l.valor || 0) >= 0) continue;
    if (!l.origem_compra || !l.tipo_compra) continue;
    linhas.push({
      mes: (l.data || '').slice(0, 7),
      origem: l.origem_compra,
      tipo: l.tipo_compra,
      valor: Math.abs(l.valor || 0),
    });
  }

  return linhas.filter((r) => /^\d{4}-\d{2}$/.test(r.mes));
}

export function ultimosMeses(linhas, qtd = 12) {
  const atual = new Date().toISOString().slice(0, 7);
  const meses = [...new Set(linhas.map((r) => r.mes))].filter((m) => m <= atual).sort();
  return meses.slice(-qtd);
}

function somarPor(linhas, chave) {
  const acc = {};
  for (const r of linhas) acc[r[chave]] = (acc[r[chave]] || 0) + r.valor;
  return acc;
}

// Desempenho por categoria: total, participação, média mensal e variação do último mês
export function desempenhoPorCategoria(linhas, meses, chave = 'tipo') {
  const noPeriodo = linhas.filter((r) => meses.includes(r.mes));
  const totais = somarPor(noPeriodo, chave);
  const totalGeral = Object.values(totais).reduce((s, v) => s + v, 0);
  const ultimoMes = meses[meses.length - 1];
  const mesAnterior = meses[meses.length - 2];
  const doMes = somarPor(noPeriodo.filter((r) => r.mes === ultimoMes), chave);
  const doAnterior = somarPor(noPeriodo.filter((r) => r.mes === mesAnterior), chave);

  return Object.entries(totais)
    .map(([categoria, total]) => {
      const atual = doMes[categoria] || 0;
      const anterior = doAnterior[categoria] || 0;
      return {
        categoria,
        total,
        participacao: totalGeral ? total / totalGeral : 0,
        media: total / (meses.length || 1),
        atual,
        anterior,
        variacao: anterior ? (atual - anterior) / anterior : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// Receita mensal a partir das notas fiscais (ignora anuladas e NF-espelho de CI)
export function receitaMensal(notas, meses) {
  const acc = {};
  for (const n of notas || []) {
    if (n.status === 'anulada' || n.is_espelho_ci) continue;
    const mes = (n.data_emissao || '').slice(0, 7);
    if (!meses.includes(mes)) continue;
    acc[mes] = (acc[mes] || 0) + (n.valor_total || 0);
  }
  return acc;
}

// Comparativo mês a mês: receita x custos abertos por tipo de compra
export function comparativoMensal(linhas, notas, meses) {
  const receitas = receitaMensal(notas, meses);
  const tipos = [...new Set(linhas.filter((r) => meses.includes(r.mes)).map((r) => r.tipo))].sort();

  const dados = meses.map((mes) => {
    const doMes = linhas.filter((r) => r.mes === mes);
    const row = { mes, receita: receitas[mes] || 0, custoTotal: 0 };
    for (const t of tipos) {
      const v = doMes.filter((r) => r.tipo === t).reduce((s, r) => s + r.valor, 0);
      row[t] = v;
      row.custoTotal += v;
    }
    row.resultado = row.receita - row.custoTotal;
    row.margem = row.receita ? row.resultado / row.receita : null;
    return row;
  });

  return { dados, tipos };
}

export function serieMensal(linhas, meses) {
  return meses.map((mes) => ({
    mes,
    total: linhas.filter((r) => r.mes === mes).reduce((s, r) => s + r.valor, 0),
  }));
}