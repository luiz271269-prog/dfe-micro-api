import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { documentosFatura } from '../../shared/faturaDocumentos.ts';

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
    const [page, todos, fora, banco, naturezas, naturezasFora] = await Promise.all([
      db.LancamentoCartao.filter({ fatura_id }, { sort: 'data_lancamento', limit: 30, cursor: cursor || undefined }),
      db.LancamentoCartao.aggregate({ query: { fatura_id }, sum: ['valor'] }),
      db.LancamentoCartao.aggregate({ query: ignorados, sum: ['valor'] }),
      user.role === 'admin' ? db.VinculoExtrato.aggregate({ query: { entidade_tipo: 'FaturaCartao', entidade_id: fatura_id }, sum: ['valor_alocado'] }) : Promise.resolve(null),
      db.LancamentoCartao.aggregate({ query: { fatura_id }, groupBy: 'tipo_compra', sum: ['valor'] }),
      db.LancamentoCartao.aggregate({ query: ignorados, groupBy: 'tipo_compra', sum: ['valor'] }),
    ]);
    const arred = v => Math.round(Number(v || 0) * 100) / 100;
    const total = arred(fat.valor_total), pago = arred(fat.valor_pago), composicao = arred(Number(todos.rows[0]?.sum_valor || 0) - Number(fora.rows[0]?.sum_valor || 0));
    const saldo = arred(Math.max(0, total - pago));
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const temporal = saldo === 0 ? 'Encerrada' : !fat.data_vencimento ? 'Sem vencimento' : fat.data_vencimento < hoje ? 'Vencida' : fat.data_vencimento === hoje ? 'Vence hoje' : 'A vencer';
    const relacao = saldo === 0 ? 'Fatura quitada' : pago > 0 ? 'Fatura parcialmente paga' : 'Incluída em fatura aberta';
    const documentos = await documentosFatura(db, page.items, user.role === 'admin');
    const grupos = naturezas.rows.map(n => {
      const excluido = naturezasFora.rows.find(e => (e.tipo_compra ?? null) === (n.tipo_compra ?? null));
      return { natureza: n.tipo_compra || 'Sem natureza classificada', valor: arred(Number(n.sum_valor || 0) - Number(excluido?.sum_valor || 0)), quantidade: Number(n.count || 0) - Number(excluido?.count || 0) };
    }).filter(n => n.quantidade > 0).reduce((lista, n) => {
      const existente = lista.find(g => g.natureza === n.natureza);
      if (existente) { existente.valor = arred(existente.valor + n.valor); existente.quantidade += n.quantidade; }
      else lista.push(n);
      return lista;
    }, []);
    return Response.json({
      success: true, somente_leitura: true, fatura_id, temporal, relacao, grupos_natureza: grupos, documentos_parciais: documentos.parcial,
      resumo: { total, pago_registrado: pago, saldo: arred(Math.max(0, total - pago)), situacao: saldo === 0 ? 'Quitada' : pago > 0 ? 'Parcial' : 'Aberta', situacao_historica: fat.status, inconsistencia_historica: (fat.status === 'paga_total') !== (pago >= total && total > 0), vencimento: fat.data_vencimento, temporal, composicao, diferenca_composicao: arred(total - composicao), linhas: Number(todos.rows[0]?.count || 0), comprovado_banco: banco ? arred(banco.rows[0]?.sum_valor_alocado) : null, informativos_excluidos: arred(fora.rows[0]?.sum_valor || 0) },
      items: page.items.map(l => ({ documentos: documentos.porLancamento[l.id] || [], situacao_relacionada: `${relacao} · ${temporal}`, id: l.id, data: l.data_lancamento, descricao: l.estabelecimento, valor: l.valor, natureza: l.tipo_compra || 'Não classificada', situacao: /pagamento.*fatura|pgto.*fatura|pagto.*fatura|cr[eé]dito.*pagamento/i.test(`${l.estabelecimento || ''} ${l.observacao || ''}`) ? 'Pagamento informativo, não é baixa bancária' : /n[aã]o faz parte/i.test(l.observacao || '') ? 'Fora da composição' : Number(l.valor) < 0 ? 'Crédito / ajuste da composição' : 'Componente da fatura' })),
      has_more: page.has_more, next_cursor: page.next_cursor,
    });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}