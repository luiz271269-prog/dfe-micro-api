export const GRUPOS_CARTEIRA = [
  { chave: 'compras', rotulo: 'Compras (fornecedores)', href: '/compras' },
  { chave: 'cartoes', rotulo: 'Faturas de cartão', href: '/cartoes' },
  { chave: 'tributos', rotulo: 'Impostos a pagar', href: '/tributos' },
  { chave: 'folha', rotulo: 'Folha de pagamento', href: '/funcionarios' },
  { chave: 'despesas', rotulo: 'Despesas fixas e operacionais', href: '/despesas' },
  { chave: 'pro_labore', rotulo: 'Pró-labore', href: '/prolabore' },
  { chave: 'pessoal', rotulo: 'Retiradas pessoais', href: '/prolabore' },
  { chave: 'obras', rotulo: 'Obras e investimentos', href: '/obras' },
  { chave: 'financeiro', rotulo: 'Financeiros (tarifas, juros, empréstimos)', href: '/extrato' },
];
export const centavosCarteira = valor => Math.round((Number(valor) || 0) * 100);
export function grupoCarteira(registro, padrao) {
  if (padrao === 'cartoes') return padrao;
  if (registro.origem_compra === 'pessoal') return 'pessoal';
  if (registro.origem_compra === 'pro_labore' || registro.tipo_compra === 'pro_labore') return 'pro_labore';
  return { estoque: 'compras', fretes: 'compras', impostos: 'tributos', folha: 'folha', despesas: 'despesas', obras: 'obras', financeiro: 'financeiro' }[registro.tipo_compra] || padrao;
}
export const vazioCarteira = campo => ({ $or: [{ [campo]: { $exists: false } }, { [campo]: null }, { [campo]: '' }] });
export function vencimentoAte(campo, alternativa, fim) {
  const condicoes = [{ [campo]: { $lte: fim, $gte: '0001-01-01' } }];
  if (alternativa) condicoes.push({ $and: [vazioCarteira(campo), { [alternativa]: { $lte: fim, $gte: '0001-01-01' } }] });
  condicoes.push({ $and: [vazioCarteira(campo), ...(alternativa ? [vazioCarteira(alternativa)] : [])] });
  return { $or: condicoes };
}
export async function agregarCarteira(db, entidade, opcoes) {
  const resposta = await db[entidade].aggregate({ ...opcoes, limit: 1000 });
  if (resposta.truncated) throw new Error(`Agrupamento de ${entidade} excede o limite seguro; o total não foi apresentado como completo.`);
  return resposta.rows;
}
export async function fontesCarteira(db, mes, perimetro) {
  const [ano, numero] = mes.split('-').map(Number);
  const fim = new Date(Date.UTC(ano, numero, 0)).toISOString().slice(0, 10);
  const empresa = perimetro === 'grupo' ? {} : { empresa: perimetro };
  let cartoes = {};
  if (perimetro !== 'grupo') {
    const pagina = await db.ContaCartao.filter({ empresa_vinculada: perimetro }, { distinct: 'id', limit: 1000 });
    if (pagina.has_more) throw new Error('Cartões excedem o limite seguro do perímetro.');
    cartoes = { conta_cartao_id: { $in: pagina.items } };
  }
  const fonte = (entidade, grupo, valor, query, juros = false) => ({ entidade, grupo, valor, query, juros });
  const mensal = { $or: [{ tipo: 'mensal' }, vazioCarteira('tipo')] };
  return { fim, empresa, fontes: [
    fonte('ItemCompra', 'compras', 'valor_total', { $and: [empresa, { status_pagamento: { $in: ['pendente', 'parcial', 'nao_identificado'] } }, vazioCarteira('lancamento_cartao_id'), vencimentoAte('data_vencimento', 'data_emissao', fim)] }),
    fonte('FaturaCartao', 'cartoes', 'valor_total', { $and: [cartoes, { status: { $in: ['aberta', 'vencida'] } }, vencimentoAte('data_vencimento', null, fim)] }),
    fonte('Tributo', 'tributos', 'valor_original', { $and: [empresa, { status: { $in: ['a_vencer', 'vencido', 'parcelado'] } }, vencimentoAte('data_vencimento', null, fim)] }, true),
    fonte('FolhaPagamento', 'folha', 'salario_liquido', { $and: [empresa, { status: { $in: ['pendente', 'adiantamento'] } }, { $or: [{ $and: [mensal, { competencia: { $lt: mes } }] }, { tipo: { $in: ['ferias', 'decimo_terceiro', 'rescisao'] }, competencia: { $lte: mes } }, vazioCarteira('competencia')] }] }),
    fonte('DespesaOperacional', 'despesas', 'valor', { $and: [empresa, { status: { $in: ['pendente', 'vencido'] } }, vazioCarteira('lancamento_cartao_id'), vencimentoAte('data_vencimento', 'data', fim)] }),
    fonte('ObraReforma', 'obras', 'valor', { $and: [empresa, vazioCarteira('lancamento_cartao_id'), vazioCarteira('lancamento_bancario_id'), vencimentoAte('data_vencimento', 'data', fim)] }),
  ] };
}