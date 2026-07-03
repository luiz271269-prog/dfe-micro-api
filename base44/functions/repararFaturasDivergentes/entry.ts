import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// P1 — Repara FaturaCartao.valor_total quando diverge da soma dos lançamentos positivos.
// A soma real dos LancamentoCartao é a verdade fiscal (extraída do PDF original);
// valor_total pode ter sido extraído incorretamente em alguma versão duplicada e mantido pelo dedup.

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run !== false;
    const tolerancia = Number(body?.tolerancia || 1.0);

    const svc = base44.asServiceRole.entities;
    const [faturas, lancs] = await Promise.all([
      svc.FaturaCartao.list('-data_vencimento', 1000),
      svc.LancamentoCartao.list('-data_lancamento', 10000),
    ]);

    const reparos = [];
    for (const f of faturas) {
      const ls = lancs.filter(l => l.fatura_id === f.id);
      if (ls.length === 0) continue;
      // Soma LÍQUIDA (com sinal): despesas menos estornos/créditos — esta é a verdade fiscal.
      // O valor_total às vezes foi extraído do PDF sem descontar os estornos, ficando inflado.
      const somaLiquida = ls.reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const valorAtual = Number(f.valor_total || 0);
      const diff = Math.abs(somaLiquida - valorAtual);
      if (diff > tolerancia) {
        reparos.push({
          fatura_id: f.id,
          mes: f.mes_referencia,
          conta_cartao_id: f.conta_cartao_id,
          valor_total_atual: Math.round(valorAtual * 100) / 100,
          soma_real: Math.round(somaLiquida * 100) / 100,
          diff: Math.round(diff * 100) / 100,
          qtd_lancs: ls.length,
        });
      }
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_faturas: faturas.length,
        para_reparar: reparos.length,
        reparos: reparos.slice(0, 100),
      });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only para apply' }, { status: 403 });
    }

    let atualizados = 0, erros = 0;
    for (const r of reparos) {
      try {
        await svc.FaturaCartao.update(r.fatura_id, { valor_total: r.soma_real });
        atualizados++;
        await sleep(120);
      } catch {
        erros++;
      }
    }

    return Response.json({ dry_run: false, atualizados, erros, total_reparados: reparos.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});