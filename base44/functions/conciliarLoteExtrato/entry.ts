import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import { eixosDoVinculo } from '../../shared/classificacaoPadrao.ts';

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

    // 1) Carregar dados — REGRA: conciliação lê o BANCO inteiro (pendências),
    // nunca "a última importação". Sem mês informado, busca todos os lançamentos
    // não conciliados do banco (pendência é sempre um conjunto pequeno).
    const svcRead = base44.asServiceRole.entities;
    const [lancsAll, despesas, tributos, folhas, faturas] = await Promise.all([
      mes_referencia
        ? svcRead.LancamentoBancario.filter({ mes_referencia })
        : svcRead.LancamentoBancario.list('-data', 10000),
      svcRead.DespesaOperacional.filter({ status: 'pendente' }),
      svcRead.Tributo.list('-data_vencimento', 2000),
      svcRead.FolhaPagamento.filter({ status: 'pendente' }),
      svcRead.FaturaCartao.list('-data_vencimento', 1000),
    ]);
    // Só pendências entram na conciliação
    const lancs = (lancsAll || []).filter(l => l.status_conciliacao !== 'conciliado');

    const tributosAbertos = tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido');
    const faturasAbertas = faturas.filter(f => f.status === 'aberta' || f.status === 'vencida');

    // Exclui transferências e movimentos internos — nunca são contas a pagar
    const debitos = (lancs || []).filter(l =>
      (l.valor || 0) < 0 &&
      l.categoria !== 'transferencia' &&
      l.categoria !== 'interno'
    );
    const baixas = [];
    const duplicidades = [];

    // Mapa dos tipos para VinculoExtrato
    const tipoMap = {
      despesa: 'DespesaOperacional',
      tributo: 'Tributo',
      folha: 'FolhaPagamento',
      fatura: 'FaturaCartao',
    };

    // Pré-carrega vínculos já existentes nos lançamentos em escopo p/ evitar duplicidade
    const lancIds = debitos.map(l => l.id);
    const vinculosExistentes = lancIds.length > 0
      ? await base44.asServiceRole.entities.VinculoExtrato.list('-created_date', 10000)
      : [];
    const jaVinculado = new Set(
      vinculosExistentes
        .filter(v => lancIds.includes(v.lancamento_bancario_id))
        .map(v => `${v.lancamento_bancario_id}|${v.entidade_tipo}|${v.entidade_id}`)
    );
    const temVinculoLanc = new Set(
      vinculosExistentes
        .filter(v => lancIds.includes(v.lancamento_bancario_id))
        .map(v => v.lancamento_bancario_id)
    );

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

      // (B) Buscar match em contas a pagar pendentes — ROTEADO PELA CATEGORIA
      // já classificada no extrato (banco de dados). A categoria define ONDE procurar:
      // tributo→Tributos, pessoal/pro_labore→Folha, despesa_operacional→Despesas,
      // financeiro→Faturas de cartão, fornecedor→Despesas+Faturas.
      // Sem categoria mapeada, procura em tudo (comportamento antigo).
      const rotaCategoria = {
        tributo: ['tributo'],
        pessoal: ['folha'],
        pro_labore: ['folha'],
        despesa_operacional: ['despesa'],
        financeiro: ['fatura', 'despesa'],
        fornecedor: ['despesa', 'fatura'],
      };
      const tiposPermitidos = rotaCategoria[lanc.categoria] || ['despesa', 'tributo', 'folha', 'fatura'];
      const roteado = !!rotaCategoria[lanc.categoria];
      const candidatos = [];

      if (tiposPermitidos.includes('despesa')) for (const d of despesas) {
        if (Math.abs(d.valor - valorAbs) > 0.50) continue;
        const ref = d.data_vencimento || d.data;
        const dd = diffDias(ref, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'despesa', ref: d, score: dd * 10 + Math.abs(d.valor - valorAbs) });
      }
      if (tiposPermitidos.includes('tributo')) for (const t of tributosAbertos) {
        const valorT = (t.valor_original || 0) - (t.valor_pago || 0);
        if (Math.abs(valorT - valorAbs) > 0.50) continue;
        const dd = diffDias(t.data_vencimento, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'tributo', ref: t, score: dd * 10 + Math.abs(valorT - valorAbs) });
      }
      if (tiposPermitidos.includes('folha')) for (const f of folhas) {
        if (Math.abs(f.salario_liquido - valorAbs) > 0.50) continue;
        const [y, m] = (f.competencia || '').split('-').map(Number);
        if (!y || !m) continue;
        const venc = new Date(y, m, 5).toISOString().slice(0, 10);
        const dd = diffDias(venc, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'folha', ref: f, score: dd * 10 + Math.abs(f.salario_liquido - valorAbs) });
      }
      if (tiposPermitidos.includes('fatura')) for (const fat of faturasAbertas) {
        const aberto = fat.valor_total - (fat.valor_pago || 0);
        if (Math.abs(aberto - valorAbs) > 1.0) continue;
        const dd = diffDias(fat.data_vencimento, lanc.data);
        if (dd > 15) continue;
        candidatos.push({ tipo: 'fatura', ref: fat, score: dd * 10 + Math.abs(aberto - valorAbs) });
      }

      // Se já tem vínculo neste lançamento, pula (evita baixar 2x)
      if (temVinculoLanc.has(lanc.id)) continue;

      candidatos.sort((a, b) => a.score - b.score);
      const best = candidatos[0];
      if (!best) continue;
      // Confiança: quando a busca foi roteada pela categoria classificada, o match é
      // mais específico — tolera até 3 dias de diferença (score < 30). Sem roteamento,
      // mantém o critério rígido (score < 5: mesmo dia/dia seguinte + valor exato).
      const limiteScore = roteado ? 30 : 5;
      if (best.score >= limiteScore) continue;

      const entidadeTipo = tipoMap[best.tipo];
      const chaveVinc = `${lanc.id}|${entidadeTipo}|${best.ref.id}`;
      if (jaVinculado.has(chaveVinc)) continue;

      try {
        // 1) Atualiza status da obrigação (retrocompat — UIs atuais lêem status)
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

        // 2) Cria VinculoExtrato (fonte de verdade da conciliação)
        await base44.asServiceRole.entities.VinculoExtrato.create({
          lancamento_bancario_id: lanc.id,
          entidade_tipo: entidadeTipo,
          entidade_id: best.ref.id,
          valor_alocado: valorAbs,
          ...eixosDoVinculo(best.ref, entidadeTipo, lanc),
          tipo_vinculo: 'pagamento_integral',
          conciliado_por: 'auto',
          confianca: Math.max(60, Math.round(100 - best.score * 5)),
        });
        jaVinculado.add(chaveVinc);

        // 3) Atualiza cache do LancamentoBancario
        await base44.asServiceRole.entities.LancamentoBancario.update(lanc.id, {
          status_conciliacao: 'conciliado',
          vinculos_count: 1,
          valor_conciliado: valorAbs,
        });

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