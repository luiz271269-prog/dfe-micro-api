import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all LancamentoBancario records
    const all = await base44.asServiceRole.entities.LancamentoBancario.list();

    // Parcelas de financiamento usam contrato + mês + valor; os demais lançamentos
    // continuam usando data + valor + descrição para preservar movimentos distintos.
    const groups = {};
    for (const rec of all) {
      const text = `${rec.descricao || ''} ${rec.detalhe || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      const contract = text.match(/C\s*(\d{8,})/);
      const descNorm = (rec.descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
      const key = contract && /OPERACAO DE CREDITO|LIQUIDACAO DE PARCELA|PARCELA/.test(text)
        ? `fin:${String(rec.data || '').slice(0, 7)}|c:${contract[1].slice(0, 8)}|v:${Math.round(Number(rec.valor || 0) * 100)}`
        : `${rec.data}|${rec.valor}|${descNorm}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    }

    const toDelete = [];
    for (const [, recs] of Object.entries(groups)) {
      if (recs.length <= 1) continue;

      // Sort: prefer records with saldo_apos (official bank import), then by created_date ascending (keep oldest)
      recs.sort((a, b) => {
        const aHasSaldo = a.saldo_apos != null ? 0 : 1;
        const bHasSaldo = b.saldo_apos != null ? 0 : 1;
        if (aHasSaldo !== bHasSaldo) return aHasSaldo - bHasSaldo;
        // same saldo status: keep the one with more info in detalhe, or oldest
        const aDetailLen = (a.detalhe || '').length;
        const bDetailLen = (b.detalhe || '').length;
        return bDetailLen - aDetailLen; // keep more detailed one first
      });

      // Keep first, delete rest
      for (let i = 1; i < recs.length; i++) {
        toDelete.push(recs[i].id);
      }
    }

    let deleted = 0;
    for (const id of toDelete) {
      await base44.asServiceRole.entities.LancamentoBancario.delete(id);
      deleted++;
    }

    return Response.json({
      total: all.length,
      duplicates_removed: deleted,
      remaining: all.length - deleted,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});