import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Concilia Obras e Reformas ↔ Cartões de Crédito.
// REGRAS:
//   - ObraReforma sem lancamento_cartao_id e sem lancamento_bancario_id → procurar LancamentoCartao
//   - MATCH PERFEITO (mesmo valor ±R$0,50, mesma data) → vincula automaticamente
//   - VALOR PRÓXIMO (±R$0,50) mas data divergente (±10 dias) → cria SugestaoConciliacao
//   - Match por responsável ↔ estabelecimento quando disponível (boost de confiança)

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function nomesSimilares(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = na.split(' ').filter(p => p.length >= 4);
  const pb = nb.split(' ').filter(p => p.length >= 4);
  return pa.some(x => pb.includes(x));
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

    const [obras, lancamentosCartao, despesasComCartao, sugestoesAntigas] = await Promise.all([
      svc.ObraReforma.list('-data', 2000),
      svc.LancamentoCartao.list('-data_lancamento', 3000),
      svc.DespesaOperacional.filter({ forma_pagamento: 'cartao' }),
      svc.SugestaoConciliacao.filter({ status: 'pendente' }),
    ]);

    // Obras sem nenhum vínculo de pagamento
    const obrasAbertas = obras.filter(o =>
      !o.lancamento_cartao_id && !o.lancamento_bancario_id
    );

    // Cartões já vinculados a despesas ou obras
    const cartaoJaVinculadoDespesa = new Set(
      despesasComCartao.filter(d => d.lancamento_cartao_id).map(d => d.lancamento_cartao_id)
    );
    const cartaoJaVinculadoObra = new Set(
      obras.filter(o => o.lancamento_cartao_id).map(o => o.lancamento_cartao_id)
    );
    const sugestoesExistentes = new Set(
      sugestoesAntigas
        .filter(s => s.entidade_tipo === 'ObraReforma')
        .map(s => s.entidade_id)
    );

    const cartoesDisponiveis = lancamentosCartao.filter(l =>
      !cartaoJaVinculadoDespesa.has(l.id) && !cartaoJaVinculadoObra.has(l.id)
    );

    const TOL_VALOR = 0.50;
    const JANELA_SUGESTAO = 10;

    let baixasAuto = 0;
    let sugestoesCriadas = 0;
    const obrasUsadas = new Set();
    const cartoesUsados = new Set();

    // PASSO 1 — MATCH PERFEITO (mesmo valor, mesma data)
    for (const obra of obrasAbertas) {
      if (obrasUsadas.has(obra.id)) continue;
      const valor = Math.abs(obra.valor || 0);
      if (valor < 0.01) continue;

      const match = cartoesDisponiveis.find(l => {
        if (cartoesUsados.has(l.id)) return false;
        if (Math.abs(Math.abs(l.valor) - valor) > TOL_VALOR) return false;
        return l.data_lancamento === obra.data;
      });

      if (!match) continue;

      try {
        await svc.ObraReforma.update(obra.id, {
          lancamento_cartao_id: match.id,
        });
        cartoesUsados.add(match.id);
        obrasUsadas.add(obra.id);
        baixasAuto++;
      } catch (err) {
        console.error('Erro baixa auto obra-cartão:', err.message);
      }
    }

    // PASSO 2 — SUGESTÕES (valor próximo, data na janela, ou match de responsável)
    for (const obra of obrasAbertas) {
      if (obrasUsadas.has(obra.id)) continue;
      if (sugestoesExistentes.has(obra.id)) continue;
      const valor = Math.abs(obra.valor || 0);
      if (valor < 0.01) continue;
      if (!obra.data) continue;

      const dataBase = new Date(obra.data);

      const candidatos = cartoesDisponiveis
        .filter(l => {
          if (cartoesUsados.has(l.id)) return false;
          if (Math.abs(Math.abs(l.valor) - valor) > TOL_VALOR) return false;
          const diff = Math.abs((new Date(l.data_lancamento) - dataBase) / 86400000);
          return diff <= JANELA_SUGESTAO;
        })
        .map(l => {
          const diff = Math.abs((new Date(l.data_lancamento) - dataBase) / 86400000);
          const nomeMatch = nomesSimilares(obra.responsavel, l.estabelecimento);
          return { l, diff, nomeMatch };
        })
        .sort((a, b) => {
          if (a.nomeMatch !== b.nomeMatch) return a.nomeMatch ? -1 : 1;
          return a.diff - b.diff;
        });

      if (candidatos.length === 0) continue;

      const { l: match, diff, nomeMatch } = candidatos[0];
      const confianca = nomeMatch
        ? (diff <= 3 ? 90 : 75)
        : (diff <= 3 ? 70 : 55);

      try {
        await svc.SugestaoConciliacao.create({
          lancamento_bancario_id: match.id,
          entidade_tipo: 'ObraReforma',
          entidade_id: obra.id,
          descricao_conta: obra.descricao,
          fornecedor: obra.responsavel || '—',
          valor_esperado: valor,
          valor_extrato: Math.abs(match.valor),
          data_vencimento: obra.data,
          data_extrato: match.data_lancamento,
          descricao_extrato: match.estabelecimento,
          diff_dias: Math.round(diff),
          confianca,
          motivo: `Obra/Reforma: valor bate (R$ ${valor.toFixed(2)})${nomeMatch ? ', responsável confere' : ''}, ${Math.round(diff)} dia(s) de diferença · ${obra.local_obra}`,
          status: 'pendente',
        });
        obrasUsadas.add(obra.id);
        cartoesUsados.add(match.id);
        sugestoesCriadas++;
      } catch (err) {
        console.error('Erro criar sugestão obra-cartão:', err.message);
      }
    }

    return Response.json({
      success: true,
      baixas_automaticas: baixasAuto,
      sugestoes_criadas: sugestoesCriadas,
      total_obras_abertas: obrasAbertas.length,
      total_cartoes_disponiveis: cartoesDisponiveis.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});