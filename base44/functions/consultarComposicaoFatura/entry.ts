import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
    const { fatura_id, cursor } = await req.json();
    if (typeof fatura_id !== 'string' || !fatura_id || fatura_id.length > 200 || (cursor && (typeof cursor !== 'string' || cursor.length > 4096))) return Response.json({ error: 'Fatura ou página inválida.' }, { status: 400 });
    const db = base44.entities, fat = await db.FaturaCartao.get(fatura_id);
    if (!fat?.id) return Response.json({ error: 'Fatura não encontrada.' }, { status: 404 });
    const pagamento = 'pagamento.*fatura|pgto.*fatura|pagto.*fatura|cr[eé]dito.*pagamento';
    const ignorados = { fatura_id, $or: [{ estabelecimento: { $regex: pagamento, $options: 'i' } }, { observacao: { $regex: `${pagamento}|n[aã]o faz parte`, $options: 'i' } }] };
    const [page, todos, fora, banco] = await Promise.all([
      db.LancamentoCartao.filter({ fatura_id }, { sort: 'data_lancamento', limit: 30, cursor: cursor || undefined }),
      db.LancamentoCartao.aggregate({ query: { fatura_id }, sum: ['valor'] }),
      db.LancamentoCartao.aggregate({ query: ignorados, sum: ['valor'] }),
      user.role === 'admin' ? db.VinculoExtrato.aggregate({ query: { entidade_tipo: 'FaturaCartao', entidade_id: fatura_id }, sum: ['valor_alocado'] }) : Promise.resolve(null),
    ]);
    const arred = v => Math.round(Number(v || 0) * 100) / 100;
    const total = arred(fat.valor_total), pago = arred(fat.valor_pago), composicao = arred(Number(todos.rows[0]?.sum_valor || 0) - Number(fora.rows[0]?.sum_valor || 0));
    return Response.json({
      success: true, somente_leitura: true, fatura_id,
      resumo: { total, pago_registrado: pago, saldo: arred(Math.max(0, total - pago)), situacao: pago >= total && total > 0 ? 'Quitada' : pago > 0 ? 'Parcial' : 'A pagar', situacao_historica: fat.status, inconsistencia_historica: (fat.status === 'paga_total') !== (pago >= total && total > 0), vencimento: fat.data_vencimento, composicao, diferenca_composicao: arred(total - composicao), linhas: Number(todos.rows[0]?.count || 0), comprovado_banco: banco ? arred(banco.rows[0]?.sum_valor_alocado) : null, informativos_excluidos: arred(fora.rows[0]?.sum_valor || 0) },
      items: page.items.map(l => ({ id: l.id, data: l.data_lancamento, descricao: l.estabelecimento, valor: l.valor, natureza: l.tipo_compra || 'Não classificada', situacao: /pagamento.*fatura|pgto.*fatura|pagto.*fatura|cr[eé]dito.*pagamento/i.test(`${l.estabelecimento || ''} ${l.observacao || ''}`) ? 'Pagamento informativo, não é baixa bancária' : /n[aã]o faz parte/i.test(l.observacao || '') ? 'Fora da composição' : Number(l.valor) < 0 ? 'Crédito / ajuste da composição' : 'Componente da fatura' })),
      has_more: page.has_more, next_cursor: page.next_cursor,
    });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}