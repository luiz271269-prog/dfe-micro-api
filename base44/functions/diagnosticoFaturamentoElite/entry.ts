import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Diagnóstico Faturamento × Relatório Elite
// Payload: { mes: "YYYY-MM", total_elite_notas?: number, total_elite_ci?: number }
// Retorna: lista de NFs/CIs do mês, totais, e divergência com o Elite.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mes = body.mes || new Date().toISOString().slice(0, 7);
    const totalEliteNotas = body.total_elite_notas ?? null;
    const totalEliteCI = body.total_elite_ci ?? null;

    const todas = await base44.asServiceRole.entities.NotaFiscal.list('-data_emissao', 2000);
    const doMes = todas.filter(n => (n.data_emissao || '').startsWith(mes));

    const validas = doMes.filter(n => !n.is_espelho_ci);
    const espelhos = doMes.filter(n => n.is_espelho_ci);

    const nfs = validas.filter(n => n.tipo === 'NF');
    const cis = validas.filter(n => n.tipo === 'CI');

    const totalNFs = nfs.reduce((s, n) => s + (n.valor_total || 0), 0);
    const totalCIs = cis.reduce((s, n) => s + (n.valor_total || 0), 0);
    const totalFaturado = totalNFs + totalCIs;
    const totalEspelhos = espelhos.reduce((s, n) => s + (n.valor_total || 0), 0);

    // Detecta duplicatas óbvias: mesmo (tipo, numero)
    const map = {};
    doMes.forEach(n => {
      const key = `${n.tipo}-${String(n.numero || '').trim()}`;
      if (!map[key]) map[key] = [];
      map[key].push({ id: n.id, valor: n.valor_total, espelho: n.is_espelho_ci, cliente: n.cliente });
    });
    const duplicadas = Object.entries(map).filter(([_, arr]) => arr.length > 1).map(([k, arr]) => ({ chave: k, qtd: arr.length, registros: arr }));

    // Comparação com Elite
    const divNotas = totalEliteNotas != null ? +(totalNFs - totalEliteNotas).toFixed(2) : null;
    const divCI = totalEliteCI != null ? +(totalCIs - totalEliteCI).toFixed(2) : null;
    const totalEliteEsperado = (totalEliteNotas ?? 0) + (totalEliteCI ?? 0);
    const divTotal = (totalEliteNotas != null || totalEliteCI != null) ? +(totalFaturado - totalEliteEsperado).toFixed(2) : null;

    // Lista detalhada
    const lista = doMes.map(n => ({
      id: n.id,
      tipo: n.tipo,
      numero: n.numero,
      cliente: n.cliente,
      vendedor: n.vendedor,
      valor_total: n.valor_total,
      data_emissao: n.data_emissao,
      is_espelho_ci: n.is_espelho_ci,
      ci_referencia: n.ci_referencia,
    })).sort((a, b) => `${a.tipo}-${a.numero}`.localeCompare(`${b.tipo}-${b.numero}`));

    return Response.json({
      mes,
      sistema: {
        total_nfs: +totalNFs.toFixed(2),
        total_cis: +totalCIs.toFixed(2),
        total_faturado: +totalFaturado.toFixed(2),
        total_espelhos_excluidos: +totalEspelhos.toFixed(2),
        qtd_nfs: nfs.length,
        qtd_cis: cis.length,
        qtd_espelhos: espelhos.length,
      },
      elite: { total_notas: totalEliteNotas, total_ci: totalEliteCI, total_geral: totalEliteEsperado || null },
      divergencias: { notas: divNotas, ci: divCI, total: divTotal },
      duplicadas_mesmo_numero: duplicadas,
      lista,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});