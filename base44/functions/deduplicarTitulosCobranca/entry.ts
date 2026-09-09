import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────
// Helpers de chave canônica — mesma lógica em lib/deduplicationEngine.js
// e functions/deduplicarImportacoes. Mantenha as três em sincronia.
// ─────────────────────────────────────────────────────────────────────
function extractNFCIRef(value) {
  if (!value) return null;
  const s = String(value).toUpperCase().trim();
  const m = s.match(/(NF|CI)[\s\-]*0*(\d+)/);
  if (m) return `${m[1]}-${m[2]}`;
  const num = s.match(/^0*(\d+)(?:[\/\-]\d+)?$/);
  if (num) return `NF-${num[1]}`;
  return null;
}

function extractParcelaFromNosso(nossoNum) {
  if (!nossoNum) return null;
  const m = String(nossoNum).match(/[\/\-](\d+)$/);
  return m ? parseInt(m[1]) : null;
}

function normalizeCliente(c) {
  return (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
}

function tituloKey(r) {
  const nfRef = extractNFCIRef(r.seu_numero) || extractNFCIRef(r.nosso_numero);
  const parcela = r.parcela_numero || extractParcelaFromNosso(r.nosso_numero);
  const totalParcelas = r.parcela_total || parcela;
  if (!r.cliente || !nfRef || !parcela || !r.data_vencimento || r.valor_titulo == null) return null;
  return [
    `cli:${normalizeCliente(r.cliente)}`,
    `nf:${nfRef}`,
    `p:${parcela}/${totalParcelas}`,
    `v:${r.data_vencimento}`,
    `val:${Math.round(Number(r.valor_titulo) * 100)}`,
  ].join('|');
}

// Score de completude — mais informação → maior score → vence
function scoreTitulo(r) {
  let s = 0;
  if (r.seu_numero && /NF|CI/i.test(r.seu_numero)) s += 10;
  if (r.parcela_numero && r.parcela_total) s += 8;
  if (r.nota_fiscal_id) s += 6;
  if (r.nosso_numero && !String(r.nosso_numero).startsWith('BOL-')) s += 4;
  if (r.status === 'pago' && r.valor_pago > 0) s += 5;
  if (r.canal_cobranca) s += 1;
  return s;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Lê toda a carteira de cobrança via service role — restrito a admin, inclusive no dry_run
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run !== false; // default TRUE — segurança máxima

    const svc = base44.asServiceRole.entities;
    const titulos = await svc.TituloCobranca.list('-created_date', 10000);

    // Agrupa por chave canônica
    const groups = new Map();
    let semChave = 0;
    for (const t of titulos) {
      const key = tituloKey(t);
      if (!key) { semChave++; continue; }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }

    // Filtra apenas grupos com duplicatas e calcula vencedor + merge
    const dupGroups = [];
    for (const [key, items] of groups) {
      if (items.length <= 1) continue;
      const sorted = [...items].sort((a, b) => {
        const sa = scoreTitulo(a), sb = scoreTitulo(b);
        if (sa !== sb) return sb - sa;
        return (a.created_date || '').localeCompare(b.created_date || '');
      });
      const winner = sorted[0];
      const losers = sorted.slice(1);

      // Merge: se algum loser está "pago" e winner não, copia dados de pagamento
      let mergeUpdate = null;
      if (winner.status !== 'pago' || !winner.valor_pago) {
        const paid = losers.find(l => l.status === 'pago' && (l.valor_pago || 0) > 0);
        if (paid) {
          mergeUpdate = {
            status: 'pago',
            data_pagamento: paid.data_pagamento,
            valor_pago: paid.valor_pago,
          };
        }
      }

      dupGroups.push({
        key,
        winner: {
          id: winner.id,
          nosso_numero: winner.nosso_numero,
          seu_numero: winner.seu_numero,
          cliente: winner.cliente,
          data_vencimento: winner.data_vencimento,
          valor_titulo: winner.valor_titulo,
          parcela_numero: winner.parcela_numero,
          parcela_total: winner.parcela_total,
          status: winner.status,
          score: scoreTitulo(winner),
        },
        losers: losers.map(l => ({
          id: l.id,
          nosso_numero: l.nosso_numero,
          status: l.status,
          valor_pago: l.valor_pago,
          data_pagamento: l.data_pagamento,
          score: scoreTitulo(l),
        })),
        merge_update: mergeUpdate,
      });
    }

    const totalApagar = dupGroups.reduce((s, g) => s + g.losers.length, 0);
    const totalMerge = dupGroups.filter(g => g.merge_update).length;

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_titulos: titulos.length,
        sem_chave: semChave,
        grupos_com_duplicatas: dupGroups.length,
        total_para_apagar: totalApagar,
        total_para_mesclar: totalMerge,
        grupos: dupGroups,
      });
    }

    // EXECUÇÃO REAL (apaga registros) — admin já validado no início
    let apagados = 0, atualizados = 0, erros = 0;
    for (const g of dupGroups) {
      // 1. Atualiza winner se há merge
      if (g.merge_update) {
        try {
          await svc.TituloCobranca.update(g.winner.id, g.merge_update);
          atualizados++;
          await sleep(120);
        } catch {
          erros++;
        }
      }
      // 2. Deleta losers com throttle e retry
      for (const l of g.losers) {
        let attempts = 0;
        while (attempts < 3) {
          try {
            await svc.TituloCobranca.delete(l.id);
            apagados++;
            break;
          } catch (e) {
            attempts++;
            const isRate = e?.status === 429 || (e?.message || '').includes('Rate limit');
            if (isRate && attempts < 3) {
              await sleep(2000 * attempts);
            } else {
              erros++;
              break;
            }
          }
        }
        await sleep(120);
      }
    }

    return Response.json({
      dry_run: false,
      grupos_processados: dupGroups.length,
      apagados,
      atualizados,
      erros,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});