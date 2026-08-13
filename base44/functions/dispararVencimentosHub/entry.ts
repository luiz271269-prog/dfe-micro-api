import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * dispararVencimentosHub — Satélite NeuralFin → Hub Nexus360
 *
 * Varre os vencimentos próximos (Tributos, Faturas de Cartão, Cobranças/boletos
 * em aberto) e, para cada um dentro da janela de antecedência, faz um POST para
 * o endpoint notificacaoHub do Nexus360. O hub cuida do push / WhatsApp.
 *
 * Autenticação de saída: header 'x-hub-token: <NEXUS_HUB_TOKEN>'
 * Destino: NEXUS_HUB_URL (endpoint notificacaoHub baseado no APP_ID imutável)
 *
 * Parâmetros (payload opcional):
 *   dias:      número de dias de antecedência a considerar (default 3)
 *   modo:      'diario' | 'semanal' — usado só para o texto do aviso (default 'diario')
 *   dry_run:   se true, apenas retorna o que enviaria, sem chamar o hub
 *
 * Chamada normalmente via automação agendada.
 */

function hojeISO() {
  return new Date().toISOString().split('T')[0];
}

function addDias(baseISO, dias) {
  const d = new Date(baseISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().split('T')[0];
}

function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function enviarAoHub(hubUrl, hubToken, item) {
  const res = await fetch(hubUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-token': hubToken },
    body: JSON.stringify({ ...item, app_origem: 'neural_fin' })
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Segurança: apenas administradores autenticados (inclui automações agendadas) podem disparar
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const HUB_URL = Deno.env.get('NEXUS_HUB_URL');
    const HUB_TOKEN = Deno.env.get('NEXUS_HUB_TOKEN');
    if (!HUB_URL || !HUB_TOKEN) {
      return Response.json({ success: false, error: 'NEXUS_HUB_URL / NEXUS_HUB_TOKEN não configurados' }, { status: 500 });
    }

    const payload = await req.json().catch(() => ({}));
    const dias = Number(payload.dias) > 0 ? Number(payload.dias) : 3;
    const modo = payload.modo || 'diario';
    const dryRun = payload.dry_run === true;

    const hoje = hojeISO();
    const limite = addDias(hoje, dias);

    // Destinatário: os avisos vão para os administradores do app.
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const emails = (admins || []).map((u) => u.email).filter(Boolean);
    if (emails.length === 0) {
      return Response.json({ success: false, error: 'Nenhum administrador com e-mail para notificar' }, { status: 404 });
    }

    const avisos = [];

    // ── 1) Tributos a vencer ─────────────────────────────────────────
    const tributos = await base44.asServiceRole.entities.Tributo.filter({ status: 'a_vencer' });
    for (const t of tributos) {
      if (t.data_vencimento && t.data_vencimento >= hoje && t.data_vencimento <= limite) {
        avisos.push({
          categoria: 'tributo',
          titulo: `Tributo ${t.tipo} a vencer`,
          mensagem: `${t.tipo}${t.empresa ? ` (${t.empresa})` : ''} de ${fmtBRL(t.valor_original)} vence em ${fmtData(t.data_vencimento)}.`,
          url_destino: '/tributos'
        });
      }
    }

    // ── 2) Faturas de cartão a vencer ────────────────────────────────
    const faturas = await base44.asServiceRole.entities.FaturaCartao.filter({ status: 'aberta' });
    let cartoes = [];
    if (faturas.length > 0) cartoes = await base44.asServiceRole.entities.ContaCartao.list();
    const cartaoNome = (id) => cartoes.find((c) => c.id === id)?.nome || 'Cartão';
    for (const f of faturas) {
      if (f.data_vencimento && f.data_vencimento >= hoje && f.data_vencimento <= limite) {
        avisos.push({
          categoria: 'fatura_cartao',
          titulo: `Fatura de cartão a vencer`,
          mensagem: `Fatura ${cartaoNome(f.conta_cartao_id)} de ${fmtBRL(f.valor_total)} vence em ${fmtData(f.data_vencimento)}.`,
          url_destino: '/cartoes'
        });
      }
    }

    // ── 3) Cobranças / boletos em aberto vencendo ────────────────────
    const titulos = await base44.asServiceRole.entities.TituloCobranca.filter({ status: 'em_aberto' });
    for (const c of titulos) {
      if (c.data_vencimento && c.data_vencimento >= hoje && c.data_vencimento <= limite) {
        avisos.push({
          categoria: 'cobranca',
          titulo: `Cobrança a receber vencendo`,
          mensagem: `${c.cliente} — ${fmtBRL(c.valor_titulo)} vence em ${fmtData(c.data_vencimento)} (título ${c.nosso_numero}).`,
          url_destino: '/cobrancas'
        });
      }
    }

    if (dryRun) {
      return Response.json({ success: true, dry_run: true, janela: { hoje, limite, dias }, total_avisos: avisos.length, emails, avisos });
    }

    // ── Disparo ao hub — um aviso por destinatário ───────────────────
    let enviados = 0;
    let falhas = 0;
    const resultados = [];
    for (const email of emails) {
      for (const a of avisos) {
        const r = await enviarAoHub(HUB_URL, HUB_TOKEN, {
          user_email: email,
          titulo: a.titulo,
          mensagem: a.mensagem,
          url_destino: a.url_destino
        });
        if (r.ok) enviados++; else falhas++;
        resultados.push({ email, categoria: a.categoria, ok: r.ok, status: r.status });
      }
    }

    return Response.json({
      success: true,
      modo,
      janela: { hoje, limite, dias },
      total_avisos: avisos.length,
      destinatarios: emails.length,
      enviados,
      falhas,
      resultados
    });
  } catch (error) {
    console.error('[dispararVencimentosHub] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});