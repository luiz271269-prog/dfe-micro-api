import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Gera/regenera o Fluxo de Caixa PROJETADO a partir das obrigações em aberto:
//   ENTRADAS: TituloCobranca em_aberto/vencido
//   SAÍDAS:   Tributo a_vencer · FaturaCartao aberta · DespesaOperacional pendente · FolhaPagamento pendente
// Idempotente: apaga previsões anteriores geradas automaticamente (origem_tipo != manual) e recria.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internoOk = !!body?.internal_token && body.internal_token === Deno.env.get('NEXUS_HUB_TOKEN');
    if (!internoOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = base44.asServiceRole.entities;

    // 1. Limpa previsões automáticas anteriores (mantém lançamentos manuais e realizados)
    await svc.FluxoCaixa.deleteMany({ status: 'previsto', origem_tipo: { $ne: 'manual' } });

    const [titulos, tributos, faturas, despesas, folhas, cartoes] = await Promise.all([
      svc.TituloCobranca.list('-data_vencimento', 3000),
      svc.Tributo.list('-data_vencimento', 500),
      svc.FaturaCartao.list('-data_vencimento', 200),
      svc.DespesaOperacional.list('-data', 1000),
      svc.FolhaPagamento.list('-competencia', 500),
      svc.ContaCartao.list(),
    ]);

    const registros = [];
    const mesRef = (d) => (d || '').slice(0, 7);

    // ENTRADAS — cobranças em aberto
    for (const t of titulos) {
      if (t.status === 'pago' || !t.data_vencimento) continue;
      registros.push({
        data_prevista: t.data_vencimento,
        tipo: 'entrada',
        categoria: 'recebimento_cobranca',
        descricao: `Cobrança ${t.nosso_numero || ''} · ${t.cliente}`,
        valor_previsto: t.valor_titulo || 0,
        status: 'previsto',
        origem_id: t.id,
        origem_tipo: 'titulo_cobranca',
        mes_referencia: mesRef(t.data_vencimento),
      });
    }

    // SAÍDAS — tributos a vencer
    for (const t of tributos) {
      if (t.status === 'pago' || !t.data_vencimento) continue;
      registros.push({
        data_prevista: t.data_vencimento,
        tipo: 'saida',
        categoria: 'pagamento_tributo',
        descricao: `${t.tipo} ${t.competencia} · ${t.descricao || ''}`.trim(),
        valor_previsto: t.valor_original || 0,
        status: 'previsto',
        origem_id: t.id,
        origem_tipo: 'tributo',
        empresa: t.empresa,
        mes_referencia: mesRef(t.data_vencimento),
      });
    }

    // SAÍDAS — faturas de cartão abertas
    const nomeCartao = (id) => cartoes.find(c => c.id === id)?.nome || 'Cartão';
    for (const f of faturas) {
      if (f.status === 'paga_total' || !f.data_vencimento) continue;
      registros.push({
        data_prevista: f.data_vencimento,
        tipo: 'saida',
        categoria: 'despesa_variavel',
        descricao: `Fatura ${nomeCartao(f.conta_cartao_id)} · ${f.mes_referencia}`,
        valor_previsto: (f.valor_total || 0) - (f.valor_pago || 0),
        status: 'previsto',
        origem_id: f.id,
        origem_tipo: 'manual',
        mes_referencia: mesRef(f.data_vencimento),
      });
    }

    // SAÍDAS — despesas pendentes/vencidas
    for (const d of despesas) {
      if (d.status === 'pago') continue;
      const dt = d.data_vencimento || d.data;
      if (!dt) continue;
      registros.push({
        data_prevista: dt,
        tipo: 'saida',
        categoria: 'despesa_fixa',
        descricao: `${d.descricao} · ${d.fornecedor || ''}`.trim(),
        valor_previsto: d.valor || 0,
        status: 'previsto',
        origem_id: d.id,
        origem_tipo: 'manual',
        empresa: d.empresa,
        mes_referencia: mesRef(dt),
      });
    }

    // SAÍDAS — folha pendente
    for (const f of folhas) {
      if (f.status !== 'pendente') continue;
      const dt = f.data_pagamento || `${f.competencia}-05`;
      registros.push({
        data_prevista: dt,
        tipo: 'saida',
        categoria: 'folha_pagamento',
        descricao: `Folha ${f.competencia} · ${f.funcionario_nome}`,
        valor_previsto: f.salario_liquido || 0,
        status: 'previsto',
        origem_id: f.id,
        origem_tipo: 'folha',
        empresa: f.empresa,
        mes_referencia: f.competencia,
      });
    }

    const validos = registros.filter(r => r.valor_previsto > 0);
    // cria em lotes de 100
    let criados = 0;
    for (let i = 0; i < validos.length; i += 100) {
      const lote = validos.slice(i, i + 100);
      await svc.FluxoCaixa.bulkCreate(lote);
      criados += lote.length;
    }

    const entradas = validos.filter(r => r.tipo === 'entrada').reduce((s, r) => s + r.valor_previsto, 0);
    const saidas = validos.filter(r => r.tipo === 'saida').reduce((s, r) => s + r.valor_previsto, 0);

    return Response.json({
      success: true,
      criados,
      entradas_previstas: +entradas.toFixed(2),
      saidas_previstas: +saidas.toFixed(2),
      saldo_projetado_movimentos: +(entradas - saidas).toFixed(2),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});