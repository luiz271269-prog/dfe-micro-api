import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Deduplicação específica de cartões:
// - FaturaCartao: mesma (conta_cartao_id + mes_referencia) — mantém a mais antiga
// - LancamentoCartao: mesma (fatura_id + data_lancamento + estabelecimento normalizado + valor arredondado)

function normEstab(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
}

function roundCents(v) {
  return Math.round((v || 0) * 100);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [faturas, lancs] = await Promise.all([
      base44.asServiceRole.entities.FaturaCartao.list('created_date', 5000),
      base44.asServiceRole.entities.LancamentoCartao.list('created_date', 10000),
    ]);

    // Dedup FaturaCartao
    const fatKey = new Map();
    const fatToDelete = [];
    const fatRemap = new Map(); // oldId -> keepId
    for (const f of faturas) {
      const key = `${f.conta_cartao_id}|${f.mes_referencia}`;
      if (fatKey.has(key)) {
        const keep = fatKey.get(key);
        fatRemap.set(f.id, keep.id);
        fatToDelete.push(f.id);
      } else {
        fatKey.set(key, f);
      }
    }

    // Remapear lancamentos para fatura mantida antes de deduplicar lancs
    for (const l of lancs) {
      if (fatRemap.has(l.fatura_id)) {
        const newFatId = fatRemap.get(l.fatura_id);
        await base44.asServiceRole.entities.LancamentoCartao.update(l.id, { fatura_id: newFatId });
        l.fatura_id = newFatId;
      }
    }

    // Apagar faturas duplicadas
    for (const id of fatToDelete) {
      await base44.asServiceRole.entities.FaturaCartao.delete(id);
    }

    // Dedup LancamentoCartao
    const lancKey = new Map();
    const lancToDelete = [];
    for (const l of lancs) {
      const key = `${l.fatura_id}|${l.data_lancamento}|${normEstab(l.estabelecimento)}|${roundCents(l.valor)}`;
      if (lancKey.has(key)) {
        lancToDelete.push(l.id);
      } else {
        lancKey.set(key, l);
      }
    }

    for (const id of lancToDelete) {
      await base44.asServiceRole.entities.LancamentoCartao.delete(id);
    }

    return Response.json({
      sucesso: true,
      faturas_duplicadas_removidas: fatToDelete.length,
      lancamentos_remapeados: fatRemap.size > 0 ? lancs.filter(l => fatRemap.has(l.fatura_id)).length : 0,
      lancamentos_duplicados_removidos: lancToDelete.length,
    });
  } catch (err) {
    console.error('Erro deduplicarCartoes:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});