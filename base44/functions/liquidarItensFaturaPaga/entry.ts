import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Propagação de liquidação: quando uma FaturaCartao é paga (vinculada ao extrato),
// todos os débitos ligados aos itens dessa fatura são liquidados em cascata:
//   Extrato → Fatura (paga) → LancamentoCartao (fatura_id) → DespesaOperacional / ItemCompra / ObraReforma
// Idempotente: só atualiza o que ainda está pendente. Pode rodar por automação
// (fatura muda para paga_total) ou manualmente para o histórico (sem payload).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internoOk = !!body?.internal_token && body.internal_token === Deno.env.get('NEXUS_HUB_TOKEN');
    const isAutomacao = !!body?.event;
    if (!internoOk && !isAutomacao) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = base44.asServiceRole.entities;

    // Escopo: uma fatura específica (automação) ou todas as pagas (varredura)
    let faturasPagas;
    if (isAutomacao) {
      const fat = body.data || await svc.FaturaCartao.get(body.event.entity_id);
      if (!fat || fat.status !== 'paga_total') {
        return Response.json({ success: true, ignorado: 'fatura não está paga_total' });
      }
      faturasPagas = [fat];
    } else {
      const todas = await svc.FaturaCartao.list('-data_vencimento', 500);
      faturasPagas = todas.filter(f => f.status === 'paga_total');
    }

    const idsFaturas = new Set(faturasPagas.map(f => f.id));
    const dataPagPorFatura = new Map(faturasPagas.map(f => [f.id, f.data_pagamento]));

    const [lancCartao, despesas, compras, obras] = await Promise.all([
      svc.LancamentoCartao.list('-data_lancamento', 5000),
      svc.DespesaOperacional.list('-data', 3000),
      svc.ItemCompra.list('-data_emissao', 3000),
      svc.ObraReforma.list('-data', 2000),
    ]);

    const itensLiquidados = lancCartao.filter(l => idsFaturas.has(l.fatura_id));
    const itemPorId = new Map(itensLiquidados.map(l => [l.id, l]));

    let despesasBaixadas = 0, comprasBaixadas = 0, obrasConfirmadas = 0;
    const detalhes = [];

    // 1. Despesas pagas no cartão cuja fatura foi liquidada
    for (const d of despesas) {
      if (d.status === 'pago') continue;
      if (!d.lancamento_cartao_id || !itemPorId.has(d.lancamento_cartao_id)) continue;
      const item = itemPorId.get(d.lancamento_cartao_id);
      await svc.DespesaOperacional.update(d.id, {
        status: 'pago',
        data: dataPagPorFatura.get(item.fatura_id) || d.data,
        observacoes: `${d.observacoes ? d.observacoes + ' · ' : ''}Liquidada via pagamento da fatura do cartão`,
      });
      despesasBaixadas++;
      detalhes.push({ tipo: 'despesa', descricao: d.descricao, valor: d.valor });
    }

    // 2. Compras cujo item de cartão pertence a fatura liquidada
    for (const item of itensLiquidados) {
      if (!item.item_compra_id) continue;
      const compra = compras.find(c => c.id === item.item_compra_id);
      if (!compra || compra.status_pagamento === 'pago') continue;
      await svc.ItemCompra.update(compra.id, {
        status_pagamento: 'pago',
        valor_pago: compra.valor_total || 0,
      });
      comprasBaixadas++;
      detalhes.push({ tipo: 'compra', descricao: compra.descricao_produto || compra.numero_nota, valor: compra.valor_total });
    }

    // 3. Obras pagas no cartão — garante rastreio da data de liquidação via fatura
    for (const o of obras) {
      if (!o.lancamento_cartao_id || !itemPorId.has(o.lancamento_cartao_id)) continue;
      if (o.lancamento_bancario_id) continue; // já rastreada até o extrato
      const item = itemPorId.get(o.lancamento_cartao_id);
      const fatura = faturasPagas.find(f => f.id === item.fatura_id);
      if (!fatura?.lancamento_bancario_id) continue; // fatura paga em multi-débito: rastreio fica no VinculoExtrato da fatura
      await svc.ObraReforma.update(o.id, { lancamento_bancario_id: fatura.lancamento_bancario_id });
      obrasConfirmadas++;
    }

    return Response.json({
      success: true,
      faturas_processadas: faturasPagas.length,
      itens_cartao_cobertos: itensLiquidados.length,
      despesas_baixadas: despesasBaixadas,
      compras_baixadas: comprasBaixadas,
      obras_rastreadas: obrasConfirmadas,
      detalhes: detalhes.slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});