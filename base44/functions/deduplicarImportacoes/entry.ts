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
    keyFn: r => r.tipo && r.numero ? `${r.tipo}|${String(r.numero).trim()}` : null,
  },
  {
    name: 'LancamentoBancario',
    keyFn: r => r.data && r.valor != null
      ? `${r.data}|${Number(r.valor).toFixed(2)}|${r.conta_bancaria || ''}`
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
    keyFn: r => r.nosso_numero ? String(r.nosso_numero).trim() : null,
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
        const dups = dedup(records, cfg.keyFn);
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