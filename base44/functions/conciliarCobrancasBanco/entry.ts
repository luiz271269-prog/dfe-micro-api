import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Concilia Títulos de Cobrança (Sicredi) ↔ Extrato Bancário (recebimentos).
// REGRAS:
//   - Títulos em_aberto/vencido sem lancamento_bancario_id → procurar créditos no extrato
//   - MATCH PERFEITO (mesmo valor ±R$0,50, mesma data de pagamento) → baixa automática
//   - VALOR PRÓXIMO mas data divergente (±15 dias) → cria SugestaoConciliacao
//   - Match por cliente no histórico do extrato (boost de confiança)

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function clienteNoExtrato(cliente, descricao) {
  if (!cliente || !descricao) return false;
  const c = norm(cliente);
  const d = norm(descricao);
  if (!c || !d) return false;
  // primeira palavra significativa (≥4 letras) do cliente no extrato
  const partes = c.split(' ').filter(p => p.length >= 4);
  if (partes.length === 0) return false;
  return partes.some(p => d.includes(p));
}

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

    const [titulos, lancamentos, vinculos, sugestoesAntigas] = await Promise.all([
      svc.TituloCobranca.list('-data_vencimento', 3000),
      svc.LancamentoBancario.list('-data', 5000),
      svc.VinculoExtrato.list('-created_date', 5000),
      svc.SugestaoConciliacao.filter({ status: 'pendente' }),
    ]);

    // Títulos em aberto sem vínculo bancário
    const titulosAbertos = titulos.filter(t =>
      (t.status === 'em_aberto' || t.status === 'vencido') && !t.lancamento_bancario_id
    );

    // Créditos do extrato não conciliados e não vinculados
    const lancsVinculados = new Set(vinculos.map(v => v.lancamento_bancario_id));
    const lancsEmSugestao = new Set(
      sugestoesAntigas
        .filter(s => s.entidade_tipo === 'TituloCobranca')
        .map(s => s.lancamento_bancario_id)
    );
    const titulosEmSugestao = new Set(
      sugestoesAntigas
        .filter(s => s.entidade_tipo === 'TituloCobranca')
        .map(s => s.entidade_id)
    );

    const creditos = lancamentos.filter(l =>
      l.valor > 0 &&
      l.status_conciliacao !== 'conciliado' &&
      l.categoria !== 'transferencia' &&
      l.categoria !== 'interno' &&
      !lancsVinculados.has(l.id) &&
      !lancsEmSugestao.has(l.id)
    );

    const TOL_VALOR = 0.50;
    const JANELA_SUGESTAO = 15;

    let baixasAuto = 0;
    let sugestoesCriadas = 0;
    const titulosUsados = new Set();
    const lancsUsados = new Set();

    // PASSO 1 — MATCH PERFEITO (mesmo valor, mesma data)
    for (const titulo of titulosAbertos) {
      if (titulosUsados.has(titulo.id)) continue;
      const valor = titulo.valor_titulo || 0;
      if (valor < 0.01) continue;

      const match = creditos.find(l => {
        if (lancsUsados.has(l.id)) return false;
        if (Math.abs(l.valor - valor) > TOL_VALOR) return false;
        return l.data === (titulo.data_pagamento || titulo.data_vencimento);
      });

      if (!match) continue;

      try {
        await svc.TituloCobranca.update(titulo.id, {
          status: 'pago',
          data_pagamento: match.data,
          valor_pago: match.valor,
          lancamento_bancario_id: match.id,
        });
        await svc.VinculoExtrato.create({
          lancamento_bancario_id: match.id,
          entidade_tipo: 'TituloCobranca',
          entidade_id: titulo.id,
          valor_alocado: match.valor,
          tipo_vinculo: 'pagamento_integral',
          conciliado_por: 'auto',
          confianca: 100,
          observacao: `Match perfeito · ${titulo.cliente} · ${titulo.nosso_numero || ''}`,
        });
        await svc.LancamentoBancario.update(match.id, {
          status_conciliacao: 'conciliado',
          vinculos_count: (match.vinculos_count || 0) + 1,
          valor_conciliado: (match.valor_conciliado || 0) + match.valor,
        });
        titulosUsados.add(titulo.id);
        lancsUsados.add(match.id);
        baixasAuto++;
      } catch (err) {
        console.error('Erro baixa auto cobrança-banco:', err.message);
      }
    }

    // PASSO 2 — SUGESTÕES (valor próximo, data na janela)
    for (const titulo of titulosAbertos) {
      if (titulosUsados.has(titulo.id)) continue;
      if (titulosEmSugestao.has(titulo.id)) continue;
      const valor = titulo.valor_titulo || 0;
      if (valor < 0.01) continue;
      const dataBase = new Date(titulo.data_vencimento);

      const candidatos = creditos
        .filter(l => {
          if (lancsUsados.has(l.id)) return false;
          if (Math.abs(l.valor - valor) > TOL_VALOR) return false;
          const diff = Math.abs((new Date(l.data) - dataBase) / 86400000);
          return diff <= JANELA_SUGESTAO;
        })
        .map(l => {
          const diff = Math.abs((new Date(l.data) - dataBase) / 86400000);
          const nomeMatch = clienteNoExtrato(titulo.cliente, l.descricao);
          return { l, diff, nomeMatch };
        })
        .sort((a, b) => {
          if (a.nomeMatch !== b.nomeMatch) return a.nomeMatch ? -1 : 1;
          return a.diff - b.diff;
        });

      if (candidatos.length === 0) continue;

      const { l: match, diff, nomeMatch } = candidatos[0];
      const confianca = nomeMatch
        ? (diff <= 5 ? 90 : 75)
        : (diff <= 5 ? 70 : 55);

      try {
        await svc.SugestaoConciliacao.create({
          lancamento_bancario_id: match.id,
          entidade_tipo: 'TituloCobranca',
          entidade_id: titulo.id,
          descricao_conta: `${titulo.cliente} · ${titulo.nosso_numero || titulo.seu_numero || ''}`,
          fornecedor: titulo.cliente,
          valor_esperado: valor,
          valor_extrato: match.valor,
          data_vencimento: titulo.data_vencimento,
          data_extrato: match.data,
          descricao_extrato: match.descricao,
          diff_dias: Math.round(diff),
          confianca,
          motivo: `Recebimento: valor bate (R$ ${valor.toFixed(2)})${nomeMatch ? ', cliente confere' : ''}, ${Math.round(diff)} dia(s) do vencimento`,
          status: 'pendente',
        });
        titulosUsados.add(titulo.id);
        lancsUsados.add(match.id);
        sugestoesCriadas++;
      } catch (err) {
        console.error('Erro criar sugestão cobrança-banco:', err.message);
      }
    }

    return Response.json({
      success: true,
      baixas_automaticas: baixasAuto,
      sugestoes_criadas: sugestoesCriadas,
      total_titulos_abertos: titulosAbertos.length,
      total_creditos_disponiveis: creditos.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});