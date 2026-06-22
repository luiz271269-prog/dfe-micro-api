import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// P3 — Diagnostica LancamentoCartao órfãos (sem fatura_id válido).
// Reassocia via mes_referencia inferido do data_lancamento (YYYY-MM).
// Quando só há 1 fatura candidata no mês → match exato.
// Quando há múltiplas ou nenhuma → marca como ambíguo (preserva, não toca).

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run !== false;
    const acao = body?.acao || 'reassociar';

    const svc = base44.asServiceRole.entities;
    const [faturas, lancs] = await Promise.all([
      svc.FaturaCartao.list('-data_vencimento', 1000),
      svc.LancamentoCartao.list('-data_lancamento', 10000),
    ]);

    const fatIds = new Set(faturas.map(f => f.id));
    const orfaos = lancs.filter(l => !l.fatura_id || !fatIds.has(l.fatura_id));

    const sugestoes = [];
    for (const o of orfaos) {
      if (!o.data_lancamento) {
        sugestoes.push({ orfao_id: o.id, est: o.estabelecimento, valor: o.valor, nova_fatura_id: null, motivo: 'sem data_lancamento' });
        continue;
      }
      const ym = String(o.data_lancamento).slice(0, 7);
      const candidatas = faturas.filter(f => f.mes_referencia === ym);
      if (candidatas.length === 1) {
        sugestoes.push({ orfao_id: o.id, est: o.estabelecimento, data: o.data_lancamento, valor: o.valor, nova_fatura_id: candidatas[0].id, motivo: '1 candidata exata' });
      } else if (candidatas.length > 1) {
        sugestoes.push({ orfao_id: o.id, est: o.estabelecimento, data: o.data_lancamento, valor: o.valor, nova_fatura_id: null, motivo: `${candidatas.length} candidatas — ambíguo` });
      } else {
        sugestoes.push({ orfao_id: o.id, est: o.estabelecimento, data: o.data_lancamento, valor: o.valor, nova_fatura_id: null, motivo: 'nenhuma fatura no mês' });
      }
    }

    const reassociaveis = sugestoes.filter(s => s.nova_fatura_id);
    const ambiguos = sugestoes.filter(s => !s.nova_fatura_id);

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_orfaos: orfaos.length,
        reassociaveis: reassociaveis.length,
        ambiguos: ambiguos.length,
        exemplos_reassociar: reassociaveis.slice(0, 30),
        exemplos_ambiguos: ambiguos.slice(0, 20),
      });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only para apply' }, { status: 403 });
    }

    let acoes = 0, erros = 0;
    if (acao === 'reassociar') {
      for (const s of reassociaveis) {
        try {
          await svc.LancamentoCartao.update(s.orfao_id, { fatura_id: s.nova_fatura_id });
          acoes++;
          await sleep(100);
        } catch { erros++; }
      }
    }

    return Response.json({ dry_run: false, acao, acoes, erros });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});