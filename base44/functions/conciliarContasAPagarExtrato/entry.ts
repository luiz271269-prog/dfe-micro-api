import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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
    compra: 'ItemCompra',
    obra: 'ObraReforma',
  }[origem];
}

// REGRA DO CANAL CARTÃO ("evapora"): item com lancamento_cartao_id já virou fatura — sai do Contas a Pagar.
function evaporou(reg) {
  return !!reg?.lancamento_cartao_id;
}

// Afinidade textual entre o extrato e a conta a pagar (bônus negativo = match melhor)
function bonusAfinidade(lanc, conta) {
  const texto = norm(`${lanc.descricao || ''} ${lanc.detalhe || ''}`);
  if (!texto) return 0;

  if (conta.origem_tipo === 'fatura') {
    if (['cartao', 'fatura', 'credito'].some(p => texto.includes(p))) return -30;
    const partes = norm(conta.fornecedor).split(/[\s\-—–]+/).filter(p => p.length >= 4);
    if (partes.some(p => texto.includes(p))) return -40;
    return 0;
  }
  if (conta.origem_tipo === 'tributo') {
    const tags = ['das', 'darf', 'gps', 'icms', 'iss', 'inss', 'fgts', 'simples', 'tributo', 'gov', 'receita', 'federal'];
    if (tags.some(t => texto.includes(t))) return -40;
    return 0;
  }
  const fornecedor = norm(conta.fornecedor);
  if (fornecedor && fornecedor.length >= 4 && texto.includes(fornecedor)) return -40;
  const partes = fornecedor.split(/\s+/).filter(p => p.length >= 5);
  if (partes.some(p => texto.includes(p))) return -25;
  return 0;
}

function consolidarContasAbertas({ despesas, tributos, faturas, cartoes, compras = [], obras = [] }) {
  const itens = [];
  despesas.filter(d => d.status === 'pendente' && !evaporou(d)).forEach(d => {
    itens.push({
      origem_id: d.id, origem_tipo: 'despesa',
      descricao: d.descricao, fornecedor: d.fornecedor || '—',
      valor: d.valor, data_vencimento: d.data_vencimento || d.data,
    });
  });
  // Compras (estoque/revenda) — origem própria, não é despesa operacional
  compras
    .filter(c => ['pendente', 'parcial', 'nao_identificado'].includes(c.status_pagamento) && !evaporou(c))
    .forEach(c => {
      const aberto = (c.valor_total || 0) - (c.valor_pago || 0);
      if (aberto <= 0.01) return;
      itens.push({
        origem_id: c.id, origem_tipo: 'compra',
        descricao: c.descricao_produto || `Compra NF ${c.numero_nota || ''}`.trim(),
        fornecedor: c.fornecedor || '—',
        valor: aberto, data_vencimento: c.data_emissao,
      });
    });
  // Obras / reformas ainda não pagas pelo banco
  obras
    .filter(o => !o.lancamento_bancario_id && !evaporou(o))
    .forEach(o => {
      if ((o.valor || 0) <= 0.01) return;
      itens.push({
        origem_id: o.id, origem_tipo: 'obra',
        descricao: o.descricao, fornecedor: o.responsavel || 'Prestador',
        valor: o.valor, data_vencimento: o.data_vencimento || o.data,
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
    const body = await req.json().catch(() => ({}));
    const internoOk = !!body?.internal_token && body.internal_token === Deno.env.get('NEXUS_HUB_TOKEN');
    if (!internoOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole.entities;
    if (body?.validate_only) return Response.json({ success: true, mode: 'validation' });

    const [despesas, tributos, faturas, cartoes, compras, obras, lancamentos, vinculos, sugestoesAntigas] = await Promise.all([
      svc.DespesaOperacional.list('-data', 2000),
      svc.Tributo.list('-data_vencimento', 2000),
      svc.FaturaCartao.list('-data_vencimento', 1000),
      svc.ContaCartao.list(),
      svc.ItemCompra.list('-data_emissao', 2000),
      svc.ObraReforma.list('-data', 1000),
      svc.LancamentoBancario.list('-data', 3000),
      svc.VinculoExtrato.list('-created_date', 5000),
      svc.SugestaoConciliacao.filter({ status: 'pendente' }),
    ]);

    const itens = consolidarContasAbertas({ despesas, tributos, faturas, cartoes, compras, obras });

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

    // PASSO 0 — AUTO-CRIAR TRIBUTOS a partir de débitos do extrato com categoria='tributo' sem vínculo
    // Resolve o gap: DAS/Simples Nacional no extrato mas sem registro de Tributo → cobertura 0%
    let tributosAutoCriados = 0;
    const debitosTributo = lancamentos.filter(l =>
      l.valor < 0 &&
      l.categoria === 'tributo' &&
      !lancsVinculados.has(l.id) &&
      !lancsEmSugestao.has(l.id) &&
      l.status_conciliacao !== 'conciliado'
    );

    for (const debito of debitosTributo) {
      const jaExiste = tributos.some(t => t.lancamento_bancario_id === debito.id);
      if (jaExiste) continue;

      const desc = norm(debito.descricao);
      let tipo = 'OUTRO';
      if (desc.includes('das') || desc.includes('simples nacional') || desc.includes('arrecadacao das')) tipo = 'DAS';
      else if (desc.includes('gps') || (desc.includes('inss') && !desc.includes('fgts'))) tipo = 'INSS';
      else if (desc.includes('darf')) tipo = 'DARF';
      else if (desc.includes('icms')) tipo = 'ICMS';
      else if (desc.includes('iss')) tipo = 'ISS';
      else if (desc.includes('fgts')) tipo = 'FGTS';
      else if (desc.includes('iptu')) tipo = 'IPTU';

      let empresa = 'NeuralTec';
      if (desc.includes('liesch')) empresa = 'Liesch';

      const dataPag = debito.data;
      const [ano, mes] = dataPag.split('-');
      const competencia = `${ano}-${mes}`;

      try {
        const novoTributo = await svc.Tributo.create({
          tipo, descricao: debito.descricao, competencia,
          data_vencimento: dataPag, data_pagamento: dataPag,
          valor_original: Math.abs(debito.valor), valor_pago: Math.abs(debito.valor),
          status: 'pago', empresa, conta_pagamento: debito.conta_bancaria || '',
          origem_compra: 'empresa', tipo_compra: 'impostos',
          lancamento_bancario_id: debito.id,
        });
        await svc.VinculoExtrato.create({
          lancamento_bancario_id: debito.id, entidade_tipo: 'Tributo', entidade_id: novoTributo.id,
          valor_alocado: Math.abs(debito.valor), origem_compra: 'empresa', tipo_compra: 'impostos', tipo_vinculo: 'pagamento_integral',
          conciliado_por: 'auto', confianca: 100,
          observacao: `Tributo auto-criado do extrato · ${tipo}`,
        });
        await svc.LancamentoBancario.update(debito.id, {
          status_conciliacao: 'conciliado', vinculos_count: 1, valor_conciliado: Math.abs(debito.valor),
        });
        lancsUsados.add(debito.id);
        tributosAutoCriados++;
      } catch (err) {
        console.error('Erro auto-criar tributo:', err.message);
      }
    }

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
        } else if (match.origem_tipo === 'compra') {
          await svc.ItemCompra.update(match.origem_id, { status_pagamento: 'pago', valor_pago: valorAlocado, lancamento_bancario_id: lanc.id });
        } else if (match.origem_tipo === 'obra') {
          await svc.ObraReforma.update(match.origem_id, { lancamento_bancario_id: lanc.id });
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
        .map(c => {
          const diff = Math.abs((new Date(c.data_vencimento) - dataLanc) / 86400000);
          const bonus = bonusAfinidade(lanc, c);
          return { c, diff, bonus, score: diff * 10 + bonus };
        })
        .sort((a, b) => a.score - b.score);

      if (candidatos.length === 0) continue;

      const { c: match, diff, bonus } = candidatos[0];

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
          confianca: Math.min(98, (diff <= 3 ? 85 : diff <= 7 ? 70 : 55) + (bonus < 0 ? 10 : 0)),
          motivo: `Valor bate (R$ ${valor.toFixed(2)})${bonus < 0 ? ', descrição confere' : ''}, mas pago ${Math.round(diff)} dia(s) ${dataLanc < new Date(match.data_vencimento) ? 'antes' : 'depois'} do vencimento`,
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
      tributos_auto_criados: tributosAutoCriados,
      baixas_automaticas: baixasAuto,
      sugestoes_criadas: sugestoesCriadas,
      total_debitos_analisados: debitos.length,
      total_contas_abertas: contasAbertas.length,
      origens_cobertas: ['despesa', 'compra', 'obra', 'tributo', 'fatura'],
    });
  } catch (error) {
    console.error('Erro conciliação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});