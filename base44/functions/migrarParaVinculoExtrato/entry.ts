import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

/**
 * Migração ONE-SHOT: converte vínculos legados em VinculoExtrato e recalcula
 * status_conciliacao + vinculos_count + valor_conciliado em LancamentoBancario.
 *
 * Idempotente — ignora vínculos já existentes.
 * Usa bulkCreate + delays para respeitar rate limit.
 *
 * Payload: { desde_data?: "YYYY-MM-DD", apenas_recalcular?: boolean }
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const desdeData = body.desde_data || '2025-01-01';
    const apenasRecalcular = !!body.apenas_recalcular;

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

    // 1) Carregar dados em sequência com delay (evita rate limit)
    const lancamentos = await svc.LancamentoBancario.list('-data', 5000);
    await sleep(200);
    const itens = await svc.ItemCompra.list('-data_emissao', 5000);
    await sleep(200);
    const concilItems = await svc.ConciliacaoItem.list('-data_extrato', 2000);
    await sleep(200);
    const tributos = await svc.Tributo.filter({ status: 'pago' }, '-data_pagamento', 2000);
    await sleep(200);
    const folhas = await svc.FolhaPagamento.filter({ status: 'pago' }, '-data_pagamento', 2000);
    await sleep(200);
    const despesas = await svc.DespesaOperacional.filter({ status: 'pago' }, '-data', 2000);
    await sleep(200);
    const obras = await svc.ObraReforma.list('-data', 2000);
    await sleep(200);
    const faturas = await svc.FaturaCartao.filter({ status: 'paga_total' }, '-data_pagamento', 500);
    await sleep(200);
    const vinculosExistentes = await svc.VinculoExtrato.list('-created_date', 20000).catch(() => []);

    const lancMap = new Map(lancamentos.map(l => [l.id, l]));
    const key = (lancId, tipo, entId) => `${lancId}|${tipo}|${entId}`;
    const jaExiste = new Set(vinculosExistentes.map(v => key(v.lancamento_bancario_id, v.entidade_tipo, v.entidade_id)));

    // Acumula vínculos para criar em lote
    const novosVinculos = [];
    const tracker = []; // [{ key, statKey }]

    function acumularVinculo(lancId, tipo, entId, valor, tipoVinculo, confianca, statKey) {
      if (!lancId || !entId) return;
      if (!lancMap.has(lancId)) return;
      const k = key(lancId, tipo, entId);
      if (jaExiste.has(k)) { stats.ja_existentes++; return; }
      jaExiste.add(k); // evita duplicata dentro deste mesmo run
      novosVinculos.push({
        lancamento_bancario_id: lancId,
        entidade_tipo: tipo,
        entidade_id: entId,
        valor_alocado: Math.abs(valor || 0),
        tipo_vinculo: tipoVinculo,
        conciliado_por: 'migracao',
        confianca,
      });
      tracker.push({ statKey });
    }

    if (!apenasRecalcular) {
      // (1) ItemCompra.lancamento_bancario_id → VinculoExtrato
      for (const it of itens) {
        if (!it.lancamento_bancario_id) continue;
        if (it.data_emissao && it.data_emissao < desdeData) continue;
        acumularVinculo(it.lancamento_bancario_id, 'ItemCompra', it.id, it.valor_pago || it.valor_total, 'pagamento_integral', 100, 'item_compra');
      }

      // (2) ConciliacaoItem → VinculoExtrato(NotaFiscal)
      for (const ci of concilItems) {
        if (!ci.lancamento_bancario_id) continue;
        if (ci.data_extrato && ci.data_extrato < desdeData) continue;
        const nfIds = Array.isArray(ci.nota_fiscal_ids) ? ci.nota_fiscal_ids : [];
        for (const nfId of nfIds) {
          const valor = nfIds.length > 0 ? (ci.valor_extrato || 0) / nfIds.length : ci.valor_extrato;
          acumularVinculo(ci.lancamento_bancario_id, 'NotaFiscal', nfId, valor, 'recebimento_integral', 95, 'conciliacao_item');
        }
      }

      // (3) Match automático para obrigações marcadas como pagas
      // Fallback: se data_pagamento está nula, usar data principal da obrigação
      const debitos = lancamentos.filter(l => l.valor < 0 && l.data >= desdeData);

      // Set para evitar usar o mesmo lançamento p/ múltiplas obrigações
      const lancsUsados = new Set();

      function matchAuto(registros, entidadeTipo, getValor, getData, tolerancia, janelaDias, statKey) {
        for (const r of registros) {
          const valorObrig = getValor(r);
          const dataObrig = getData(r);
          if (!valorObrig || !dataObrig) continue;
          // Procura melhor candidato (menor diff de data) dentro da janela
          let melhor = null;
          let melhorDiff = Infinity;
          for (const l of debitos) {
            if (lancsUsados.has(l.id)) continue;
            if (Math.abs(Math.abs(l.valor) - valorObrig) > tolerancia) continue;
            const diff = Math.abs(new Date(l.data) - new Date(dataObrig)) / 86400000;
            if (diff > janelaDias) continue;
            if (diff < melhorDiff) {
              melhor = l;
              melhorDiff = diff;
            }
          }
          if (melhor) {
            acumularVinculo(melhor.id, entidadeTipo, r.id, valorObrig, 'pagamento_integral', 70, statKey);
            lancsUsados.add(melhor.id);
          }
        }
      }

      // Tributo: data_pagamento se houver, senão data_vencimento
      matchAuto(tributos, 'Tributo',
        t => t.valor_pago || t.valor_original,
        t => t.data_pagamento || t.data_vencimento,
        1.00, 7, 'tributo_auto');

      // FolhaPagamento: data_pagamento OU dia 5 da competência seguinte
      matchAuto(folhas, 'FolhaPagamento',
        f => f.salario_liquido,
        f => {
          if (f.data_pagamento) return f.data_pagamento;
          const [y, m] = (f.competencia || '').split('-').map(Number);
          if (!y || !m) return null;
          // Pagamento típico: 5º dia útil do mês seguinte
          return new Date(y, m, 5).toISOString().slice(0, 10);
        },
        1.00, 15, 'folha_auto');

      // Despesa: data (despesas geralmente têm data = data do pagamento)
      matchAuto(despesas, 'DespesaOperacional',
        d => d.valor,
        d => d.data || d.data_vencimento,
        1.00, 7, 'despesa_auto');

      // Obra: data
      matchAuto(obras.filter(o => o.valor), 'ObraReforma',
        o => o.valor,
        o => o.data,
        1.00, 5, 'obra_auto');

      // Fatura cartão: data_pagamento OU data_vencimento
      matchAuto(faturas, 'FaturaCartao',
        f => f.valor_pago || f.valor_total,
        f => f.data_pagamento || f.data_vencimento,
        2.00, 5, 'fatura_auto');

      // (4) Inserir em lotes pequenos com retry em rate limit
      const BATCH = 25;
      for (let i = 0; i < novosVinculos.length; i += BATCH) {
        const slice = novosVinculos.slice(i, i + BATCH);
        const sliceTracker = tracker.slice(i, i + BATCH);
        let tentativas = 0;
        while (tentativas < 3) {
          try {
            await svc.VinculoExtrato.bulkCreate(slice);
            sliceTracker.forEach(t => stats[t.statKey]++);
            break;
          } catch (e) {
            tentativas++;
            if (tentativas >= 3) throw e;
            await sleep(2000 * tentativas);
          }
        }
        await sleep(800);
      }
    }

    // (5) Recalcular cache — em chunks com delay alto
    await sleep(1000);
    const todosVinculos = await svc.VinculoExtrato.list('-created_date', 20000);
    const porLanc = new Map();
    for (const v of todosVinculos) {
      const arr = porLanc.get(v.lancamento_bancario_id) || [];
      arr.push(v);
      porLanc.set(v.lancamento_bancario_id, arr);
    }

    const paraAtualizar = [];
    for (const lanc of lancamentos) {
      if (lanc.data < desdeData) continue;
      const vs = porLanc.get(lanc.id) || [];
      const valorConc = vs.reduce((s, v) => s + (v.valor_alocado || 0), 0);
      const valorAbs = Math.abs(lanc.valor || 0);
      let status = 'nao_conciliado';
      if (vs.length > 0) status = valorConc >= valorAbs - 0.5 ? 'conciliado' : 'parcial';
      if (lanc.status_conciliacao !== status || lanc.vinculos_count !== vs.length) {
        paraAtualizar.push({ id: lanc.id, status, vs_count: vs.length, valor_conc: valorConc });
      }
    }

    // Updates em chunks de 10 com delay longo + retry
    for (let i = 0; i < paraAtualizar.length; i += 10) {
      const chunk = paraAtualizar.slice(i, i + 10);
      for (const u of chunk) {
        let tentativas = 0;
        while (tentativas < 3) {
          try {
            await svc.LancamentoBancario.update(u.id, {
              status_conciliacao: u.status,
              vinculos_count: u.vs_count,
              valor_conciliado: u.valor_conc,
            });
            stats.lancamentos_atualizados++;
            break;
          } catch (e) {
            tentativas++;
            if (tentativas >= 3) break; // não trava o resto
            await sleep(2000 * tentativas);
          }
        }
        await sleep(150);
      }
      await sleep(1000);
    }

    // Resumo de cobertura
    const cobertura = {
      total: lancamentos.filter(l => l.data >= desdeData).length,
      conciliados: lancamentos.filter(l => l.data >= desdeData && (porLanc.get(l.id)?.length || 0) > 0).length,
    };

    return Response.json({ success: true, stats, cobertura });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});