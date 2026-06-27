import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const all = await base44.asServiceRole.entities.ItemCompra.list();

    // Group by (fornecedor + numero_nota + descricao_produto + valor_total)
    const groups = {};
    for (const rec of all) {
      const key = [
        (rec.fornecedor || '').trim().toLowerCase(),
        (rec.numero_nota || '').trim().toLowerCase(),
        (rec.descricao_produto || '').trim().toLowerCase(),
        String(rec.valor_total || 0),
      ].join('|');
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    }

    const toDelete = [];
    for (const recs of Object.values(groups)) {
      if (recs.length <= 1) continue;
      // Sort by created_date ascending — keep oldest
      recs.sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
      for (let i = 1; i < recs.length; i++) {
        toDelete.push(recs[i].id);
      }
    }

    let deleted = 0;
    for (const id of toDelete) {
      await base44.asServiceRole.entities.ItemCompra.delete(id);
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