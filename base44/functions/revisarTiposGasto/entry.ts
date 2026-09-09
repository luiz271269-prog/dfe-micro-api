import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const tipos = ['estoque', 'despesas', 'impostos', 'folha', 'obras', 'pro_labore'];
const entidades = ['LancamentoBancario', 'LancamentoCartao', 'DespesaOperacional', 'Tributo', 'FolhaPagamento', 'ItemCompra', 'ObraReforma', 'RegraRecorrente'];
const naoGasto = ['saque', 'transferencia', 'interno', 'recebimento'];
function aplicavel(entidade, r) {
  if (entidade !== 'LancamentoBancario') return true;
  const texto = `${r.descricao || ''} ${r.detalhe || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return Number(r.valor) < 0 && !naoGasto.includes(r.categoria) && !/\b(saque|aplicacao|investimento|cdb|rdb|lci|lca|tesouro|poupanca|fundo|resgate)\b/.test(texto);
}
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const { action, entidade, id, tipo, offset = 0 } = await req.json();
    if (!entidades.includes(entidade)) return Response.json({ error: 'Módulo inválido' }, { status: 400 });
    const svc = base44.entities;
    if (action === 'listar') {
      if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) return Response.json({ error: 'Página inválida' }, { status: 400 });
      const query = { tipo_compra: { $nin: tipos } };
      if (entidade === 'LancamentoBancario') Object.assign(query, { valor: { $lt: 0 }, categoria: { $nin: naoGasto } });
      const rows = await svc[entidade].filter(query, '-created_date', 51, offset);
      const page = rows.slice(0, 50);
      const links = entidade === 'LancamentoBancario' && page.length ? await svc.VinculoExtrato.filter({ lancamento_bancario_id: { $in: page.map(r => r.id) } }, '-created_date', 500) : [];
      const vinculados = new Set(links.map(v => v.lancamento_bancario_id));
      return Response.json({ itens: page.filter(r => aplicavel(entidade, r) && !vinculados.has(r.id)).map(r => ({ id: r.id, tipo_compra: r.tipo_compra || '', descricao: r.descricao || r.descricao_produto || r.estabelecimento || r.funcionario_nome || r.nome || r.tipo || 'Sem descrição', data: r.data || r.data_lancamento || r.data_emissao || r.data_vencimento || r.competencia || '', valor: r.valor ?? r.valor_total ?? r.valor_original ?? r.salario_liquido ?? r.valor_esperado ?? 0 })), has_more: rows.length > 50, next_offset: offset + 50 });
    }
    if (action !== 'salvar' || !tipos.includes(tipo) || typeof id !== 'string' || !id || id.length > 100) return Response.json({ error: 'Escolha um dos seis tipos de gasto.' }, { status: 400 });
    const record = await svc[entidade].get(id);
    if (!record || !aplicavel(entidade, record)) return Response.json({ error: 'Este movimento não é um gasto. Saques e transferências não devem ser reclassificados como despesa.' }, { status: 400 });
    const query = entidade === 'LancamentoBancario' ? { lancamento_bancario_id: id } : { entidade_tipo: entidade, entidade_id: id };
    const links = await svc.VinculoExtrato.filter(query, '-created_date', 501);
    if (entidade === 'LancamentoBancario' && links.length) return Response.json({ error: 'Este débito já tem conciliação. Reclassifique a obrigação no módulo de origem para preservar o detalhamento do pagamento.' }, { status: 409 });
    if (links.length > 500) return Response.json({ error: 'Este registro tem mais de 500 vínculos e precisa ser revisado separadamente.' }, { status: 409 });
    if (links.length) await svc.VinculoExtrato.bulkUpdate(links.map(v => ({ id: v.id, tipo_compra: tipo })));
    await svc[entidade].update(id, { tipo_compra: tipo });
    return Response.json({ success: true, tipo_compra: tipo, vinculos_atualizados: links.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}