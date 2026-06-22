import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Conciliação contínua de Contas a Pagar com Extrato Bancário.
// REGRAS:
//   - MATCH PERFEITO (mesma data, mesmo valor ±R$0,50) → baixa automática (cria VinculoExtrato + atualiza entidade)
//   - VALOR PRÓXIMO mas data divergente (±10 dias) → cria SugestaoConciliacao para o usuário confirmar
//   - Folha de pagamento NÃO entra aqui (já tem conciliarFolhaExtrato dedicado)

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function mapearTipoEntidade(origem) {
  return {
    despesa: 'DespesaOperacional',
    tributo: 'Tributo',
    fatura: 'FaturaCartao',
  }[origem];
}

function consolidarContasAbertas({ despesas, tributos, faturas, cartoes }) {
  const itens = [];
  despesas.filter(d => d.status === 'pendente').forEach(d => {
    itens.push({
      origem_id: d.id, origem_tipo: 'despesa',
      descricao: d.descricao, fornecedor: d.fornecedor || '—',
      valor: d.valor, data_vencimento: d.data_vencimento || d.data,
    });
  });
  tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido').forEach(t => {
    itens.push({
      origem_id: t.id, origem_tipo: 'tributo',
      descricao: t.descricao || `${t.tipo} ${t.competencia}`,
      fornecedor: 'Receita / Governo',
      valor: (t.valor_original || 0) - (t.valor_pago || 0),
      data_vencimento: t.data_vencimento,
    });
  });
  faturas.filter(f => f.status === 'aberta' || f.status === 'vencida').forEach(f => {
    const c = cartoes.find(x => x.id === f.conta_cartao_id);
    itens.push({
      origem_id: f.id, origem_tipo: 'fatura',
      descricao: `Fatura ${c?.nome || 'Cartão'} — ${f.mes_referencia}`,
      fornecedor: c?.nome || 'Cartão',
      valor: f.valor_total - (f.valor_pago || 0),
      data_vencimento: f.data_vencimento,
    });
  });
  return itens;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;

    const [despesas, tributos, faturas, cartoes, lancamentos, vinculos, sugestoesAntigas] = await Promise.all([
      svc.DespesaOperacional.list('-data', 2000),
      svc.Tributo.list('-data_vencimento', 2000),
      svc.FaturaCartao.list('-data_vencimento', 1000),
      svc.ContaCartao.list(),
      svc.LancamentoBancario.list('-data', 3000),
      svc.VinculoExtrato.list('-created_date', 5000),
      svc.SugestaoConciliacao.filter({ status: 'pendente' }),
    ]);

    const itens = consolidarContasAbertas({ despesas, tributos, faturas, cartoes });

    // Excluir contas já vinculadas e lançamentos já vinculados/em sugestão
    const lancsVinculados = new Set(vinculos.map(v => v.lancamento_bancario_id));
    const contasVinculadas = new Set(vinculos.map(v => `${v.entidade_tipo}-${v.entidade_id}`));
    const lancsEmSugestao = new Set(sugestoesAntigas.map(s => s.lancamento_bancario_id));
    const contasEmSugestao = new Set(sugestoesAntigas.map(s => `${s.entidade_tipo}-${s.entidade_id}`));

    const contasAbertas = itens.filter(c => {
      const ent = mapearTipoEntidade(c.origem_tipo);
      const key = `${ent}-${c.origem_id}`;
      return !contasVinculadas.has(key) && !contasEmSugestao.has(key);
    });

    const debitos = lancamentos.filter(l =>
      l.valor < 0 &&
      l.status_conciliacao !== 'conciliado' &&
      l.categoria !== 'transferencia' &&
      l.categoria !== 'interno' &&
      !lancsVinculados.has(l.id) &&
      !lancsEmSugestao.has(l.id)
    );

    const TOL_VALOR = 0.50;
    const JANELA_SUGESTAO = 10; // dias

    let baixasAuto = 0;
    let sugestoesCriadas = 0;
    const contasUsadas = new Set();
    const lancsUsados = new Set();

    // PASSO 1 — MATCH PERFEITO (mesma data, mesmo valor)
    for (const lanc of debitos) {
      if (lancsUsados.has(lanc.id)) continue;
      const valor = Math.abs(lanc.valor);

      const match = contasAbertas.find(c => {
        if (contasUsadas.has(c.origem_id)) return false;
        if (Math.abs(c.valor - valor) > TOL_VALOR) return false;
        if (!c.data_vencimento) return false;
        return c.data_vencimento === lanc.data; // MESMA DATA EXATA
      });

      if (!match) continue;

      const entidadeTipo = mapearTipoEntidade(match.origem_tipo);
      const valorAlocado = valor;

      try {
        // Atualiza entidade origem — match perfeito 1:1, grava o FK direto para o LancamentoBancario
        if (match.origem_tipo === 'despesa') {
          await svc.DespesaOperacional.update(match.origem_id, { status: 'pago', data: lanc.data, lancamento_bancario_id: lanc.id });
        } else if (match.origem_tipo === 'tributo') {
          await svc.Tributo.update(match.origem_id, { status: 'pago', data_pagamento: lanc.data, valor_pago: valorAlocado, lancamento_bancario_id: lanc.id });
        } else if (match.origem_tipo === 'fatura') {
          await svc.FaturaCartao.update(match.origem_id, { status: 'paga_total', data_pagamento: lanc.data, valor_pago: valorAlocado, lancamento_bancario_id: lanc.id });
        }
        // Cria vínculo
        await svc.VinculoExtrato.create({
          lancamento_bancario_id: lanc.id,
          entidade_tipo: entidadeTipo,
          entidade_id: match.origem_id,
          valor_alocado: valorAlocado,
          tipo_vinculo: 'pagamento_integral',
          conciliado_por: 'auto',
          confianca: 100,
          observacao: `Match perfeito · ${match.descricao}`,
        });
        // Atualiza lançamento
        await svc.LancamentoBancario.update(lanc.id, {
          status_conciliacao: 'conciliado',
          vinculos_count: (lanc.vinculos_count || 0) + 1,
          valor_conciliado: (lanc.valor_conciliado || 0) + valorAlocado,
        });
        contasUsadas.add(match.origem_id);
        lancsUsados.add(lanc.id);
        baixasAuto++;
      } catch (err) {
        console.error('Erro baixa auto:', err.message);
      }
    }

    // PASSO 2 — SUGESTÕES (valor exato, data dentro de janela)
    for (const lanc of debitos) {
      if (lancsUsados.has(lanc.id)) continue;
      const valor = Math.abs(lanc.valor);
      const dataLanc = new Date(lanc.data);

      const candidatos = contasAbertas
        .filter(c => {
          if (contasUsadas.has(c.origem_id)) return false;
          if (Math.abs(c.valor - valor) > TOL_VALOR) return false;
          if (!c.data_vencimento) return false;
          const diff = Math.abs((new Date(c.data_vencimento) - dataLanc) / 86400000);
          return diff > 0 && diff <= JANELA_SUGESTAO;
        })
        .map(c => ({
          c,
          diff: Math.abs((new Date(c.data_vencimento) - dataLanc) / 86400000),
        }))
        .sort((a, b) => a.diff - b.diff);

      if (candidatos.length === 0) continue;

      const { c: match, diff } = candidatos[0];

      try {
        await svc.SugestaoConciliacao.create({
          lancamento_bancario_id: lanc.id,
          entidade_tipo: mapearTipoEntidade(match.origem_tipo),
          entidade_id: match.origem_id,
          descricao_conta: match.descricao,
          fornecedor: match.fornecedor,
          valor_esperado: match.valor,
          valor_extrato: valor,
          data_vencimento: match.data_vencimento,
          data_extrato: lanc.data,
          descricao_extrato: lanc.descricao,
          diff_dias: Math.round(diff),
          confianca: diff <= 3 ? 85 : diff <= 7 ? 70 : 55,
          motivo: `Valor bate (R$ ${valor.toFixed(2)}), mas pago ${Math.round(diff)} dia(s) ${dataLanc < new Date(match.data_vencimento) ? 'antes' : 'depois'} do vencimento`,
          status: 'pendente',
        });
        contasUsadas.add(match.origem_id);
        lancsUsados.add(lanc.id);
        sugestoesCriadas++;
      } catch (err) {
        console.error('Erro criar sugestão:', err.message);
      }
    }

    return Response.json({
      success: true,
      baixas_automaticas: baixasAuto,
      sugestoes_criadas: sugestoesCriadas,
      total_debitos_analisados: debitos.length,
      total_contas_abertas: contasAbertas.length,
    });
  } catch (error) {
    console.error('Erro conciliação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});