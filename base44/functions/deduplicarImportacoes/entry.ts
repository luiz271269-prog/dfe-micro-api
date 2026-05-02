import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Deduplica registros mantendo o mais antigo
function dedup(records, keyFn) {
  const seen = new Map();
  const toDelete = [];
  const sorted = [...records].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
  for (const r of sorted) {
    const key = keyFn(r);
    if (!key) continue;
    if (seen.has(key)) {
      toDelete.push(r.id);
    } else {
      seen.set(key, r.id);
    }
  }
  return toDelete;
}

// Deleta IDs em lotes pequenos com delay e retry para evitar rate limit
async function deleteWithThrottle(entityClient, ids) {
  let removed = 0;
  for (const id of ids) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        await entityClient.delete(id);
        removed++;
        break;
      } catch (e) {
        attempts++;
        const isRateLimit = e?.status === 429 || (e?.message || '').includes('Rate limit');
        if (isRateLimit && attempts < 3) {
          await sleep(2000 * attempts); // backoff exponencial
        } else {
          break; // não trava o batch por causa de 1 erro
        }
      }
    }
    await sleep(120); // ~8 deletes/seg — bem abaixo do limite
  }
  return removed;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;
    const results = {};

    // 1. NotaFiscal
    const nfs = await svc.NotaFiscal.list('-created_date', 5000);
    await sleep(300);
    const nfDups = dedup(nfs, r => r.tipo && r.numero ? `${r.tipo}|${String(r.numero).trim()}` : null);
    results.NotaFiscal = await deleteWithThrottle(svc.NotaFiscal, nfDups);
    await sleep(500);

    // 2. LancamentoBancario — chave contábil: data + valor + conta_bancaria
    const lanc = await svc.LancamentoBancario.list('-created_date', 10000);
    await sleep(300);
    const lancDups = dedup(lanc, r => r.data && r.valor != null
      ? `${r.data}|${Number(r.valor).toFixed(2)}|${r.conta_bancaria || ''}`
      : null);
    results.LancamentoBancario = await deleteWithThrottle(svc.LancamentoBancario, lancDups);
    await sleep(500);

    // 3. ItemCompra
    const comp = await svc.ItemCompra.list('-created_date', 5000);
    await sleep(300);
    const compDups = dedup(comp, r => r.fornecedor && r.descricao_produto
      ? `${(r.fornecedor||'').trim()}|${(r.numero_nota||'').trim()}|${(r.descricao_produto||'').trim()}`
      : null);
    results.ItemCompra = await deleteWithThrottle(svc.ItemCompra, compDups);
    await sleep(500);

    // 4. TituloCobranca
    const tit = await svc.TituloCobranca.list('-created_date', 5000);
    await sleep(300);
    const titDups = dedup(tit, r => r.nosso_numero ? String(r.nosso_numero).trim() : null);
    results.TituloCobranca = await deleteWithThrottle(svc.TituloCobranca, titDups);
    await sleep(500);

    // 5. RelatorioFaturamento
    const rel = await svc.RelatorioFaturamento.list('-created_date', 1000);
    await sleep(300);
    const relDups = dedup(rel, r => r.mes ? String(r.mes).trim() : null);
    results.RelatorioFaturamento = await deleteWithThrottle(svc.RelatorioFaturamento, relDups);
    await sleep(500);

    // 6. ConciliacaoItem
    const conc = await svc.ConciliacaoItem.list('-created_date', 5000);
    await sleep(300);
    const concDups = dedup(conc, r => r.mes_referencia && r.data_extrato && r.desc_extrato
      ? `${r.mes_referencia}|${r.data_extrato}|${(r.desc_extrato||'').trim()}|${Number(r.valor_extrato||0).toFixed(2)}`
      : null);
    results.ConciliacaoItem = await deleteWithThrottle(svc.ConciliacaoItem, concDups);

    const total = Object.values(results).reduce((s, v) => s + v, 0);

    return Response.json({ success: true, removed: results, total });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});