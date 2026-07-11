import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * SERVIÇO CENTRAL DE VÍNCULO (fonte única de verdade da conciliação).
 * Toda baixa — manual ou automática — deve passar por aqui.
 *
 * Garantias:
 *  - Trava de sobrealocação: Σ vínculos ≤ |valor do lançamento|
 *  - Vínculo duplicado bloqueado
 *  - Status da obrigação derivado dos vínculos (baixa E reabertura)
 *  - Cache do lançamento sempre recalculado dos vínculos reais
 *
 * Ações:
 *  { acao:"criar", lancamento_bancario_id, entidade_tipo, entidade_id, valor_alocado, tipo_vinculo?, observacao?, conciliado_por?, confianca? }
 *  { acao:"remover", vinculo_id }
 *  { acao:"recalcular", lancamento_bancario_id }
 */

// Configuração de baixa por tipo de obrigação: valor devido, tolerância e status
const OBRIGACOES = {
  FolhaPagamento:     { devido: r => r.salario_liquido || 0, tol: 50,  pago: 'pago',       aberto: 'pendente',  campos: (data, cobre) => cobre ? { status: 'pago', data_pagamento: data } : { status: 'pendente', data_pagamento: null } },
  DespesaOperacional: { devido: r => r.valor || 0,           tol: 0.5, pago: 'pago',       aberto: 'pendente',  campos: (data, cobre) => cobre ? { status: 'pago' } : { status: 'pendente' } },
  Tributo:            { devido: r => r.valor_original || 0,  tol: 0.5, pago: 'pago',       aberto: 'a_vencer',  campos: (data, cobre, soma) => cobre ? { status: 'pago', data_pagamento: data, valor_pago: soma } : { status: 'a_vencer', data_pagamento: null, valor_pago: soma } },
  FaturaCartao:       { devido: r => r.valor_total || 0,     tol: 1,   pago: 'paga_total', aberto: 'aberta',    campos: (data, cobre, soma) => cobre ? { status: 'paga_total', data_pagamento: data, valor_pago: soma } : { status: 'aberta', data_pagamento: null, valor_pago: soma } },
  TituloCobranca:     { devido: r => r.valor_titulo || 0,    tol: 0.5, pago: 'pago',       aberto: 'em_aberto', campos: (data, cobre, soma) => cobre ? { status: 'pago', data_pagamento: data, valor_pago: soma } : { status: 'em_aberto', valor_pago: soma } },
};

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

    async function recalcularCache(lancId) {
      if (!lancId) return null;
      const [lanc] = await svc.LancamentoBancario.filter({ id: lancId });
      if (!lanc) return null;
      const vinculos = await svc.VinculoExtrato.filter({ lancamento_bancario_id: lancId });
      const valorConc = Math.round(vinculos.reduce((s, v) => s + (v.valor_alocado || 0), 0) * 100) / 100;
      const valorAbs = Math.abs(lanc.valor || 0);
      let status = 'nao_conciliado';
      if (vinculos.length > 0) status = valorConc >= valorAbs - 0.5 ? 'conciliado' : 'parcial';
      if (lanc.status_conciliacao === 'ignorar') status = 'ignorar';
      await svc.LancamentoBancario.update(lancId, {
        status_conciliacao: status,
        vinculos_count: vinculos.length,
        valor_conciliado: valorConc,
      });
      return { status, vinculos_count: vinculos.length, valor_conciliado: valorConc };
    }

    // Deriva o status da obrigação a partir dos vínculos reais (baixa e reabertura)
    async function recalcularObrigacao(entidadeTipo, entidadeId, dataPagamento) {
      const cfg = OBRIGACOES[entidadeTipo];
      if (!cfg) return null; // tipos sem baixa automática (ObraReforma, NotaFiscal, ...)
      const [reg] = await svc[entidadeTipo].filter({ id: entidadeId });
      if (!reg) return null;
      const vincs = await svc.VinculoExtrato.filter({ entidade_tipo: entidadeTipo, entidade_id: entidadeId });
      const soma = Math.round(vincs.filter(v => v.tipo_vinculo !== 'adiantamento')
        .reduce((s, v) => s + (v.valor_alocado || 0), 0) * 100) / 100;
      const devido = cfg.devido(reg);
      const cobre = soma > 0 && devido - soma <= cfg.tol;
      const statusAtual = reg.status;
      const alvo = cobre ? cfg.pago : cfg.aberto;
      if (statusAtual !== alvo || entidadeTipo === 'Tributo' || entidadeTipo === 'FaturaCartao' || entidadeTipo === 'TituloCobranca') {
        await svc[entidadeTipo].update(entidadeId, cfg.campos(dataPagamento || null, cobre, soma));
      }
      return { soma, devido, status: alvo };
    }

    if (body.acao === 'criar') {
      const { lancamento_bancario_id, entidade_tipo, entidade_id, valor_alocado, tipo_vinculo, observacao, conciliado_por, confianca } = body;
      if (!lancamento_bancario_id || !entidade_tipo || !entidade_id || valor_alocado == null) {
        return Response.json({ error: 'Faltam parâmetros: lancamento_bancario_id, entidade_tipo, entidade_id, valor_alocado' }, { status: 400 });
      }

      const [lanc] = await svc.LancamentoBancario.filter({ id: lancamento_bancario_id });
      if (!lanc) return Response.json({ error: 'Lançamento não encontrado' }, { status: 404 });

      const vincsAtuais = await svc.VinculoExtrato.filter({ lancamento_bancario_id });

      // Vínculo duplicado
      if (vincsAtuais.some(v => v.entidade_tipo === entidade_tipo && v.entidade_id === entidade_id)) {
        return Response.json({ error: 'Vínculo já existe', vinculo_id: vincsAtuais.find(v => v.entidade_tipo === entidade_tipo && v.entidade_id === entidade_id).id }, { status: 409 });
      }

      // Trava de sobrealocação
      const jaAlocado = vincsAtuais.reduce((s, v) => s + (v.valor_alocado || 0), 0);
      const valorNovo = Math.abs(valor_alocado);
      const teto = Math.abs(lanc.valor || 0);
      if (jaAlocado + valorNovo > teto + 0.01) {
        return Response.json({
          error: `Sobrealocação bloqueada: já alocado R$${jaAlocado.toFixed(2)} + novo R$${valorNovo.toFixed(2)} > teto R$${teto.toFixed(2)} do lançamento`,
        }, { status: 422 });
      }

      const novo = await svc.VinculoExtrato.create({
        lancamento_bancario_id,
        entidade_tipo,
        entidade_id,
        valor_alocado: valorNovo,
        tipo_vinculo: tipo_vinculo || 'pagamento_integral',
        conciliado_por: conciliado_por || (internoOk ? 'auto' : 'manual'),
        confianca: confianca ?? 100,
        observacao: observacao || '',
      });

      const cache = await recalcularCache(lancamento_bancario_id);
      const obrigacao = await recalcularObrigacao(entidade_tipo, entidade_id, lanc.data);
      return Response.json({ success: true, vinculo: novo, cache, obrigacao });
    }

    if (body.acao === 'remover') {
      const { vinculo_id } = body;
      if (!vinculo_id) return Response.json({ error: 'Falta vinculo_id' }, { status: 400 });
      const [v] = await svc.VinculoExtrato.filter({ id: vinculo_id });
      if (!v) return Response.json({ error: 'Vínculo não encontrado' }, { status: 404 });
      await svc.VinculoExtrato.delete(vinculo_id);
      const cache = await recalcularCache(v.lancamento_bancario_id);
      const obrigacao = await recalcularObrigacao(v.entidade_tipo, v.entidade_id, null);
      return Response.json({ success: true, cache, obrigacao });
    }

    if (body.acao === 'recalcular') {
      const cache = await recalcularCache(body.lancamento_bancario_id);
      return Response.json({ success: true, cache });
    }

    return Response.json({ error: 'acao inválida — use criar | remover | recalcular' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});