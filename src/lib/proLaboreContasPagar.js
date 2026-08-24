/**
 * Pró-labore no Contas a Pagar — realizado + projetado.
 *
 * REALIZADO: retiradas já ocorridas
 *   - LancamentoBancario com categoria = 'pro_labore'
 *   - LancamentoCartao com natureza = 'pessoal'
 * PROJETADO: média dos últimos 3 meses completos, com vencimento no dia 5 do mês seguinte.
 *   O item projetado é planejado (is_planejado) — não tem entidade, logo nunca gera VinculoExtrato.
 */

function mesDe(dataStr) {
  return dataStr ? String(dataStr).slice(0, 7) : null;
}

function deslocarMes(mesIso, delta) {
  const [y, m] = mesIso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function calcularProLabore({ lancamentos = [], lancamentosCartao = [] }, hoje = new Date()) {
  const retiradas = lancamentos
    .filter(l => l.categoria === 'pro_labore')
    .map(l => ({ mes: mesDe(l.data), valor: Math.abs(l.valor || 0) }));

  const pessoais = lancamentosCartao
    .filter(l => l.natureza === 'pessoal' && (l.valor || 0) > 0)
    .filter(l => !(l.observacao || '').includes('Não faz parte'))
    .map(l => ({ mes: mesDe(l.data_lancamento), valor: l.valor || 0 }));

  const todos = [...retiradas, ...pessoais].filter(x => x.mes);

  const porMes = {};
  todos.forEach(x => { porMes[x.mes] = (porMes[x.mes] || 0) + x.valor; });

  const mesAtual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;
  const tresMeses = [1, 2, 3].map(d => deslocarMes(mesAtual, -d));
  const valores = tresMeses.map(m => porMes[m] || 0).filter(v => v > 0);
  const mediaMensal = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

  const realizadoTotal = Math.round(todos.reduce((a, x) => a + x.valor, 0) * 100) / 100;
  const realizadoMesAtual = Math.round((porMes[mesAtual] || 0) * 100) / 100;

  const proximoMes = deslocarMes(mesAtual, 1);
  const projetado = mediaMensal > 0
    ? {
        id: `prolabore-proj-${proximoMes}`,
        origem_id: null,
        origem_tipo: 'pro_labore',
        is_planejado: true,
        descricao: `Pró-labore projetado — ${proximoMes} (média 3 meses)`,
        fornecedor: 'Sócios',
        categoria: 'pro_labore',
        valor: Math.round(mediaMensal * 100) / 100,
        data_vencimento: `${proximoMes}-05`,
        empresa: '—',
        forma_pagamento: 'transferencia',
        origem_compra: 'pro_labore',
        tipo_compra: 'pro_labore',
      }
    : null;

  return { realizadoTotal, realizadoMesAtual, mediaMensal, mesesUsados: valores.length, porMes, projetado };
}