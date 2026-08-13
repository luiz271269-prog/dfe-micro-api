import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

// Envia o panorama financeiro semanal por email para os destinatários fixos.
// Reaproveita o cálculo de panoramaFinanceiroSemana (fonte única da verdade).
// Payload opcional: { data_referencia?: 'YYYY-MM-DD', destinatarios?: string[] }

const DESTINATARIOS_PADRAO = [
  'luiz271269@gmail.com',
  'financeiro@neursltec360.com.br',
];

function brl(n) {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function dataBR(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Cálculo do panorama (mesma lógica de panoramaFinanceiroSemana, com service role) ───
function ymd(d) { return d.toISOString().slice(0, 10); }
function addDias(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function semanaDe(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  const diffParaSegunda = dow === 0 ? -6 : 1 - dow;
  const inicio = addDias(dateStr, diffParaSegunda);
  const fim = addDias(inicio, 6);
  return { inicio, fim };
}

async function calcularPanorama(svc, hoje) {
  const [notas, titulos, despesas, tributos, folhas, faturas, cartoes, compras] = await Promise.all([
    svc.NotaFiscal.list('-data_vencimento_proxima', 5000),
    svc.TituloCobranca.list('-data_vencimento', 10000),
    svc.DespesaOperacional.list('-data_vencimento', 3000),
    svc.Tributo.list('-data_vencimento', 2000),
    svc.FolhaPagamento.list('-competencia', 2000),
    svc.FaturaCartao.list('-data_vencimento', 1000),
    svc.ContaCartao.list(),
    svc.ItemCompra.list('-data_emissao', 5000),
  ]);

  const cartaoPorId = new Map(cartoes.map(c => [c.id, c]));
  const semanaAtual = semanaDe(hoje);
  const semanaProx = semanaDe(addDias(semanaAtual.fim, 1));

  // CONTAS A RECEBER — sempre por parcela (TituloCobranca.valor_titulo)
  const titulosAbertos = titulos.filter(t => t.status === 'em_aberto' || t.status === 'vencido');
  const recebiveis = titulosAbertos.map(t => ({
    cliente: t.cliente,
    nf: t.seu_numero || t.nosso_numero,
    valor: (t.valor_titulo || 0) - (t.valor_pago || 0),
    data_vencimento: t.data_vencimento,
  })).filter(r => r.valor > 0.01);

  const dentro = (dv, ini, fim) => dv && dv >= ini && dv <= fim;
  const receberSemana = recebiveis.filter(r => dentro(r.data_vencimento, semanaAtual.inicio, semanaAtual.fim));

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

  // CONTAS A PAGAR (todas as origens)
  const contasPagar = [];
  despesas.filter(d => d.status === 'pendente').forEach(d => contasPagar.push({
    descricao: d.descricao, fornecedor: d.fornecedor || '—', valor: d.valor, data_vencimento: d.data_vencimento || d.data,
  }));
  tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido').forEach(t => contasPagar.push({
    descricao: t.descricao || `${t.tipo} ${t.competencia}`, fornecedor: 'Receita / Governo',
    valor: (t.valor_original || 0) - (t.valor_pago || 0), data_vencimento: t.data_vencimento,
  }));
  folhas.filter(f => f.status === 'pendente').forEach(f => {
    const [y, m] = (f.competencia || '').split('-').map(Number);
    const venc = y && m ? new Date(Date.UTC(y, m, 5)).toISOString().slice(0, 10) : null;
    contasPagar.push({ descricao: `Salário — ${f.funcionario_nome}`, fornecedor: f.funcionario_nome, valor: f.salario_liquido, data_vencimento: venc });
  });
  faturas.filter(f => f.status === 'aberta' || f.status === 'vencida').forEach(f => {
    const c = cartaoPorId.get(f.conta_cartao_id);
    contasPagar.push({ descricao: `Fatura ${c?.nome || 'Cartão'} — ${f.mes_referencia}`, fornecedor: c?.nome || 'Cartão', valor: (f.valor_total || 0) - (f.valor_pago || 0), data_vencimento: f.data_vencimento });
  });
  compras
    .filter(c => ['pendente', 'parcial', 'nao_identificado'].includes(c.status_pagamento))
    .forEach(c => {
      const aberto = (c.valor_total || 0) - (c.valor_pago || 0);
      if (aberto <= 0.01) return;
      contasPagar.push({ descricao: c.descricao_produto || `Compra NF ${c.numero_nota || ''}`.trim(), fornecedor: c.fornecedor || '—', valor: aberto, data_vencimento: c.data_emissao });
    });

  const pagarSemana = contasPagar.filter(c => dentro(c.data_vencimento, semanaAtual.inicio, semanaAtual.fim));
  const pagarVencido = contasPagar.filter(c => c.data_vencimento && c.data_vencimento < hoje);
  const soma = arr => arr.reduce((s, x) => s + (x.valor || 0), 0);
  const r2 = n => Math.round(n * 100) / 100;

  const entradasSemana = soma(receberSemana);
  const saidasSemana = soma(pagarSemana);

  return {
    data_referencia: hoje,
    semana_atual: semanaAtual,
    contas_a_receber: {
      semana: { total: r2(entradasSemana), itens: receberSemana.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')) },
    },
    inadimplencia: { total: r2(soma(inadimplentes)), titulos: inadimplentes.length, ranking: inadimplenciaRank },
    contas_a_pagar: {
      vencido: { total: r2(soma(pagarVencido)), itens: pagarVencido.length },
      semana: { total: r2(saidasSemana), itens: pagarSemana.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')) },
    },
    fluxo_caixa_semana: { saldo_previsto: r2(entradasSemana - saidasSemana) },
  };
}

function linhasItens(itens, campoNF) {
  if (!itens || itens.length === 0) {
    return '<tr><td colspan="3" style="padding:8px;color:#888;font-style:italic;">Nenhum lançamento na janela.</td></tr>';
  }
  return itens.map((i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${dataBR(i.data_vencimento)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${(i.cliente || i.fornecedor || i.descricao || '—')}${campoNF && i.nf ? ` <span style="color:#888;">(${i.nf})</span>` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${brl(i.valor)}</td>
    </tr>`).join('');
}

function montarHtml(p) {
  const saldo = p.fluxo_caixa_semana.saldo_previsto;
  const corSaldo = saldo >= 0 ? '#15803d' : '#dc2626';
  const inad = p.inadimplencia;
  const rankInad = (inad.ranking || []).slice(0, 8).map((c) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${c.cliente}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${c.dias_atraso}d</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#dc2626;">${brl(c.valor)}</td>
    </tr>`).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1e293b;">
    <div style="background:#1e3a8a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">📊 Panorama Financeiro Semanal</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:.85;">Referência: ${dataBR(p.data_referencia)} • Semana ${dataBR(p.semana_atual.inicio)} a ${dataBR(p.semana_atual.fim)}</p>
    </div>

    <div style="display:flex;gap:12px;padding:20px 24px;background:#f8fafc;">
      <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
        <div style="font-size:12px;color:#64748b;">A Receber (semana)</div>
        <div style="font-size:18px;font-weight:700;color:#15803d;">${brl(p.contas_a_receber.semana.total)}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
        <div style="font-size:12px;color:#64748b;">A Pagar (semana)</div>
        <div style="font-size:18px;font-weight:700;color:#dc2626;">${brl(p.contas_a_pagar.semana.total)}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
        <div style="font-size:12px;color:#64748b;">Saldo previsto</div>
        <div style="font-size:18px;font-weight:700;color:${corSaldo};">${brl(saldo)}</div>
      </div>
    </div>

    <div style="padding:0 24px 8px;">
      <h2 style="font-size:15px;margin:18px 0 8px;color:#15803d;">💰 Contas a Receber — esta semana</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f1f5f9;"><th style="padding:6px 8px;text-align:left;">Venc.</th><th style="padding:6px 8px;text-align:left;">Cliente</th><th style="padding:6px 8px;text-align:right;">Valor</th></tr></thead>
        <tbody>${linhasItens(p.contas_a_receber.semana.itens, true)}</tbody>
        <tfoot><tr><td colspan="2" style="padding:8px;text-align:right;font-weight:700;">Total</td><td style="padding:8px;text-align:right;font-weight:700;color:#15803d;">${brl(p.contas_a_receber.semana.total)}</td></tr></tfoot>
      </table>
    </div>

    <div style="padding:0 24px 8px;">
      <h2 style="font-size:15px;margin:18px 0 8px;color:#dc2626;">📤 Contas a Pagar — esta semana</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f1f5f9;"><th style="padding:6px 8px;text-align:left;">Venc.</th><th style="padding:6px 8px;text-align:left;">Fornecedor / Descrição</th><th style="padding:6px 8px;text-align:right;">Valor</th></tr></thead>
        <tbody>${linhasItens(p.contas_a_pagar.semana.itens, false)}</tbody>
        <tfoot><tr><td colspan="2" style="padding:8px;text-align:right;font-weight:700;">Total</td><td style="padding:8px;text-align:right;font-weight:700;color:#dc2626;">${brl(p.contas_a_pagar.semana.total)}</td></tr></tfoot>
      </table>
    </div>

    <div style="padding:0 24px 8px;">
      <h2 style="font-size:15px;margin:18px 0 8px;color:#b45309;">⚠️ Inadimplência — Top clientes (${brl(inad.total)} total, ${inad.titulos} títulos)</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f1f5f9;"><th style="padding:6px 8px;text-align:left;">Cliente</th><th style="padding:6px 8px;text-align:center;">Atraso</th><th style="padding:6px 8px;text-align:right;">Valor</th></tr></thead>
        <tbody>${rankInad || '<tr><td colspan="3" style="padding:8px;color:#888;">Sem inadimplência.</td></tr>'}</tbody>
      </table>
    </div>

    <p style="padding:16px 24px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:12px;">
      Relatório gerado automaticamente pelo Finansas360 • A Receber calculado por parcela (TituloCobranca).
    </p>
  </div>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Destinatários nunca vêm do request: lista fixa do servidor (+ o próprio admin, se solicitado)
    const destinatarios = body.enviar_para_mim && user.email ? [user.email] : DESTINATARIOS_PADRAO;

    const hoje = body.data_referencia || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const p = await calcularPanorama(base44.asServiceRole.entities, hoje);

    const html = montarHtml(p);
    const assunto = `📊 Panorama Financeiro — semana ${p.semana_atual.inicio.split('-').reverse().join('/')}`;

    const enviados = [];
    for (const to of destinatarios) {
      await base44.integrations.Core.SendEmail({
        to,
        subject: assunto,
        body: html,
        from_name: 'Finansas360',
      });
      enviados.push(to);
    }

    return Response.json({
      success: true,
      destinatarios: enviados,
      data_referencia: p.data_referencia,
      resumo: {
        receber_semana: p.contas_a_receber.semana.total,
        pagar_semana: p.contas_a_pagar.semana.total,
        saldo_previsto: p.fluxo_caixa_semana.saldo_previsto,
        inadimplencia_total: p.inadimplencia.total,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});