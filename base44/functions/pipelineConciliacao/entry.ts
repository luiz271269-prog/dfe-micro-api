import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { eixosDoVinculo } from '../../shared/classificacaoPadrao.ts';

// PIPELINE DINÂMICO DE CONCILIAÇÃO
// Orquestra todos os motores em sequência e depois auto-aprova
// sugestões pendentes com confiança >= 90 (valor exato + nome confere + poucos dias).
// Roda via automação agendada (sem usuário) ou manualmente por admin.

const ENGINES = [
  'sincronizarComprasCentral',
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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;

    const appId = secrets.get('BASE44_APP_ID');
    const token = secrets.get('NEXUS_HUB_TOKEN');

    // Segurança: só admin autenticado (inclui automação agendada) ou chamada interna com token
    const payload = await req.clone().json().catch(() => ({}));
    const internoOk = token && payload.internal_token === token;
    if (!internoOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    if (payload.validate_only === true) return Response.json({ success: true, mode: 'validation' });
    // 1. Roda cada motor em sequência via HTTP direto com token interno
    // (funciona tanto em automação agendada quanto em chamada manual)
    const resultadosEngines = {};
    for (const nome of ENGINES) {
      try {
        const resposta = await base44.functions.invoke(nome, { internal_token: token });
        const d = resposta?.data ?? resposta;
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
    // Tributos são aprovados pelo motor fiscal (empresa, guia, saldo e unicidade), nunca só pelo score.
    const altas = sugestoes.filter(s => !s.bloqueada && s.entidade_tipo !== 'Tributo' && (s.confianca || 0) >= CONFIANCA_AUTO);

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

        // Direção, saldo, vínculo e baixa passam pelo mesmo serviço central.
        if (!['TituloCobranca','NotaFiscal','DespesaOperacional','FaturaCartao','FolhaPagamento','ItemCompra'].includes(s.entidade_tipo)) continue;
        const resposta = await base44.functions.invoke('vincularExtrato', {
          acao:'criar', lancamento_bancario_id:lanc.id, entidade_tipo:s.entidade_tipo,
          entidade_id:s.entidade_id, valor_alocado:Math.abs(lanc.valor),
          tipo_vinculo:isCredito ? 'recebimento_parcial' : 'pagamento_integral',
          conciliado_por:'auto', confianca:s.confianca,
          observacao:`Pipeline · ${s.descricao_conta || ''}`,
          internal_token:token,
        });
        if (!resposta.data?.success) throw new Error(resposta.data?.error || 'Conciliação não confirmada');

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
}