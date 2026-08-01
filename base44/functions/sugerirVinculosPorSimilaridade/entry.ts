import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Sugere vínculos para lançamentos ainda não conciliados, aprendendo com as descrições
// de lançamentos que JÁ possuem VinculoExtrato. Não altera nada de forma definitiva:
// grava apenas SugestaoConciliacao pendente, para confirmação no painel.

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b\d{6,}\b/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  return new Set(norm(s).split(' ').filter((t) => t.length >= 3));
}

// Similaridade de Jaccard entre conjuntos de palavras
function similaridade(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function diffDias(a, b) {
  if (!a || !b) return 99;
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

const TIPOS_SUGERIVEIS = ['DespesaOperacional', 'Tributo', 'FolhaPagamento', 'FaturaCartao'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const svc = base44.asServiceRole.entities;

    const [lancs, vincs, sugestoes, despesas, tributos, folhas, faturas] = await Promise.all([
      svc.LancamentoBancario.list('-data', 3000),
      svc.VinculoExtrato.list('-created_date', 3000),
      svc.SugestaoConciliacao.list('-created_date', 2000),
      svc.DespesaOperacional.list('-data', 2000),
      svc.Tributo.list('-data_vencimento', 2000),
      svc.FolhaPagamento.list('-competencia', 2000),
      svc.FaturaCartao.list('-data_vencimento', 500),
    ]);

    const lancById = new Map(lancs.map((l) => [l.id, l]));
    const idsComVinculo = new Set(vincs.map((v) => v.lancamento_bancario_id));

    // 1. Base de aprendizado: descrições já conciliadas + tipo de entidade
    const referencias = [];
    for (const v of vincs) {
      const l = lancById.get(v.lancamento_bancario_id);
      if (!l || !TIPOS_SUGERIVEIS.includes(v.entidade_tipo)) continue;
      const t = tokens(l.descricao);
      if (!t.size) continue;
      referencias.push({ toks: t, tipo: v.entidade_tipo, valor: Math.abs(l.valor || 0) });
    }
    if (!referencias.length) {
      return Response.json({ success: true, criadas: 0, motivo: 'sem histórico de vínculos para aprender' });
    }

    // 2. Sugestões/vínculos já existentes — não repetir
    const jaSugerido = new Set(
      sugestoes.filter((s) => s.status !== 'rejeitada').map((s) => `${s.lancamento_bancario_id}:${s.entidade_id}`)
    );
    const lancsComSugestaoPendente = new Set(
      sugestoes.filter((s) => s.status === 'pendente').map((s) => s.lancamento_bancario_id)
    );
    const entidadesOcupadas = new Set(vincs.map((v) => v.entidade_id));

    // 3. Registros elegíveis por tipo (sem pagamento bancário associado)
    const candidatosPorTipo = {
      DespesaOperacional: despesas
        .filter((d) => !d.lancamento_bancario_id && !d.lancamento_cartao_id && !entidadesOcupadas.has(d.id))
        .map((d) => ({ id: d.id, valor: d.valor || 0, data: d.data || d.data_vencimento, desc: d.descricao, forn: d.fornecedor, venc: d.data_vencimento })),
      Tributo: tributos
        .filter((t) => !t.lancamento_bancario_id && !entidadesOcupadas.has(t.id))
        .map((t) => ({ id: t.id, valor: t.valor_pago || t.valor_original || 0, data: t.data_pagamento || t.data_vencimento, desc: t.descricao || t.tipo, forn: t.tipo, venc: t.data_vencimento })),
      FolhaPagamento: folhas
        .filter((f) => !f.lancamento_bancario_id && !entidadesOcupadas.has(f.id))
        .map((f) => ({ id: f.id, valor: f.salario_liquido || 0, data: f.data_pagamento || (f.competencia ? f.competencia + '-05' : null), desc: `Folha ${f.funcionario_nome}`, forn: f.funcionario_nome, venc: f.data_pagamento })),
      FaturaCartao: faturas
        .filter((f) => !f.lancamento_bancario_id && !entidadesOcupadas.has(f.id))
        .map((f) => ({ id: f.id, valor: f.valor_total || 0, data: f.data_pagamento || f.data_vencimento, desc: `Fatura ${f.mes_referencia}`, forn: 'Cartão', venc: f.data_vencimento })),
    };

    // 4. Débitos ainda sem vínculo
    const pendentes = lancs.filter(
      (l) =>
        (l.valor || 0) < 0 &&
        !idsComVinculo.has(l.id) &&
        !lancsComSugestaoPendente.has(l.id) &&
        l.status_conciliacao !== 'ignorar' &&
        !['transferencia', 'interno', 'recebimento'].includes(l.categoria)
    );

    const SIM_MIN = 0.5;
    const LOTE_MAX = 60;
    const usados = new Set();
    const novas = [];

    for (const lanc of pendentes) {
      if (novas.length >= LOTE_MAX) break;
      const toks = tokens(lanc.descricao);
      if (!toks.size) continue;

      // tipo mais provável, ponderado pela similaridade das descrições históricas
      const score = {};
      let melhorSim = 0;
      for (const ref of referencias) {
        const s = similaridade(toks, ref.toks);
        if (s < SIM_MIN) continue;
        score[ref.tipo] = (score[ref.tipo] || 0) + s;
        if (s > melhorSim) melhorSim = s;
      }
      const ranking = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
      if (!ranking) continue;
      const tipo = ranking[0];

      const valor = Math.abs(lanc.valor || 0);
      const alvo = (candidatosPorTipo[tipo] || [])
        .filter((c) => !usados.has(c.id) && Math.abs(c.valor - valor) <= Math.max(valor * 0.02, 0.5))
        .map((c) => ({ c, dias: diffDias(c.data, lanc.data) }))
        .filter((x) => x.dias <= 25)
        .sort((a, b) => a.dias - b.dias)[0];
      if (!alvo) continue;
      if (jaSugerido.has(`${lanc.id}:${alvo.c.id}`)) continue;

      const confianca = Math.min(
        92,
        Math.round(50 + melhorSim * 35 + Math.max(0, 15 - alvo.dias))
      );

      novas.push({
        lancamento_bancario_id: lanc.id,
        entidade_tipo: tipo,
        entidade_id: alvo.c.id,
        descricao_conta: (alvo.c.desc || '').slice(0, 120),
        fornecedor: (alvo.c.forn || '').slice(0, 80),
        valor_esperado: alvo.c.valor,
        valor_extrato: valor,
        data_vencimento: alvo.c.venc || undefined,
        data_extrato: lanc.data,
        descricao_extrato: (lanc.descricao || '').slice(0, 150),
        diff_dias: Math.round(alvo.dias),
        confianca,
        motivo: `Descrição similar (${Math.round(melhorSim * 100)}%) a lançamentos já conciliados como ${tipo}`,
        status: 'pendente',
      });
      usados.add(alvo.c.id);
    }

    if (novas.length) await svc.SugestaoConciliacao.bulkCreate(novas);

    return Response.json({
      success: true,
      criadas: novas.length,
      pendentes_analisados: pendentes.length,
      referencias_aprendidas: referencias.length,
      amostra: novas.slice(0, 10).map((n) => ({
        descricao: n.descricao_extrato,
        tipo: n.entidade_tipo,
        valor: n.valor_extrato,
        confianca: n.confianca,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}