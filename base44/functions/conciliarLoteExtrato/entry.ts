import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Conciliação automática em lote.
 * Para cada LancamentoBancario (débito) do mês informado ainda sem vínculo,
 * busca uma conta a pagar pendente compatível (Despesa/Tributo/Folha/Fatura)
 * e, se houver match de alta confiança, dá baixa automaticamente.
 *
 * Payload: { mes_referencia?: 'YYYY-MM' }  — se ausente, processa todos os meses recentes.
 * Resposta: { processados, baixas, duplicidades, detalhes }
 */

function diffDias(d1, d2) {
  return Math.abs((new Date(d1) - new Date(d2)) / 86400000);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { mes_referencia } = await req.json().catch(() => ({}));

    // 1) Carregar dados
    const [lancs, despesas, tributos, folhas, faturas] = await Promise.all([
      mes_referencia
        ? base44.entities.LancamentoBancario.filter({ mes_referencia })
        : base44.entities.LancamentoBancario.list('-data', 500),
      base44.entities.DespesaOperacional.filter({ status: 'pendente' }),
      base44.entities.Tributo.list('-data_vencimento', 200),
      base44.entities.FolhaPagamento.filter({ status: 'pendente' }),
      base44.entities.FaturaCartao.list('-data_vencimento', 100),
    ]);

    const tributosAbertos = tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido');
    const faturasAbertas = faturas.filter(f => f.status === 'aberta' || f.status === 'vencida');

    const debitos = (lancs || []).filter(l => (l.valor || 0) < 0);
    const baixas = [];
    const duplicidades = [];

    for (const lanc of debitos) {
      const valorAbs = Math.abs(lanc.valor);

      // (A) Detectar duplicidade com outros lançamentos do mesmo conjunto
      const dupCand = debitos.find(
        o => o.id !== lanc.id
          && o.conta_bancaria === lanc.conta_bancaria
          && Math.abs((o.valor || 0) - (lanc.valor || 0)) < 0.01
          && diffDias(o.data, lanc.data) <= 5
          && (o.descricao || '').slice(0, 20) === (lanc.descricao || '').slice(0, 20)
      );
      if (dupCand && !lanc.alerta_duplicidade) {
        await base44.asServiceRole.entities.LancamentoBancario.update(lanc.id, {
          alerta_duplicidade: true,
          duplicidade_ref: dupCand.id,
        });
        duplicidades.push({ lanc_id: lanc.id, ref: dupCand.id, data: lanc.data, valor: lanc.valor });
      }

      // (B) Buscar match em contas a pagar pendentes (despesa/tributo/folha/fatura)
      const candidatos = [];

      for (const d of despesas) {
        if (Math.abs(d.valor - valorAbs) > 0.50) continue;
        const ref = d.data_vencimento || d.data;
        const dd = diffDias(ref, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'despesa', ref: d, score: dd * 10 + Math.abs(d.valor - valorAbs) });
      }
      for (const t of tributosAbertos) {
        const valorT = (t.valor_original || 0) - (t.valor_pago || 0);
        if (Math.abs(valorT - valorAbs) > 0.50) continue;
        const dd = diffDias(t.data_vencimento, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'tributo', ref: t, score: dd * 10 + Math.abs(valorT - valorAbs) });
      }
      for (const f of folhas) {
        if (Math.abs(f.salario_liquido - valorAbs) > 0.50) continue;
        const [y, m] = (f.competencia || '').split('-').map(Number);
        if (!y || !m) continue;
        const venc = new Date(y, m, 5).toISOString().slice(0, 10);
        const dd = diffDias(venc, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'folha', ref: f, score: dd * 10 + Math.abs(f.salario_liquido - valorAbs) });
      }
      for (const fat of faturasAbertas) {
        const aberto = fat.valor_total - (fat.valor_pago || 0);
        if (Math.abs(aberto - valorAbs) > 1.0) continue;
        const dd = diffDias(fat.data_vencimento, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'fatura', ref: fat, score: dd * 10 + Math.abs(aberto - valorAbs) });
      }

      candidatos.sort((a, b) => a.score - b.score);
      const best = candidatos[0];
      if (!best) continue;
      // Só dá baixa automática se confiança alta: score < 5 (data próxima + valor exato)
      if (best.score >= 5) continue;

      try {
        if (best.tipo === 'despesa') {
          await base44.asServiceRole.entities.DespesaOperacional.update(best.ref.id, {
            status: 'pago', data: lanc.data,
          });
        } else if (best.tipo === 'tributo') {
          await base44.asServiceRole.entities.Tributo.update(best.ref.id, {
            status: 'pago', data_pagamento: lanc.data, valor_pago: valorAbs,
          });
        } else if (best.tipo === 'folha') {
          await base44.asServiceRole.entities.FolhaPagamento.update(best.ref.id, {
            status: 'pago', data_pagamento: lanc.data,
          });
        } else if (best.tipo === 'fatura') {
          await base44.asServiceRole.entities.FaturaCartao.update(best.ref.id, {
            status: 'paga_total', data_pagamento: lanc.data, valor_pago: valorAbs,
          });
        }
        baixas.push({
          lanc_id: lanc.id, tipo: best.tipo, ref_id: best.ref.id,
          data: lanc.data, valor: lanc.valor, descricao: lanc.descricao,
        });
      } catch (e) {
        // segue o baile mesmo em erro de um item
      }
    }

    return Response.json({
      processados: debitos.length,
      baixas_automaticas: baixas.length,
      duplicidades_detectadas: duplicidades.length,
      detalhes: { baixas, duplicidades },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});