import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Migração ONE-SHOT: converte vínculos legados em VinculoExtrato e recalcula
 * status_conciliacao + vinculos_count + valor_conciliado em LancamentoBancario.
 *
 * Só roda para admins. Idempotente — ignora vínculos já existentes (match por lancamento_bancario_id + entidade_tipo + entidade_id).
 *
 * Fontes migradas:
 *  1) ItemCompra.lancamento_bancario_id  → VinculoExtrato(entidade_tipo=ItemCompra)
 *  2) ConciliacaoItem.lancamento_bancario_id + nota_fiscal_ids[] → VinculoExtrato(NotaFiscal)
 *  3) Match automático (status=pago + valor ± tolerância) para Tributo, FolhaPagamento,
 *     DespesaOperacional, ObraReforma, FaturaCartao — confianca=70 (precisa revisão manual).
 *
 * Payload opcional: { desde_data: "YYYY-MM-DD" } — limita escopo.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const desdeData = body.desde_data || '2025-01-01';

    const stats = {
      item_compra: 0,
      conciliacao_item: 0,
      tributo_auto: 0,
      folha_auto: 0,
      despesa_auto: 0,
      obra_auto: 0,
      fatura_auto: 0,
      ja_existentes: 0,
      lancamentos_atualizados: 0,
    };

    const svc = base44.asServiceRole.entities;

    // Carregar tudo que vai ser necessário
    const [lancamentos, itens, concilItems, tributos, folhas, despesas, obras, faturas, vinculosExistentes] = await Promise.all([
      svc.LancamentoBancario.list('-data', 5000),
      svc.ItemCompra.list('-data_emissao', 5000),
      svc.ConciliacaoItem.list('-data_extrato', 2000),
      svc.Tributo.filter({ status: 'pago' }, '-data_pagamento', 2000),
      svc.FolhaPagamento.filter({ status: 'pago' }, '-data_pagamento', 2000),
      svc.DespesaOperacional.filter({ status: 'pago' }, '-data', 2000),
      svc.ObraReforma.list('-data', 2000),
      svc.FaturaCartao.filter({ status: 'paga_total' }, '-data_pagamento', 500),
      svc.VinculoExtrato.list('-created_date', 10000).catch(() => []),
    ]);

    const lancMap = new Map(lancamentos.map(l => [l.id, l]));
    const key = (lancId, tipo, entId) => `${lancId}|${tipo}|${entId}`;
    const jaExiste = new Set(vinculosExistentes.map(v => key(v.lancamento_bancario_id, v.entidade_tipo, v.entidade_id)));

    async function criarVinculo(lancId, tipo, entId, valor, tipoVinculo = 'pagamento_integral', confianca = 100) {
      if (!lancId || !entId) return false;
      if (!lancMap.has(lancId)) return false;
      const k = key(lancId, tipo, entId);
      if (jaExiste.has(k)) { stats.ja_existentes++; return false; }
      await svc.VinculoExtrato.create({
        lancamento_bancario_id: lancId,
        entidade_tipo: tipo,
        entidade_id: entId,
        valor_alocado: Math.abs(valor || 0),
        tipo_vinculo: tipoVinculo,
        conciliado_por: 'migracao',
        confianca,
      });
      jaExiste.add(k);
      return true;
    }

    // 1) ItemCompra.lancamento_bancario_id → VinculoExtrato
    for (const it of itens) {
      if (!it.lancamento_bancario_id) continue;
      if (it.data_emissao && it.data_emissao < desdeData) continue;
      const ok = await criarVinculo(it.lancamento_bancario_id, 'ItemCompra', it.id, it.valor_pago || it.valor_total, 'pagamento_integral', 100);
      if (ok) stats.item_compra++;
    }

    // 2) ConciliacaoItem → VinculoExtrato(NotaFiscal)
    for (const ci of concilItems) {
      if (!ci.lancamento_bancario_id) continue;
      if (ci.data_extrato && ci.data_extrato < desdeData) continue;
      const nfIds = Array.isArray(ci.nota_fiscal_ids) ? ci.nota_fiscal_ids : [];
      for (const nfId of nfIds) {
        const valor = nfIds.length > 0 ? (ci.valor_extrato || 0) / nfIds.length : ci.valor_extrato;
        const ok = await criarVinculo(ci.lancamento_bancario_id, 'NotaFiscal', nfId, valor, 'recebimento_integral', 95);
        if (ok) stats.conciliacao_item++;
      }
    }

    // 3) Matches automáticos — status=pago + valor ± tolerância + data próxima
    const debitos = lancamentos.filter(l => l.valor < 0 && l.data >= desdeData);

    // Helper genérico de match
    async function matchAuto(registros, entidadeTipo, getValor, getData, tolerancia, janelaDias, statFrom) {
      for (const r of registros) {
        const valorObrig = getValor(r);
        const dataObrig = getData(r);
        if (!valorObrig || !dataObrig) continue;
        const cand = debitos.find(l => {
          if (Math.abs(Math.abs(l.valor) - valorObrig) > tolerancia) return false;
          const diff = Math.abs(new Date(l.data) - new Date(dataObrig)) / 86400000;
          return diff <= janelaDias;
        });
        if (cand) {
          const ok = await criarVinculo(cand.id, entidadeTipo, r.id, valorObrig, 'pagamento_integral', 70);
          if (ok) stats[statFrom]++;
        }
      }
    }

    await matchAuto(tributos, 'Tributo', t => t.valor_pago || t.valor_original, t => t.data_pagamento, 0.50, 3, 'tributo_auto');
    await matchAuto(folhas, 'FolhaPagamento', f => f.salario_liquido, f => f.data_pagamento, 0.50, 5, 'folha_auto');
    await matchAuto(despesas, 'DespesaOperacional', d => d.valor, d => d.data, 0.50, 3, 'despesa_auto');
    await matchAuto(obras.filter(o => o.valor), 'ObraReforma', o => o.valor, o => o.data, 1.00, 3, 'obra_auto');
    await matchAuto(faturas, 'FaturaCartao', f => f.valor_pago || f.valor_total, f => f.data_pagamento, 1.00, 3, 'fatura_auto');

    // 4) Recalcular cache no LancamentoBancario (status_conciliacao, vinculos_count, valor_conciliado)
    const todosVinculos = await svc.VinculoExtrato.list('-created_date', 20000);
    const porLanc = new Map();
    for (const v of todosVinculos) {
      const arr = porLanc.get(v.lancamento_bancario_id) || [];
      arr.push(v);
      porLanc.set(v.lancamento_bancario_id, arr);
    }

    for (const lanc of lancamentos) {
      if (lanc.data < desdeData) continue;
      const vs = porLanc.get(lanc.id) || [];
      const valorConc = vs.reduce((s, v) => s + (v.valor_alocado || 0), 0);
      const valorAbs = Math.abs(lanc.valor || 0);
      let status = 'nao_conciliado';
      if (vs.length > 0) {
        status = valorConc >= valorAbs - 0.5 ? 'conciliado' : 'parcial';
      }
      if (lanc.status_conciliacao !== status || lanc.vinculos_count !== vs.length) {
        await svc.LancamentoBancario.update(lanc.id, {
          status_conciliacao: status,
          vinculos_count: vs.length,
          valor_conciliado: valorConc,
        });
        stats.lancamentos_atualizados++;
      }
    }

    return Response.json({ success: true, stats });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});