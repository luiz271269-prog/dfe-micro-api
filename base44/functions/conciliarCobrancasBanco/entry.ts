import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { protegerClienteImportacao } from '../../shared/importacaoProtecao.ts';
import { secrets } from 'base44:runtime';
import { direcaoBanco } from '../../shared/direcaoFinanceira.ts';

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

export default async function(req) {
  try {
    const base44 = protegerClienteImportacao(createClientFromRequest(req));
    const body = await req.json().catch(() => ({}));
    const internoOk = !!body?.internal_token && body.internal_token === secrets.get('NEXUS_HUB_TOKEN');
    if (!internoOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole.entities;
    if (body.validate_only) return Response.json({ success: true, direcao: 'entrada' });

    const [titulos, lancamentos, vinculos, sugestoesAntigas] = await Promise.all([
      svc.TituloCobranca.filter({ status: { $in: ['em_aberto', 'vencido'] } }, { sort: 'data_vencimento', limit: 50 }).then(p => p.items),
      svc.LancamentoBancario.filter({ valor: { $gt: 0 }, status_conciliacao: { $nin: ['conciliado', 'ignorar'] }, ...(body.mes_referencia ? { mes_referencia: body.mes_referencia } : {}) }, { sort: '-data', limit: 50 }).then(p => p.items),
      svc.VinculoExtrato.list('-created_date', 5000),
      svc.SugestaoConciliacao.filter({ status: 'pendente' }),
    ]);

    // Títulos em aberto sem vínculo bancário
    const titulosAbertos = titulos.filter(t =>
      (t.status === 'em_aberto' || t.status === 'vencido')
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
      direcaoBanco(l) === 'entrada' &&
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
      const valor = Math.max(0, Number(titulo.valor_titulo || 0) - Number(titulo.valor_pago || 0));
      if (valor < 0.01) continue;

      const candidatosAuto = creditos.filter(l => !lancsUsados.has(l.id) && Math.abs(l.valor - valor) <= 0.01 && l.data === (titulo.data_pagamento_informada || titulo.data_vencimento) && clienteNoExtrato(titulo.cliente, l.descricao));
      if (candidatosAuto.length !== 1) continue;
      const match = candidatosAuto[0];
      const concorrentes = titulosAbertos.filter(t => !titulosUsados.has(t.id) && Math.abs(Number(t.valor_titulo || 0) - Number(t.valor_pago || 0) - match.valor) <= 0.01 && clienteNoExtrato(t.cliente, match.descricao));
      if (concorrentes.length !== 1) continue;

      try {
        const resposta = await base44.functions.invoke('vincularExtrato', {
          acao: 'criar', lancamento_bancario_id: match.id,
          entidade_tipo: 'TituloCobranca', entidade_id: titulo.id,
          valor_alocado: match.valor, tipo_vinculo: 'recebimento_integral',
          conciliado_por: 'auto', confianca: 100,
          observacao: `Recebimento bancário · ${titulo.cliente} · ${titulo.nosso_numero || ''}`,
          ...(internoOk ? { internal_token: body.internal_token } : {}),
        });
        if (!resposta.data?.success) throw new Error(resposta.data?.error || 'Vínculo não confirmado');
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
      const valor = Math.max(0, Number(titulo.valor_titulo || 0) - Number(titulo.valor_pago || 0));
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
          bloqueada: candidatos.length > 1 || titulosAbertos.some(t => t.id !== titulo.id && Math.abs(Number(t.valor_titulo || 0) - Number(t.valor_pago || 0) - match.valor) <= 0.01 && clienteNoExtrato(t.cliente, match.descricao)),
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
}