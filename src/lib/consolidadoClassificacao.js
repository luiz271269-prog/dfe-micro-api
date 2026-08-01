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
  const meses = [...new Set(linhas.map((r) => r.mes))].sort();
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

export function serieMensal(linhas, meses) {
  return meses.map((mes) => ({
    mes,
    total: linhas.filter((r) => r.mes === mes).reduce((s, r) => s + r.valor, 0),
  }));
}