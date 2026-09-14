import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { carregarDados } from '../../shared/fluxoConsolidado/carregar.ts';
import { adaptarDRE } from '../../shared/fluxoConsolidado/dreAdapter.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const mesSelecionado = /^\d{4}-\d{2}$/.test(body.mes_referencia || '') ? body.mes_referencia : hoje.slice(0, 7);
    const modoPeriodo = ['mensal', 'ano_civil', 'ultimos_12'].includes(body.modo_periodo) ? body.modo_periodo : 'mensal';
    let mesInicio = mesSelecionado, mesFim = mesSelecionado, meses = 1;
    if (modoPeriodo === 'ano_civil') { mesInicio = `${mesSelecionado.slice(0, 4)}-01`; mesFim = `${mesSelecionado.slice(0, 4)}-12`; meses = 12; }
    if (modoPeriodo === 'ultimos_12') { const [y, m] = mesSelecionado.split('-').map(Number); const d = new Date(y, m - 12, 1); mesInicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; meses = 12; }
    const { dados, sourceStatus } = await carregarDados(base44);
    const dre = adaptarDRE({ dados, sourceStatus, mesInicio, mesFim, hoje });
    const temDados = dre.competencia.receita_bruta !== 0 || dre.competencia.total_despesas_operacionais !== 0 || dre.competencia.cmv !== 0 || dre.caixa.receita_bruta !== 0 || dre.caixa.total_despesas_operacionais !== 0;
    return Response.json({ mes_referencia: mesSelecionado, mes_inicio: mesInicio, mes_fim: mesFim, meses, modo_periodo: modoPeriodo, regime: 'simples_nacional', escopo: 'grupo_consolidado', tem_dados: temDados, origem_cmv: 'motor_core_compras', cmv_provisorio: true, cobertura: { vinculados: dados.VinculoExtrato.length, fallbacks: 0, sem_comprovacao: dre.loopR?.indicadores?.naoClassificadoRegistros || 0, cartoes_sem_classificacao: 0, sem_empresa: dre.loopR?.indicadores?.pendenteEmpresa?.registros || 0 }, ...dre });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}