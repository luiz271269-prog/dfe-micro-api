import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Diagnóstico profundo de UMA fatura de cartão:
// - soma real dos lançamentos x valor_total armazenado
// - lançamentos órfãos do mesmo mês que deveriam estar nesta fatura
// - duplicidades internas (mesma data + estabelecimento + valor)
// - pagamentos já vinculados no extrato (VinculoExtrato) x saldo em aberto
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const faturaId = body?.fatura_id;
    if (!faturaId) return Response.json({ error: 'fatura_id obrigatório' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    let fatura = null;
    try { fatura = await svc.FaturaCartao.get(faturaId); } catch { fatura = null; }
    if (!fatura) return Response.json({ error: 'Fatura não encontrada' }, { status: 404 });

    const [todosLancs, faturas, vinculos] = await Promise.all([
      svc.LancamentoCartao.list('-data_lancamento', 10000),
      svc.FaturaCartao.list('-data_vencimento', 1000),
      svc.VinculoExtrato.filter({ entidade_tipo: 'FaturaCartao', entidade_id: faturaId }),
    ]);

    const fatIds = new Set(faturas.map((f) => f.id));
    const lancs = todosLancs.filter((l) => l.fatura_id === faturaId);

    const isPagamento = (l) => {
      if ((l.valor || 0) < 0) return true;
      const d = `${l.estabelecimento || ''} ${l.observacao || ''}`.toLowerCase();
      return /pagamento.*fatura|pgto.*fatura|pagto.*fatura/.test(d);
    };

    const despesas = lancs.filter((l) => !isPagamento(l));
    const somaReal = lancs.reduce((s, l) => s + (l.valor || 0), 0);
    const somaDespesas = despesas.reduce((s, l) => s + (l.valor || 0), 0);
    const valorTotal = fatura.valor_total || 0;
    const divergencia = Number((somaReal - valorTotal).toFixed(2));

    // Órfãos do mesmo mês de referência
    const ym = fatura.mes_referencia;
    const orfaos = todosLancs.filter(
      (l) =>
        (!l.fatura_id || !fatIds.has(l.fatura_id)) &&
        String(l.data_lancamento || '').slice(0, 7) === ym
    );
    const somaOrfaos = orfaos.reduce((s, l) => s + (l.valor || 0), 0);

    // Duplicidades internas
    const mapa = new Map();
    for (const l of lancs) {
      const k = `${l.data_lancamento}|${(l.estabelecimento || '').trim().toLowerCase()}|${(l.valor || 0).toFixed(2)}`;
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(l);
    }
    const duplicados = Array.from(mapa.values())
      .filter((g) => g.length > 1)
      .map((g) => ({
        data: g[0].data_lancamento,
        estabelecimento: g[0].estabelecimento,
        valor: g[0].valor,
        ocorrencias: g.length,
        valor_excedente: Number(((g.length - 1) * (g[0].valor || 0)).toFixed(2)),
      }));

    const totalVinculado = vinculos.reduce((s, v) => s + (v.valor_alocado || 0), 0);
    const saldoAberto = Number((somaReal - totalVinculado).toFixed(2));

    // Classificação faltante — bloqueia DRE consistente
    const semNatureza = despesas.filter((l) => !l.natureza).length;
    const semCategoria = despesas.filter((l) => !l.categoria).length;

    return Response.json({
      fatura: {
        id: fatura.id,
        mes_referencia: fatura.mes_referencia,
        status: fatura.status,
        data_vencimento: fatura.data_vencimento,
        valor_total_armazenado: valorTotal,
        valor_pago: fatura.valor_pago || 0,
      },
      totais: {
        soma_real: Number(somaReal.toFixed(2)),
        soma_despesas: Number(somaDespesas.toFixed(2)),
        divergencia,
        qtd_lancamentos: lancs.length,
        qtd_pagamentos: lancs.length - despesas.length,
      },
      conciliacao: {
        vinculos: vinculos.length,
        total_vinculado: Number(totalVinculado.toFixed(2)),
        saldo_aberto: saldoAberto,
      },
      orfaos_do_mes: {
        quantidade: orfaos.length,
        soma: Number(somaOrfaos.toFixed(2)),
        exemplos: orfaos.slice(0, 15).map((o) => ({
          id: o.id, data: o.data_lancamento, estabelecimento: o.estabelecimento, valor: o.valor,
        })),
      },
      duplicidades: duplicados,
      classificacao_faltante: { sem_natureza: semNatureza, sem_categoria: semCategoria },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}