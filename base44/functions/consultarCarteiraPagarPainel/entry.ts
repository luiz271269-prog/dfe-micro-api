import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { GRUPOS_CARTEIRA, agregarCarteira, fontesCarteira, grupoCarteira, centavosCarteira } from '../../shared/carteiraPagarFontes.ts';
import { preverFixasCarteira } from '../../shared/carteiraPagarFixas.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const body = await req.json();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.mes || '') || !['grupo', 'NeuralTec', 'Liesch'].includes(body.perimetro)) return Response.json({ error: 'Período ou empresa inválidos.' }, { status: 400 });
    const db = base44.entities;
    const { fontes, empresa, fim } = await fontesCarteira(db, body.mes, body.perimetro);
    // Agrupamentos completos no servidor; nenhuma dependência dos limites das listas da tela.
    const resultados = await Promise.all(fontes.map(async fonte => {
      const groupBy = fonte.juros ? ['origem_compra', fonte.valor, 'valor_pago', 'juros_multa'] : fonte.entidade === 'ObraReforma' ? ['id', fonte.valor, 'origem_compra', 'tipo_compra'] : ['origem_compra', 'tipo_compra', fonte.valor, 'valor_pago'];
      const sum = fonte.entidade === 'ObraReforma' ? [fonte.valor] : [fonte.valor, 'valor_pago', ...(fonte.juros ? ['juros_multa'] : [])];
      return { fonte, rows: await agregarCarteira(db, fonte.entidade, { query: fonte.query, groupBy, sum }) };
    }));
    const obras = resultados.find(r => r.fonte.entidade === 'ObraReforma').rows;
    const vinculosObras = obras.length ? await agregarCarteira(db, 'VinculoExtrato', { query: { entidade_tipo: 'ObraReforma', entidade_id: { $in: obras.map(o => o.id) } }, groupBy: ['entidade_id', 'tipo_vinculo'], sum: 'valor_alocado' }) : [];
    const pagoObras = new Map();
    for (const v of vinculosObras) pagoObras.set(v.entidade_id, (pagoObras.get(v.entidade_id) || 0) + centavosCarteira(v.sum_valor_alocado) * (v.tipo_vinculo === 'estorno' ? -1 : 1));
    const grupos = new Map(GRUPOS_CARTEIRA.map(g => [g.chave, { ...g, confirmadoCentavos: 0, previstoCentavos: 0 }]));
    for (const { fonte, rows } of resultados) {
      for (const row of rows) {
        const original = centavosCarteira(row[`sum_${fonte.valor}`]);
        const juros = fonte.juros ? centavosCarteira(row.sum_juros_multa) : 0;
        const pago = fonte.entidade === 'ObraReforma' ? Math.max(0, pagoObras.get(row.id) || 0) : centavosCarteira(row.sum_valor_pago);
        const saldo = Math.max(0, original + juros - pago);
        grupos.get(grupoCarteira(row, fonte.grupo)).confirmadoCentavos += saldo;
      }
    }
    const previsoes = await preverFixasCarteira(db, body.mes, empresa);
    for (const [chave, valor] of Object.entries(previsoes.grupos)) grupos.get(chave).previstoCentavos += valor;
    const lista = [...grupos.values()];
    const totalConfirmado = lista.reduce((s, g) => s + g.confirmadoCentavos, 0) / 100;
    const totalPrevisto = lista.reduce((s, g) => s + g.previstoCentavos, 0) / 100;
    return Response.json({ mes: body.mes, perimetro: body.perimetro, fim, podeSincronizar: user.role === 'admin', semCalendario: previsoes.semCalendario, totalConfirmado, totalPrevisto, grupos: lista.map(({ confirmadoCentavos, previstoCentavos, ...g }) => ({ ...g, confirmado: confirmadoCentavos / 100, previsto: previstoCentavos / 100 })) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}