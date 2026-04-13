import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { mes } = await req.json().catch(() => ({}));
  const targetMes = mes || '2026-04';

  const lancamentos = await base44.asServiceRole.entities.LancamentoBancario.list('-data', 1000);
  const doMes = lancamentos.filter(l => (l.mes_referencia || (l.data || '').slice(0, 7)) === targetMes);

  // ── 1. Duplicatas exatas (mesma data + valor + descricao) ─────────────────
  const seenExato = {};
  const duplicatasExatas = [];
  for (const l of doMes) {
    const key = `${l.data}|${l.valor}|${(l.descricao || '').trim().toLowerCase()}`;
    if (seenExato[key]) {
      duplicatasExatas.push({ id: l.id, data: l.data, valor: l.valor, descricao: l.descricao, tipo: 'exata' });
    } else {
      seenExato[key] = l.id;
    }
  }

  // ── 2. Duplicatas semânticas (mesma data + mesmo valor, descrição diferente) ──
  // Ex: "APLEX DISTRIBUIDORA" e "LIQUIDACAO BOLETO ... APLEX DISTRIBUI" — mesmo pagamento
  const seenValorData = {};
  const duplicatasSemânticas = [];
  for (const l of doMes) {
    const key = `${l.data}|${l.valor}`;
    if (seenValorData[key]) {
      const prev = seenValorData[key];
      // só alertar se valor for negativo (saída) - para evitar falsos positivos em recebimentos
      if (l.valor < 0) {
        duplicatasSemânticas.push({
          data: l.data,
          valor: l.valor,
          descricao_a: prev.descricao,
          descricao_b: l.descricao,
          id_a: prev.id,
          id_b: l.id,
          detalhe_a: prev.detalhe,
          detalhe_b: l.detalhe,
        });
      }
    } else {
      seenValorData[key] = l;
    }
  }

  // ── 3. Resumo por data ────────────────────────────────────────────────────
  const porData = {};
  for (const l of doMes) {
    const d = l.data;
    if (!porData[d]) porData[d] = { count: 0, total: 0 };
    porData[d].count++;
    porData[d].total += l.valor || 0;
  }

  // ── 4. Totais gerais ──────────────────────────────────────────────────────
  const totalDB = doMes.reduce((s, l) => s + (l.valor || 0), 0);
  const entradas = doMes.filter(l => l.valor > 0).reduce((s, l) => s + l.valor, 0);
  const saidas = doMes.filter(l => l.valor < 0).reduce((s, l) => s + l.valor, 0);

  return Response.json({
    mes: targetMes,
    totalLancamentos: doMes.length,
    totalDB: Math.round(totalDB * 100) / 100,
    entradas: Math.round(entradas * 100) / 100,
    saidas: Math.round(saidas * 100) / 100,
    duplicatasExatas,
    duplicatasSemânticas,
    porData,
  });
});