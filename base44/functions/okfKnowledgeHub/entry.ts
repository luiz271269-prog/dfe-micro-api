import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// OKF Knowledge Hub — NeuralFin
// Expõe o "segundo cérebro" financeiro em padrão aberto OKF 1.0.
// Fontes de conhecimento:
//   - RegraCategorizacao: regras de categorização aprendidas (extrato/cartão)
//   - MemoriaImportacao: aprendizado de layouts de importação (modo econômico)
//   - RegraRecorrente: padrões de transações recorrentes
//   - SugestaoConciliacao: aprendizado de conciliação (confiança, motivo)
//
// Autenticação: usuário logado do app OU token compartilhado (NEXUS_HUB_TOKEN)
// Ações: list, get, search

const FONTES = {
  regra_categorizacao: 'RegraCategorizacao',
  memoria_importacao: 'MemoriaImportacao',
  regra_recorrente: 'RegraRecorrente',
  sugestao_conciliacao: 'SugestaoConciliacao',
  conhecimento_negocio: 'ConhecimentoNegocio',
};

function normalizar(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Converte cada registro para o envelope OKF 1.0
function toOKF(item, fonte) {
  const base = {
    id: item.id,
    source_type: fonte,
    entity: FONTES[fonte],
    created_date: item.created_date,
    updated_date: item.updated_date,
  };

  if (fonte === 'regra_categorizacao') {
    return {
      ...base,
      title: `Regra: ${item.categoria} ← "${item.termo_chave}"`,
      knowledge_type: 'categorization_rule',
      scope: item.escopo, // 'extrato' | 'cartao'
      content: `Quando a descrição contém "${item.termo_chave}", categorizar como "${item.categoria}".`,
      keywords: [item.termo_chave, item.categoria],
      category: item.categoria,
      example_description: item.exemplo_descricao || null,
      confidence: Math.min(100, (item.vezes_aplicada || 1) * 10),
      usage: {
        times_applied: item.vezes_aplicada || 0,
        last_updated: item.ultima_atualizacao || null,
      },
      provenance: { learning_method: 'manual_classification' },
      active: true,
    };
  }

  if (fonte === 'memoria_importacao') {
    return {
      ...base,
      title: `Memória: ${item.label || item.tipo_import}`,
      knowledge_type: 'import_layout_memory',
      content: `Tipo "${item.tipo_import}" está em modo "${item.status}" com ${item.acertos_consecutivos} acerto(s) consecutivo(s) de ${item.total_importacoes} importação(ões).`,
      keywords: [item.tipo_import, item.status, ...(item.assinatura_layout || [])],
      category: item.tipo_import,
      layout_signature: item.assinatura_layout || [],
      confidence: item.status === 'economico' ? 100 : item.status === 'aguardando_aval' ? 80 : 40,
      usage: {
        consecutive_hits: item.acertos_consecutivos || 0,
        total_imports: item.total_importacoes || 0,
        last_import: item.ultima_importacao || null,
        validated_at: item.data_aval || null,
        validated_by: item.avalizado_por || null,
      },
      provenance: { learning_method: 'layout_signature_matching' },
      active: item.status !== 'aprendendo',
    };
  }

  if (fonte === 'regra_recorrente') {
    return {
      ...base,
      title: `Recorrência: ${item.nome}`,
      knowledge_type: 'recurring_pattern',
      content: `"${item.nome}" — padrão "${item.padrao_descricao}", valor esperado ${item.valor_esperado}, vencimento dia ${item.dia_vencimento}, categoria ${item.categoria}.`,
      keywords: [item.padrao_descricao, item.fornecedor, item.categoria, item.empresa],
      category: item.categoria,
      expected_value: item.valor_esperado,
      tolerance_percent: item.tolerancia_percentual || 5,
      due_day: item.dia_vencimento,
      company: item.empresa,
      payment_method: item.forma_pagamento,
      value_history: item.historico_valores || [],
      last_occurrence: item.ultima_ocorrencia || null,
      confidence: (item.historico_valores || []).length >= 3 ? 90 : 50,
      provenance: { learning_method: 'pattern_detection' },
      active: item.is_ativa !== false,
    };
  }

  if (fonte === 'sugestao_conciliacao') {
    return {
      ...base,
      title: `Sugestão: ${item.descricao_conta || item.entidade_tipo}`,
      knowledge_type: 'reconciliation_suggestion',
      content: item.motivo || `Sugestão de conciliação (${item.confianca}% confiança) entre extrato e ${item.entidade_tipo}.`,
      keywords: [item.entidade_tipo, item.fornecedor, item.descricao_extrato],
      entity_type: item.entidade_tipo,
      expected_value: item.valor_esperado,
      actual_value: item.valor_extrato,
      diff_days: item.diff_dias,
      confidence: item.confianca || 70,
      status: item.status,
      reason: item.motivo,
      resolved_at: item.resolvida_em || null,
      provenance: { learning_method: 'fuzzy_matching' },
      active: item.status === 'pendente',
    };
  }

  if (fonte === 'conhecimento_negocio') {
    return {
      ...base,
      title: item.titulo,
      knowledge_type: 'business_knowledge',
      scope: item.tema,
      content: item.conteudo,
      keywords: item.keywords || [],
      category: item.tema,
      origin: item.origem || null,
      reference_date: item.data_referencia || null,
      confidence: 100,
      provenance: { learning_method: 'human_curated' },
      active: item.ativo !== false,
    };
  }

  return base;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action = 'list', token, fonte, id, categoria, status, query, limit = 20 } = body;

    // Autenticação: token de hub OU usuário logado
    const hubToken = Deno.env.get('NEXUS_HUB_TOKEN');
    const tokenValido = token && hubToken && token === hubToken;
    let usuarioValido = false;
    if (!tokenValido) {
      const user = await base44.auth.me().catch(() => null);
      usuarioValido = !!user;
    }
    if (!tokenValido && !usuarioValido) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = base44.asServiceRole.entities;

    // action=get — busca por id em uma fonte específica
    if (action === 'get') {
      if (!id || !fonte || !FONTES[fonte]) {
        return Response.json({ error: 'id e fonte (válida) são obrigatórios para action=get' }, { status: 400 });
      }
      const item = await svc[FONTES[fonte]].get(id);
      if (!item) {
        return Response.json({ error: 'Conhecimento não encontrado' }, { status: 404 });
      }
      return Response.json({ okf_version: '1.0', source: 'NeuralFin', item: toOKF(item, fonte) });
    }

    // Determinar quais fontes consultar
    const fontesConsultar = fonte && FONTES[fonte] ? [fonte] : Object.keys(FONTES);

    const resultados = [];
    const limitePorFonte = Math.min(limit * 2, 100);

    for (const f of fontesConsultar) {
      const entidade = FONTES[f];
      let itens;
      try {
        itens = await svc[entidade].list('-updated_date', limitePorFonte);
      } catch {
        continue;
      }

      // Filtros comuns
      if (categoria) {
        const catNorm = normalizar(categoria);
        itens = itens.filter(i => {
          if (f === 'regra_categorizacao') return normalizar(i.categoria) === catNorm;
          if (f === 'regra_recorrente') return normalizar(i.categoria) === catNorm;
          if (f === 'memoria_importacao') return normalizar(i.tipo_import) === catNorm;
          if (f === 'conhecimento_negocio') return normalizar(i.tema) === catNorm;
          return false;
        });
      }

      if (status) {
        itens = itens.filter(i => {
          if (f === 'memoria_importacao') return i.status === status;
          if (f === 'sugestao_conciliacao') return i.status === status;
          if (f === 'regra_recorrente') return status === 'ativa' ? i.is_ativa !== false : i.is_ativa === false;
          return true;
        });
      }

      // Busca textual
      if (query) {
        const q = normalizar(query);
        itens = itens.filter(i => {
          const campos = [];
          if (f === 'regra_categorizacao') campos.push(i.termo_chave, i.categoria, i.exemplo_descricao);
          if (f === 'memoria_importacao') campos.push(i.tipo_import, i.label, i.observacoes, ...(i.assinatura_layout || []));
          if (f === 'regra_recorrente') campos.push(i.nome, i.padrao_descricao, i.fornecedor, i.observacoes);
          if (f === 'sugestao_conciliacao') campos.push(i.descricao_conta, i.fornecedor, i.descricao_extrato, i.motivo);
          if (f === 'conhecimento_negocio') campos.push(i.titulo, i.conteudo, i.origem, ...(i.keywords || []));
          return campos.some(c => normalizar(c).includes(q));
        });
      }

      itens.forEach(i => resultados.push(toOKF(i, f)));
    }

    // Ordenar por updated_date desc e limitar
    resultados.sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));
    const final = resultados.slice(0, limit);

    return Response.json({
      okf_version: '1.0',
      source: 'NeuralFin Knowledge Hub',
      total: final.length,
      sources_consulted: fontesConsultar,
      items: final,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});