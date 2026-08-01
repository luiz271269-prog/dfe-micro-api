import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import { eixosDoVinculo } from '../../shared/classificacaoPadrao.ts';

// PIPELINE DINÂMICO DE CONCILIAÇÃO
// Orquestra todos os motores em sequência e depois auto-aprova
// sugestões pendentes com confiança >= 90 (valor exato + nome confere + poucos dias).
// Roda via automação agendada (sem usuário) ou manualmente por admin.

const ENGINES = [
  'sanearClassificacaoExtrato',
  'conciliarContasAPagarExtrato',
  'conciliarCobrancasBanco',
  'conciliarFolhaExtrato',
  'conciliarFaturasCartao',
  'conciliarCartoesDespesas',
  'conciliarObrasCartoes',
  'conciliarComprasPagamentos',
];

const CONFIANCA_AUTO = 90;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;

    // 1. Roda cada motor em sequência via HTTP direto com token interno
    // (funciona tanto em automação agendada quanto em chamada manual)
    const appId = Deno.env.get('BASE44_APP_ID');
    const token = Deno.env.get('NEXUS_HUB_TOKEN');
    const resultadosEngines = {};
    for (const nome of ENGINES) {
      try {
        const resp = await fetch(`https://base44.app/api/apps/${appId}/functions/${nome}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ internal_token: token }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const d = await resp.json();
        resultadosEngines[nome] = {
          ok: true,
          baixas: d.baixas_automaticas ?? d.conciliados ?? d.conciliadas ?? 0,
          sugestoes: d.sugestoes_criadas ?? 0,
        };
      } catch (err) {
        resultadosEngines[nome] = { ok: false, erro: err.message };
      }
    }

    // 2. Auto-aprovação de sugestões com confiança alta
    const sugestoes = await svc.SugestaoConciliacao.filter({ status: 'pendente' });
    const altas = sugestoes.filter(s => (s.confianca || 0) >= CONFIANCA_AUTO);

    let aprovadas = 0;
    const errosAprovacao = [];

    for (const s of altas) {
      try {
        const lanc = await svc.LancamentoBancario.get(s.lancamento_bancario_id);
        const vincsLanc = lanc ? await svc.VinculoExtrato.filter({ lancamento_bancario_id: lanc.id }) : [];
        if (!lanc || lanc.status_conciliacao === 'conciliado' || vincsLanc.length > 0) {
          await svc.SugestaoConciliacao.update(s.id, { status: 'rejeitada', resolvida_em: new Date().toISOString(), motivo: (s.motivo || '') + ' · descartada: lançamento já conciliado' });
          continue;
        }

        const isCredito = lanc.valor > 0;

        // Baixa na entidade de origem
        const baixaPorTipo = {
          TituloCobranca: { status: 'pago', data_pagamento: lanc.data, valor_pago: Math.abs(lanc.valor), lancamento_bancario_id: lanc.id },
          DespesaOperacional: { status: 'pago', lancamento_bancario_id: lanc.id },
          Tributo: { status: 'pago', data_pagamento: lanc.data, valor_pago: Math.abs(lanc.valor), lancamento_bancario_id: lanc.id },
          FaturaCartao: { status: 'paga_total', data_pagamento: lanc.data, valor_pago: Math.abs(lanc.valor), lancamento_bancario_id: lanc.id },
          FolhaPagamento: { status: 'pago', data_pagamento: lanc.data, lancamento_bancario_id: lanc.id },
          ItemCompra: { status_pagamento: 'pago', valor_pago: Math.abs(lanc.valor), lancamento_bancario_id: lanc.id },
        };
        const baixa = baixaPorTipo[s.entidade_tipo];
        if (!baixa) continue;
        await svc[s.entidade_tipo].update(s.entidade_id, baixa);

        const origemReg = await svc[s.entidade_tipo].get(s.entidade_id).catch(() => null);
        const eixos = eixosDoVinculo(origemReg, s.entidade_tipo, lanc);

        await svc.VinculoExtrato.create({
          lancamento_bancario_id: lanc.id,
          entidade_tipo: s.entidade_tipo,
          entidade_id: s.entidade_id,
          valor_alocado: Math.abs(lanc.valor),
          ...eixos,
          tipo_vinculo: isCredito ? 'recebimento_integral' : 'pagamento_integral',
          conciliado_por: 'auto',
          confianca: s.confianca,
          observacao: `Pipeline auto (conf. ${s.confianca}) · ${s.descricao_conta || ''}`,
        });

        await svc.LancamentoBancario.update(lanc.id, {
          status_conciliacao: 'conciliado',
          vinculos_count: (lanc.vinculos_count || 0) + 1,
          valor_conciliado: (lanc.valor_conciliado || 0) + Math.abs(lanc.valor),
        });

        await svc.SugestaoConciliacao.update(s.id, { status: 'confirmada', resolvida_em: new Date().toISOString() });
        aprovadas++;
      } catch (err) {
        errosAprovacao.push({ sugestao: s.id, erro: err.message });
      }
    }

    return Response.json({
      success: true,
      executado_em: new Date().toISOString(),
      engines: resultadosEngines,
      sugestoes_pendentes: sugestoes.length,
      auto_aprovadas: aprovadas,
      erros_aprovacao: errosAprovacao.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});