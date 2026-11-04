import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { GRUPOS_CARTEIRA, agregarCarteira, fontesCarteira, grupoCarteira, centavosCarteira, vencimentoAte } from '../../shared/carteiraPagarFontes.ts';
import { categoriasCompra } from '../../shared/comprasElegibilidade.ts';
import { preverFixasCarteira } from '../../shared/carteiraPagarFixas.ts';
import { liquidacoesDocumentos } from '../../shared/liquidacaoObrasFaturas.ts';

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
      const groupBy = fonte.juros ? ['origem_compra', fonte.valor, 'valor_pago', 'juros_multa'] : ['ObraReforma', 'FaturaCartao'].includes(fonte.entidade) ? ['id', fonte.valor, 'origem_compra', 'tipo_compra'] : ['origem_compra', 'tipo_compra', fonte.valor, 'valor_pago'];
      const sum = [fonte.valor, 'valor_pago', ...(fonte.juros ? ['juros_multa'] : [])];
      return { fonte, rows: await agregarCarteira(db, fonte.entidade, { query: fonte.query, groupBy, sum }) };
    }));
    const saldos = new Map();
    await Promise.all(['ObraReforma', 'FaturaCartao'].map(async nome => {
      const ids = resultados.find(r => r.fonte.entidade === nome).rows.map(r => r.id);
      const rows = await liquidacoesDocumentos(db, nome, ids);
      for (const row of rows) saldos.set(`${nome}:${row.id}`, centavosCarteira(row.saldo));
    }));
    const grupos = new Map(GRUPOS_CARTEIRA.map(g => [g.chave, { ...g, confirmadoCentavos: 0, previstoCentavos: 0 }]));
    for (const { fonte, rows } of resultados) {
      for (const row of rows) {
        const original = centavosCarteira(row[`sum_${fonte.valor}`]);
        const juros = fonte.juros ? centavosCarteira(row.sum_juros_multa) : 0;
        const pago = centavosCarteira(row.sum_valor_pago);
        const saldo = ['ObraReforma', 'FaturaCartao'].includes(fonte.entidade) ? (saldos.get(`${fonte.entidade}:${row.id}`) || 0) : Math.max(0, original + juros - pago);
        grupos.get(grupoCarteira(row, fonte.grupo)).confirmadoCentavos += saldo;
      }
    }
    const [previsoes, incompleto, cartaoSemVinculo] = await Promise.all([
      preverFixasCarteira(db, body.mes, empresa),
      db.ItemCompra.count({ $and: [empresa, categoriasCompra.incompleto, vencimentoAte('data_vencimento', 'data_emissao', fim)] }),
      db.ItemCompra.count({ $and: [empresa, categoriasCompra.cartao_sem_vinculo, vencimentoAte('data_vencimento', 'data_emissao', fim)] }),
    ]);
    const comprasRevisao = { incompleto, cartao_sem_vinculo: cartaoSemVinculo };
    for (const [chave, valor] of Object.entries(previsoes.grupos)) grupos.get(chave).previstoCentavos += valor;
    const lista = [...grupos.values()];
    const totalConfirmado = lista.reduce((s, g) => s + g.confirmadoCentavos, 0) / 100;
    const totalPrevisto = lista.reduce((s, g) => s + g.previstoCentavos, 0) / 100;
    return Response.json({ mes: body.mes, perimetro: body.perimetro, fim, podeSincronizar: user.role === 'admin', semCalendario: previsoes.semCalendario, totalConfirmado, totalPrevisto, comprasRevisao, grupos: lista.map(({ confirmadoCentavos, previstoCentavos, ...g }) => ({ ...g, confirmado: confirmadoCentavos / 100, previsto: previstoCentavos / 100 })) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}