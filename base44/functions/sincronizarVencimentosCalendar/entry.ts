import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CAL_NAME = 'NeuralFin — Vencimentos';
const CAL_DESC = 'Vencimentos de contas a pagar sincronizados automaticamente pelo NeuralFin';
const CAL_TZ = 'America/Sao_Paulo';

function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Mapeia obrigações de cada entidade para o formato unificado
async function coletarObrigacoes(base44) {
  const [tributos, despesas, faturas, folhas, obras] = await Promise.all([
    base44.asServiceRole.entities.Tributo.filter({ status: 'a_vencer' }).catch(() => []),
    base44.asServiceRole.entities.DespesaOperacional.filter({ status: 'pendente' }).catch(() => []),
    base44.asServiceRole.entities.FaturaCartao.filter({ status: 'aberta' }).catch(() => []),
    base44.asServiceRole.entities.FolhaPagamento.filter({ status: 'pendente' }).catch(() => []),
    base44.asServiceRole.entities.ObraReforma.list().catch(() => []),
  ]);

  const obrigacoes = [];

  for (const t of tributos) {
    if (!t.data_vencimento) continue;
    obrigacoes.push({
      tipo: 'Tributo', id: t.id, data: t.data_vencimento,
      valor: t.valor_original, status: t.status,
      titulo: `💰 ${t.tipo} — ${fmtBRL(t.valor_original)}`,
      descricao: `Tributo: ${t.tipo}\nCompetência: ${t.competencia || '—'}\nEmpresa: ${t.empresa || '—'}\nValor: ${fmtBRL(t.valor_original)}\n${t.descricao || ''}`,
    });
  }
  for (const d of despesas) {
    const data = d.data_vencimento || d.data;
    if (!data) continue;
    obrigacoes.push({
      tipo: 'DespesaOperacional', id: d.id, data,
      valor: d.valor, status: d.status,
      titulo: `🧾 ${d.descricao || d.fornecedor || 'Despesa'} — ${fmtBRL(d.valor)}`,
      descricao: `Despesa: ${d.descricao || '—'}\nFornecedor: ${d.fornecedor || '—'}\nCategoria: ${d.categoria || '—'}\nEmpresa: ${d.empresa || '—'}\nValor: ${fmtBRL(d.valor)}`,
    });
  }
  for (const f of faturas) {
    if (!f.data_vencimento) continue;
    obrigacoes.push({
      tipo: 'FaturaCartao', id: f.id, data: f.data_vencimento,
      valor: f.valor_total, status: f.status,
      titulo: `💳 Fatura ${f.mes_referencia || ''} — ${fmtBRL(f.valor_total)}`,
      descricao: `Fatura de cartão\nMês referência: ${f.mes_referencia || '—'}\nValor: ${fmtBRL(f.valor_total)}`,
    });
  }
  for (const fp of folhas) {
    if (!fp.data_pagamento) continue;
    obrigacoes.push({
      tipo: 'FolhaPagamento', id: fp.id, data: fp.data_pagamento,
      valor: fp.salario_liquido, status: fp.status,
      titulo: `👤 Folha ${fp.funcionario_nome} — ${fmtBRL(fp.salario_liquido)}`,
      descricao: `Folha de pagamento\nFuncionário: ${fp.funcionario_nome}\nCompetência: ${fp.competencia || '—'}\nEmpresa: ${fp.empresa || '—'}\nLíquido: ${fmtBRL(fp.salario_liquido)}`,
    });
  }
  for (const o of obras) {
    if (!o.data || o.status === 'pago') continue;
    obrigacoes.push({
      tipo: 'ObraReforma', id: o.id, data: o.data,
      valor: o.valor, status: o.status || 'pendente',
      titulo: `🔨 Obra: ${o.descricao || o.responsavel || 'Reforma'} — ${fmtBRL(o.valor)}`,
      descricao: `Obra/Reforma\nDescrição: ${o.descricao || '—'}\nResponsável: ${o.responsavel || '—'}\nLocal: ${o.local_obra || '—'}\nValor: ${fmtBRL(o.valor)}`,
    });
  }

  return obrigacoes;
}

async function obterOuCriarCalendario(accessToken) {
  // Lista calendários existentes
  const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = await listRes.json();
    const existente = (list.items || []).find(c => c.summary === CAL_NAME);
    if (existente) return existente.id;
  }
  // Cria
  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: CAL_NAME, description: CAL_DESC, timeZone: CAL_TZ }),
  });
  if (!createRes.ok) throw new Error(`Falha ao criar calendário: ${await createRes.text()}`);
  const cal = await createRes.json();
  return cal.id;
}

function montarEvento(ob) {
  return {
    summary: ob.titulo,
    description: ob.descricao,
    start: { date: ob.data },
    end: { date: ob.data },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    if (!accessToken) return Response.json({ error: 'Google Calendar não autorizado' }, { status: 400 });

    const calendarId = await obterOuCriarCalendario(accessToken);
    const obrigacoes = await coletarObrigacoes(base44);
    const mapas = await base44.asServiceRole.entities.CalendarSyncMap.list().catch(() => []);
    const mapaPorChave = new Map(mapas.map(m => [`${m.entidade_tipo}:${m.entidade_id}`, m]));

    let criados = 0, atualizados = 0, pulados = 0, erros = 0;

    for (const ob of obrigacoes) {
      const chave = `${ob.tipo}:${ob.id}`;
      const mapa = mapaPorChave.get(chave);
      const evento = montarEvento(ob);

      try {
        if (mapa?.google_event_id) {
          // Já existe — checa se mudou (data/valor/status)
          const mudou = mapa.data_vencimento !== ob.data
            || Math.abs((mapa.valor || 0) - (ob.valor || 0)) > 0.01
            || mapa.status !== ob.status;
          if (!mudou) { pulados++; continue; }
          // Atualiza
          const upd = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${mapa.google_event_id}`,
            {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(evento),
            }
          );
          if (upd.ok) {
            await base44.asServiceRole.entities.CalendarSyncMap.update(mapa.id, {
              data_vencimento: ob.data, valor: ob.valor, status: ob.status,
              ultima_sync: new Date().toISOString(),
            });
            atualizados++;
          } else if (upd.status === 404 || upd.status === 410) {
            // Evento foi deletado no Google — recria
            await base44.asServiceRole.entities.CalendarSyncMap.delete(mapa.id);
            mapaPorChave.delete(chave);
            // cai para o branch de criação no próximo passo
            const cre = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
              { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(evento) }
            );
            if (cre.ok) {
              const j = await cre.json();
              await base44.asServiceRole.entities.CalendarSyncMap.create({
                entidade_tipo: ob.tipo, entidade_id: ob.id,
                google_event_id: j.id, google_calendar_id: calendarId,
                data_vencimento: ob.data, valor: ob.valor, status: ob.status,
                ultima_sync: new Date().toISOString(),
              });
              criados++;
            } else { erros++; }
          } else { erros++; }
        } else {
          // Cria novo
          const cre = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(evento) }
          );
          if (cre.ok) {
            const j = await cre.json();
            await base44.asServiceRole.entities.CalendarSyncMap.create({
              entidade_tipo: ob.tipo, entidade_id: ob.id,
              google_event_id: j.id, google_calendar_id: calendarId,
              data_vencimento: ob.data, valor: ob.valor, status: ob.status,
              ultima_sync: new Date().toISOString(),
            });
            criados++;
          } else { erros++; }
        }
      } catch (e) {
        console.error('Erro ao sincronizar', chave, e.message);
        erros++;
      }
    }

    return Response.json({
      sucesso: true,
      calendario: CAL_NAME,
      calendar_id: calendarId,
      total_obrigacoes: obrigacoes.length,
      criados, atualizados, pulados, erros,
    });
  } catch (err) {
    console.error('Erro geral:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});