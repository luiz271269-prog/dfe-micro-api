import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Buscar todos os lançamentos
  const lancamentos = await base44.asServiceRole.entities.LancamentoBancario.list('-data', 1000);

  // ── 1. DUPLICATAS ─────────────────────────────────────────────────────────
  const seen = {};
  const duplicatas = [];

  for (const l of lancamentos) {
    const key = `${l.data}|${l.valor}|${(l.descricao || '').trim().toLowerCase()}`;
    if (seen[key]) {
      duplicatas.push({ id: l.id, data: l.data, valor: l.valor, descricao: l.descricao });
    } else {
      seen[key] = l.id;
    }
  }

  // ── 2. ANÁLISE POR MÊS ───────────────────────────────────────────────────
  const meses = {};
  for (const l of lancamentos) {
    const mes = l.mes_referencia || (l.data || '').slice(0, 7);
    if (!mes) continue;
    if (!meses[mes]) meses[mes] = { count: 0, total: 0, saldoInicial: null, saldoFinal: null, lancs: [] };
    meses[mes].count++;
    meses[mes].total += l.valor || 0;
    meses[mes].lancs.push(l);
  }

  // Para cada mês, ordenar por data e verificar consistência do saldo
  const mesSummary = {};
  for (const [mes, info] of Object.entries(meses)) {
    const sorted = info.lancs.sort((a, b) => new Date(a.data) - new Date(b.data));
    const comSaldo = sorted.filter(l => l.saldo_apos != null);
    
    let saldoProblems = [];
    // Verificar se saldo_apos é consistente: saldo_apos[i] deve ser ≈ saldo_apos[i-1] + valor[i]
    for (let i = 1; i < comSaldo.length; i++) {
      const esperado = comSaldo[i - 1].saldo_apos + comSaldo[i].valor;
      const real = comSaldo[i].saldo_apos;
      const diff = Math.abs(esperado - real);
      // tolerância de R$ 0.10 para arredondamentos
      if (diff > 0.10) {
        saldoProblems.push({
          data: comSaldo[i].data,
          descricao: comSaldo[i].descricao,
          saldo_anterior: comSaldo[i - 1].saldo_apos,
          valor: comSaldo[i].valor,
          saldo_esperado: Math.round(esperado * 100) / 100,
          saldo_real: real,
          diferenca: Math.round(diff * 100) / 100,
        });
      }
    }

    mesSummary[mes] = {
      count: info.count,
      total: Math.round(info.total * 100) / 100,
      comSaldo: comSaldo.length,
      semSaldo: sorted.length - comSaldo.length,
      saldoInicial: comSaldo.length > 0 ? comSaldo[0].saldo_apos - comSaldo[0].valor : null,
      saldoFinal: comSaldo.length > 0 ? comSaldo[comSaldo.length - 1].saldo_apos : null,
      saldoProblems: saldoProblems.slice(0, 5), // máx 5 por mês
      totalSaldoProblems: saldoProblems.length,
    };
  }

  return Response.json({
    totalLancamentos: lancamentos.length,
    duplicatas: {
      count: duplicatas.length,
      registros: duplicatas.slice(0, 20),
    },
    meses: mesSummary,
  });
});