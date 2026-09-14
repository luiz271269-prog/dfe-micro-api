import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { carregarDados } from '../../shared/fluxoConsolidado/carregar.ts';
import { calcularConsolidado, calcularHistorico } from '../../shared/fluxoConsolidado/motor.ts';
import { fetchCentralCompras, normalizarPedidosCompra } from '../../shared/centralCompras.ts';

// Motor consolidado (Gate 2) — ponto de entrada do Painel Financeiro.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const mes = /^\d{4}-\d{2}$/.test(body.mes || '') ? body.mes : hoje.slice(0, 7);
    const perimetro = ['grupo', 'NeuralTec', 'Liesch'].includes(body.perimetro) ? body.perimetro : 'grupo';

    const { dados, sourceStatus } = await carregarDados(base44);
    const central = await fetchCentralCompras('PedidoCompra', 'limit=500');
    dados.ItemCompra = central.ok ? normalizarPedidosCompra(central.data).itens : [];
    dados.ItemCompraFonte = { status: central.ok ? 'carregada' : 'indisponivel', httpStatus: central.status };
    sourceStatus.ItemCompra = { status: dados.ItemCompraFonte.status, registros: dados.ItemCompra.length, origem: 'Central de Compras', erro: central.ok ? undefined : `HTTP ${central.status}` };
    const resultado = calcularConsolidado({ dados, sourceStatus, mes, perimetro, hoje });
    const meses = Math.min(12, Math.max(0, Number(body.historico) || 0));
    if (meses) resultado.historico = calcularHistorico({ dados, mes, perimetro, hoje, meses });
    // resumo: true → remove listas de IDs (usado em validação/diagnóstico; o drill-down usa a resposta completa)
    const semIds = (o) => {
      if (Array.isArray(o)) return o.map(semIds);
      if (!o || typeof o !== 'object') return o;
      const c = {};
      for (const k of Object.keys(o)) if (k !== 'ids') c[k] = semIds(o[k]);
      return c;
    };
    let saida = body.resumo ? semIds(resultado) : resultado;
    if (Array.isArray(body.secoes)) saida = Object.fromEntries(body.secoes.filter((s) => s in saida).map((s) => [s, saida[s]]));
    return Response.json(saida);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}