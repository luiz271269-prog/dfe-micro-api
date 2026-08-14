import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Panorama financeiro consolidado para o agente (WhatsApp / chat).
// Retorna, em UM payload, a verdade do "geral da empresa":
//   - CONTAS A RECEBER (NotaFiscal a_vencer/parcial/vencido + TituloCobranca em aberto)
//   - CONTAS A PAGAR (DespesaOperacional, Tributo, FolhaPagamento, FaturaCartao, ItemCompra) — todas as origens
//   - INADIMPLÊNCIA (títulos/NFs vencidos)
//   - FLUXO DE CAIXA da semana (entradas previstas - saídas previstas)
//
// Tudo já filtrado por janelas de data (semana atual e próxima semana), pronto para o relatório.
// Payload opcional: { data_referencia: 'YYYY-MM-DD' } — default: hoje (America/Sao_Paulo).

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function addDias(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
// Início da semana (segunda) e fim (domingo) de uma data
function semanaDe(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=dom
  const diffParaSegunda = dow === 0 ? -6 : 1 - dow;
  const inicio = addDias(dateStr, diffParaSegunda);
  const fim = addDias(inicio, 6);
  return { inicio, fim };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Hoje em America/Sao_Paulo
    const hoje = body.data_referencia || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

    const svc = base44.asServiceRole.entities;
    const [
      notas, titulos,
      despesas, tributos, folhas, faturas, cartoes, compras,
      vinculos,
    ] = await Promise.all([
      svc.NotaFiscal.list('-data_vencimento_proxima', 5000),
      svc.TituloCobranca.list('-data_vencimento', 10000),
      svc.DespesaOperacional.list('-data_vencimento', 3000),
      svc.Tributo.list('-data_vencimento', 2000),
      svc.FolhaPagamento.list('-competencia', 2000),
      svc.FaturaCartao.list('-data_vencimento', 1000),
      svc.ContaCartao.list(),
      svc.ItemCompra.list('-data_emissao', 5000),
      svc.VinculoExtrato.list('-created_date', 10000),
    ]);

    const cartaoPorId = new Map(cartoes.map(c => [c.id, c]));
    const semanaAtual = semanaDe(hoje);
    const semanaProx = semanaDe(addDias(semanaAtual.fim, 1));

    // ─────────── CONTAS A RECEBER ───────────
    // Usa TituloCobranca em aberto (granularidade por parcela com vencimento).
    const titulosAbertos = titulos.filter(t => t.status === 'em_aberto' || t.status === 'vencido');
    const recebiveis = titulosAbertos.map(t => ({
      origem: 'titulo',
      id: t.id,
      cliente: t.cliente,
      nf: t.seu_numero || t.nosso_numero,
      canal: t.canal_cobranca,
      valor: (t.valor_titulo || 0) - (t.valor_pago || 0),
      data_vencimento: t.data_vencimento,
    })).filter(r => r.valor > 0.01);

    const dentro = (dv, ini, fim) => dv && dv >= ini && dv <= fim;
    const receberSemana = recebiveis.filter(r => dentro(r.data_vencimento, semanaAtual.inicio, semanaAtual.fim));
    const receberProxSemana = recebiveis.filter(r => dentro(r.data_vencimento, semanaProx.inicio, semanaProx.fim));

    // Inadimplência: vencido antes de hoje
    const inadimplentes = recebiveis.filter(r => r.data_vencimento && r.data_vencimento < hoje);
    const inadimplenciaPorCliente = {};
    inadimplentes.forEach(r => {
      const k = r.cliente || '—';
      if (!inadimplenciaPorCliente[k]) inadimplenciaPorCliente[k] = { cliente: k, valor: 0, titulos: 0, mais_antigo: r.data_vencimento };
      inadimplenciaPorCliente[k].valor += r.valor;
      inadimplenciaPorCliente[k].titulos += 1;
      if (r.data_vencimento < inadimplenciaPorCliente[k].mais_antigo) inadimplenciaPorCliente[k].mais_antigo = r.data_vencimento;
    });
    const inadimplenciaRank = Object.values(inadimplenciaPorCliente)
      .map(c => ({ ...c, dias_atraso: Math.round((new Date(hoje) - new Date(c.mais_antigo)) / 86400000) }))
      .sort((a, b) => b.valor - a.valor);

    // ─────────── CONTAS A PAGAR (todas as origens) ───────────
    const contasPagar = [];
    despesas.filter(d => d.status === 'pendente').forEach(d => contasPagar.push({
      origem: 'despesa', id: d.id, descricao: d.descricao, fornecedor: d.fornecedor || '—',
      valor: d.valor, data_vencimento: d.data_vencimento || d.data, empresa: d.empresa,
    }));
    tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido').forEach(t => contasPagar.push({
      origem: 'tributo', id: t.id, descricao: t.descricao || `${t.tipo} ${t.competencia}`, fornecedor: 'Receita / Governo',
      valor: (t.valor_original || 0) - (t.valor_pago || 0), data_vencimento: t.data_vencimento, empresa: t.empresa,
    }));
    folhas.filter(f => f.status === 'pendente').forEach(f => {
      const [y, m] = (f.competencia || '').split('-').map(Number);
      const venc = y && m ? new Date(Date.UTC(y, m, 5)).toISOString().slice(0, 10) : null;
      contasPagar.push({
        origem: 'folha', id: f.id, descricao: `Salário — ${f.funcionario_nome}`, fornecedor: f.funcionario_nome,
        valor: f.salario_liquido, data_vencimento: venc, empresa: f.empresa,
      });
    });
    faturas.filter(f => f.status === 'aberta' || f.status === 'vencida').forEach(f => {
      const c = cartaoPorId.get(f.conta_cartao_id);
      contasPagar.push({
        origem: 'fatura', id: f.id, descricao: `Fatura ${c?.nome || 'Cartão'} — ${f.mes_referencia}`, fornecedor: c?.nome || 'Cartão',
        valor: (f.valor_total || 0) - (f.valor_pago || 0), data_vencimento: f.data_vencimento, empresa: c?.empresa_vinculada || '—',
      });
    });
    compras
      .filter(c => c.status_pagamento === 'pendente' || c.status_pagamento === 'parcial' || c.status_pagamento === 'nao_identificado')
      .forEach(c => {
        const aberto = (c.valor_total || 0) - (c.valor_pago || 0);
        if (aberto <= 0.01) return;
        contasPagar.push({
          origem: 'compra', id: c.id, descricao: c.descricao_produto || `Compra NF ${c.numero_nota || ''}`.trim(),
          fornecedor: c.fornecedor || '—', valor: aberto, data_vencimento: c.data_emissao, empresa: c.empresa || '—',
        });
      });

    const pagarSemana = contasPagar.filter(c => dentro(c.data_vencimento, semanaAtual.inicio, semanaAtual.fim));
    const pagarProxSemana = contasPagar.filter(c => dentro(c.data_vencimento, semanaProx.inicio, semanaProx.fim));
    const pagarVencido = contasPagar.filter(c => c.data_vencimento && c.data_vencimento < hoje);

    const soma = arr => arr.reduce((s, x) => s + (x.valor || 0), 0);
    const totalPagarPorOrigem = {};
    contasPagar.forEach(c => { totalPagarPorOrigem[c.origem] = (totalPagarPorOrigem[c.origem] || 0) + c.valor; });

    // ─────────── FLUXO DE CAIXA (semana) ───────────
    const entradasSemana = soma(receberSemana);
    const saidasSemana = soma(pagarSemana);

    return Response.json({
      data_referencia: hoje,
      semana_atual: semanaAtual,
      proxima_semana: semanaProx,

      contas_a_receber: {
        total_em_aberto: Math.round(soma(recebiveis) * 100) / 100,
        semana: { total: Math.round(entradasSemana * 100) / 100, itens: receberSemana.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')) },
        proxima_semana: { total: Math.round(soma(receberProxSemana) * 100) / 100, itens: receberProxSemana.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')) },
      },

      inadimplencia: {
        total: Math.round(soma(inadimplentes) * 100) / 100,
        titulos: inadimplentes.length,
        clientes: inadimplenciaRank.length,
        ranking: inadimplenciaRank.slice(0, 15),
      },

      contas_a_pagar: {
        total_em_aberto: Math.round(soma(contasPagar) * 100) / 100,
        por_origem: totalPagarPorOrigem,
        vencido: { total: Math.round(soma(pagarVencido) * 100) / 100, itens: pagarVencido.length },
        semana: { total: Math.round(saidasSemana * 100) / 100, itens: pagarSemana.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')) },
        proxima_semana: { total: Math.round(soma(pagarProxSemana) * 100) / 100, itens: pagarProxSemana.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')) },
      },

      fluxo_caixa_semana: {
        entradas_previstas: Math.round(entradasSemana * 100) / 100,
        saidas_previstas: Math.round(saidasSemana * 100) / 100,
        saldo_previsto: Math.round((entradasSemana - saidasSemana) * 100) / 100,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});