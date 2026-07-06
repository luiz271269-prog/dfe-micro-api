import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Concilia Cartões de Crédito ↔ Despesas Operacionais.
// REGRAS:
//   - Despesas com forma_pagamento='cartao' e sem lancamento_cartao_id → procurar LancamentoCartao
//   - MATCH PERFEITO (mesmo valor ±R$0,50, mesma data) → vincula automaticamente
//   - VALOR PRÓXIMO (±R$0,50) mas data divergente (±10 dias) → cria SugestaoConciliacao
//   - Match por estabelecimento ↔ fornecedor quando disponível (boost de confiança)

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function nomesSimilares(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // primeira palavra significativa (≥4 letras) em comum
  const pa = na.split(' ').filter(p => p.length >= 4);
  const pb = nb.split(' ').filter(p => p.length >= 4);
  return pa.some(x => pb.includes(x));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;

    const [despesas, lancamentosCartao, sugestoesAntigas] = await Promise.all([
      svc.DespesaOperacional.filter({ forma_pagamento: 'cartao' }),
      svc.LancamentoCartao.list('-data_lancamento', 3000),
      svc.SugestaoConciliacao.filter({ status: 'pendente' }),
    ]);

    // Despesas pendentes sem vínculo de cartão
    const despesasAbertas = despesas.filter(d =>
      d.status === 'pendente' && !d.lancamento_cartao_id
    );

    // Lançamentos de cartão já vinculados a despesas
    const cartaoJaVinculado = new Set(
      despesas.filter(d => d.lancamento_cartao_id).map(d => d.lancamento_cartao_id)
    );
    // Sugestões já existentes
    const sugestoesExistentes = new Set(
      sugestoesAntigas
        .filter(s => s.entidade_tipo === 'DespesaOperacional')
        .map(s => s.entidade_id)
    );

    const cartoesDisponiveis = lancamentosCartao.filter(l =>
      !cartaoJaVinculado.has(l.id)
    );

    const TOL_VALOR = 0.50;
    const JANELA_SUGESTAO = 10;

    let baixasAuto = 0;
    let sugestoesCriadas = 0;
    const despesasUsadas = new Set();
    const cartoesUsados = new Set();

    // PASSO 1 — MATCH PERFEITO (mesmo valor, mesma data)
    for (const despesa of despesasAbertas) {
      if (despesasUsadas.has(despesa.id)) continue;
      const valor = Math.abs(despesa.valor || 0);
      if (valor < 0.01) continue;

      const match = cartoesDisponiveis.find(l => {
        if (cartoesUsados.has(l.id)) return false;
        if (Math.abs(Math.abs(l.valor) - valor) > TOL_VALOR) return false;
        return l.data_lancamento === (despesa.data || despesa.data_vencimento);
      });

      if (!match) continue;

      try {
        await svc.DespesaOperacional.update(despesa.id, {
          status: 'pago',
          data: match.data_lancamento,
          lancamento_cartao_id: match.id,
        });
        cartoesUsados.add(match.id);
        despesasUsadas.add(despesa.id);
        baixasAuto++;
      } catch (err) {
        console.error('Erro baixa auto cartão-despesa:', err.message);
      }
    }

    // PASSO 2 — SUGESTÕES (valor próximo, data na janela, ou match de estabelecimento)
    for (const despesa of despesasAbertas) {
      if (despesasUsadas.has(despesa.id)) continue;
      if (sugestoesExistentes.has(despesa.id)) continue;
      const valor = Math.abs(despesa.valor || 0);
      if (valor < 0.01) continue;
      const dataDespesa = despesa.data || despesa.data_vencimento;
      if (!dataDespesa) continue;

      const dataBase = new Date(dataDespesa);

      const candidatos = cartoesDisponiveis
        .filter(l => {
          if (cartoesUsados.has(l.id)) return false;
          if (Math.abs(Math.abs(l.valor) - valor) > TOL_VALOR) return false;
          const diff = Math.abs((new Date(l.data_lancamento) - dataBase) / 86400000);
          return diff <= JANELA_SUGESTAO;
        })
        .map(l => {
          const diff = Math.abs((new Date(l.data_lancamento) - dataBase) / 86400000);
          const nomeMatch = nomesSimilares(despesa.fornecedor, l.estabelecimento);
          return { l, diff, nomeMatch };
        })
        .sort((a, b) => {
          // Prioriza match de nome, depois menor diferença de data
          if (a.nomeMatch !== b.nomeMatch) return a.nomeMatch ? -1 : 1;
          return a.diff - b.diff;
        });

      if (candidatos.length === 0) continue;

      const { l: match, diff, nomeMatch } = candidatos[0];
      const confianca = nomeMatch
        ? (diff <= 3 ? 90 : 75)
        : (diff <= 3 ? 75 : 60);

      try {
        await svc.SugestaoConciliacao.create({
          lancamento_bancario_id: match.id,
          entidade_tipo: 'DespesaOperacional',
          entidade_id: despesa.id,
          descricao_conta: despesa.descricao,
          fornecedor: despesa.fornecedor || '—',
          valor_esperado: valor,
          valor_extrato: Math.abs(match.valor),
          data_vencimento: dataDespesa,
          data_extrato: match.data_lancamento,
          descricao_extrato: match.estabelecimento,
          diff_dias: Math.round(diff),
          confianca,
          motivo: `Cartão: valor bate (R$ ${valor.toFixed(2)})${nomeMatch ? ', fornecedor confere' : ''}, ${Math.round(diff)} dia(s) de diferença`,
          status: 'pendente',
        });
        despesasUsadas.add(despesa.id);
        cartoesUsados.add(match.id);
        sugestoesCriadas++;
      } catch (err) {
        console.error('Erro criar sugestão cartão-despesa:', err.message);
      }
    }

    return Response.json({
      success: true,
      baixas_automaticas: baixasAuto,
      sugestoes_criadas: sugestoesCriadas,
      total_despesas_abertas: despesasAbertas.length,
      total_cartoes_disponiveis: cartoesDisponiveis.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});