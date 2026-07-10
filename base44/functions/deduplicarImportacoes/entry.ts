import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Deduplica registros mantendo o mais antigo.
// Se preferKeepFn for fornecido, mantém o registro que ele indicar como "melhor" (mais completo).
function dedup(records, keyFn, preferKeepFn) {
  const seen = new Map();
  const toDelete = [];
  const sorted = [...records].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
  for (const r of sorted) {
    const key = keyFn(r);
    if (!key) continue;
    if (seen.has(key)) {
      const prev = seen.get(key);
      if (preferKeepFn && preferKeepFn(r, prev.record) > 0) {
        // r é melhor → descarta o anterior, mantém r
        toDelete.push(prev.id);
        seen.set(key, { id: r.id, record: r });
      } else {
        toDelete.push(r.id);
      }
    } else {
      seen.set(key, { id: r.id, record: r });
    }
  }
  return toDelete;
}

// Score de completude para NotaFiscal: prioriza registros com vendedor real, canal e status preenchidos
function scoreNotaFiscal(r) {
  let s = 0;
  if (r.vendedor && r.vendedor !== 'Fat.Direto' && r.vendedor !== 'Fat. Direto') s += 10;
  if (r.canal_cobranca) s += 5;
  if (r.data_vencimento_proxima) s += 3;
  if (r.status && r.status !== 'aberto') s += 2;
  return s;
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
          await sleep(2000 * attempts);
        } else {
          break;
        }
      }
    }
    await sleep(120);
  }
  return removed;
}

// Configuração das entidades a deduplicar — chaves contábeis únicas por entidade
const ENTITIES_CONFIG = [
  {
    name: 'NotaFiscal',
    // Normaliza tipo: NFe ≡ NF (ambos são nota fiscal)
    keyFn: r => {
      if (!r.numero) return null;
      const tipoNorm = (r.tipo === 'NFe' || r.tipo === 'NF') ? 'NF' : (r.tipo || '');
      return `${tipoNorm}|${String(r.numero).trim()}`;
    },
    preferKeepFn: (a, b) => scoreNotaFiscal(a) - scoreNotaFiscal(b),
  },
  {
    name: 'LancamentoBancario',
    // descricao normalizada na chave — dois PIX no mesmo dia com o mesmo valor
    // mas descrições diferentes são lançamentos DISTINTOS (não deletar).
    keyFn: r => r.data && r.valor != null
      ? `${r.data}|${Number(r.valor).toFixed(2)}|${(r.descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30)}`
      : null,
  },
  {
    name: 'ItemCompra',
    keyFn: r => r.fornecedor && r.descricao_produto
      ? `${(r.fornecedor||'').trim()}|${(r.numero_nota||'').trim()}|${(r.descricao_produto||'').trim()}`
      : null,
  },
  {
    name: 'TituloCobranca',
    // Chave canônica idêntica à de lib/deduplicationEngine.js e functions/deduplicarTitulosCobranca
    keyFn: r => {
      const extractNFCI = (val) => {
        if (!val) return null;
        const s = String(val).toUpperCase().trim();
        const m = s.match(/(NF|CI)[\s\-]*0*(\d+)/);
        if (m) return `${m[1]}-${m[2]}`;
        const num = s.match(/^0*(\d+)(?:[\/\-]\d+)?$/);
        return num ? `NF-${num[1]}` : null;
      };
      const extractParcela = (nn) => {
        if (!nn) return null;
        const m = String(nn).match(/[\/\-](\d+)$/);
        return m ? parseInt(m[1]) : null;
      };
      const nfRef = extractNFCI(r.seu_numero) || extractNFCI(r.nosso_numero);
      const parcela = r.parcela_numero || extractParcela(r.nosso_numero);
      if (nfRef && parcela) return `nf:${nfRef}|p:${parcela}`;
      if (r.cliente && r.data_vencimento && r.valor_titulo != null) {
        const cli = String(r.cliente).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
        const cents = Math.round(Number(r.valor_titulo) * 100);
        return `cli:${cli}|v:${r.data_vencimento}|val:${cents}`;
      }
      return null;
    },
    // Preferir registro com mais info (seu_numero canônico, parcela, vinculado a NF, pago com valor)
    preferKeepFn: (a, b) => {
      const score = (r) => {
        let s = 0;
        if (r.seu_numero && /NF|CI/i.test(r.seu_numero)) s += 10;
        if (r.parcela_numero && r.parcela_total) s += 8;
        if (r.nota_fiscal_id) s += 6;
        if (r.nosso_numero && !String(r.nosso_numero).startsWith('BOL-')) s += 4;
        if (r.status === 'pago' && r.valor_pago > 0) s += 5;
        return s;
      };
      return score(a) - score(b);
    },
  },
  {
    name: 'RelatorioFaturamento',
    keyFn: r => r.mes ? String(r.mes).trim() : null,
  },
  {
    name: 'ConciliacaoItem',
    keyFn: r => r.mes_referencia && r.data_extrato && r.desc_extrato
      ? `${r.mes_referencia}|${r.data_extrato}|${(r.desc_extrato||'').trim()}|${Number(r.valor_extrato||0).toFixed(2)}`
      : null,
  },
  {
    name: 'DespesaOperacional',
    keyFn: r => r.data && r.descricao && r.valor != null
      ? `${r.data}|${(r.descricao||'').trim().toLowerCase()}|${Number(r.valor).toFixed(2)}`
      : null,
  },
  {
    name: 'FaturaCartao',
    keyFn: r => r.conta_cartao_id && r.mes_referencia
      ? `${r.conta_cartao_id}|${r.mes_referencia}`
      : null,
  },
  {
    name: 'LancamentoCartao',
    keyFn: r => r.fatura_id && r.data_lancamento && r.estabelecimento && r.valor != null
      ? `${r.fatura_id}|${r.data_lancamento}|${(r.estabelecimento||'').trim().toLowerCase()}|${Number(r.valor).toFixed(2)}`
      : null,
  },
  {
    name: 'FolhaPagamento',
    keyFn: r => r.funcionario_nome && r.competencia
      ? `${(r.funcionario_nome||'').trim().toLowerCase()}|${r.competencia}`
      : null,
  },
  {
    name: 'Tributo',
    keyFn: r => r.tipo && r.competencia && r.empresa
      ? `${r.tipo}|${r.competencia}|${r.empresa}`
      : null,
  },
  {
    name: 'ObraReforma',
    keyFn: r => r.data && r.responsavel && r.valor != null
      ? `${r.data}|${(r.responsavel||'').trim().toLowerCase()}|${Number(r.valor).toFixed(2)}`
      : null,
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Aceita parâmetro opcional `only` para limitar a uma entidade específica (importações)
    let body = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const only = body?.only ? (Array.isArray(body.only) ? body.only : [body.only]) : null;

    const svc = base44.asServiceRole.entities;
    const results = {};
    const targets = only ? ENTITIES_CONFIG.filter(c => only.includes(c.name)) : ENTITIES_CONFIG;

    for (const cfg of targets) {
      try {
        const records = await svc[cfg.name].list('-created_date', 10000);
        await sleep(300);
        const dups = dedup(records, cfg.keyFn, cfg.preferKeepFn);
        results[cfg.name] = await deleteWithThrottle(svc[cfg.name], dups);
        await sleep(400);
      } catch (e) {
        results[cfg.name] = 0;
      }
    }

    const total = Object.values(results).reduce((s, v) => s + v, 0);

    return Response.json({ success: true, removed: results, total });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});