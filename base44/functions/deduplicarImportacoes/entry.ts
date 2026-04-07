import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Deduplica um array de registros por campos-chave, mantendo o mais antigo
function dedup(records, keyFn) {
  const seen = new Map();
  const toDelete = [];
  // Ordenar do mais antigo ao mais novo
  const sorted = [...records].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
  for (const r of sorted) {
    const key = keyFn(r);
    if (!key) continue;
    if (seen.has(key)) {
      toDelete.push(r.id); // delete o mais novo (r veio depois no sort)
    } else {
      seen.set(key, r.id);
    }
  }
  return toDelete;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const results = {};

  // 1. NotaFiscal — dedup por tipo+numero
  const nfs = await base44.entities.NotaFiscal.list();
  const nfDups = dedup(nfs, r => r.tipo && r.numero ? `${r.tipo}|${String(r.numero).trim()}` : null);
  for (const id of nfDups) await base44.entities.NotaFiscal.delete(id);
  results.NotaFiscal = nfDups.length;

  // 2. LancamentoBancario — dedup por data+valor+conta_bancaria
  const lanc = await base44.entities.LancamentoBancario.list();
  const lancDups = dedup(lanc, r => r.data && r.valor != null && r.conta_bancaria
    ? `${r.data}|${Number(r.valor).toFixed(2)}|${r.conta_bancaria}`
    : null);
  for (const id of lancDups) await base44.entities.LancamentoBancario.delete(id);
  results.LancamentoBancario = lancDups.length;

  // 3. ItemCompra — dedup por fornecedor+numero_nota+descricao_produto
  const comp = await base44.entities.ItemCompra.list();
  const compDups = dedup(comp, r => r.fornecedor && r.descricao_produto
    ? `${(r.fornecedor||'').trim()}|${(r.numero_nota||'').trim()}|${(r.descricao_produto||'').trim()}`
    : null);
  for (const id of compDups) await base44.entities.ItemCompra.delete(id);
  results.ItemCompra = compDups.length;

  // 4. TituloCobranca — dedup por nosso_numero
  const tit = await base44.entities.TituloCobranca.list();
  const titDups = dedup(tit, r => r.nosso_numero ? String(r.nosso_numero).trim() : null);
  for (const id of titDups) await base44.entities.TituloCobranca.delete(id);
  results.TituloCobranca = titDups.length;

  // 5. RelatorioFaturamento — dedup por mes
  const rel = await base44.entities.RelatorioFaturamento.list();
  const relDups = dedup(rel, r => r.mes ? String(r.mes).trim() : null);
  for (const id of relDups) await base44.entities.RelatorioFaturamento.delete(id);
  results.RelatorioFaturamento = relDups.length;

  // 6. ConciliacaoItem — dedup por mes_referencia+data_extrato+desc_extrato+valor_extrato
  const conc = await base44.entities.ConciliacaoItem.list();
  const concDups = dedup(conc, r => r.mes_referencia && r.data_extrato && r.desc_extrato
    ? `${r.mes_referencia}|${r.data_extrato}|${(r.desc_extrato||'').trim()}|${Number(r.valor_extrato||0).toFixed(2)}`
    : null);
  for (const id of concDups) await base44.entities.ConciliacaoItem.delete(id);
  results.ConciliacaoItem = concDups.length;

  const total = Object.values(results).reduce((s, v) => s + v, 0);

  if (total > 0) {
    // Disparar refresh
    // (frontend vai capturar via neuralfinRefresh)
  }

  return Response.json({ success: true, removed: results, total });
});