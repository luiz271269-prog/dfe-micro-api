const vazio = campo => ({ $or: [{ [campo]: { $exists: false } }, { [campo]: null }, { [campo]: { $regex: '^\\s*$' } }] });
const preenchido = campo => ({ [campo]: { $regex: '\\S' } });
export const compraDireta = { $and: [vazio('lancamento_cartao_id'), { forma_pagamento: { $ne: 'cartao' } }] };
export const compraIdentificada = { $and: [preenchido('numero_nota'), preenchido('data_vencimento')] };
const semIdentificacao = { $or: [vazio('numero_nota'), vazio('data_vencimento')] };
const abertos = ['pendente', 'parcial', 'nao_identificado'];
export const categoriasCompra = {
  incompleto: { $and: [compraDireta, semIdentificacao] },
  aptos_abertos: { $and: [compraDireta, compraIdentificada, { status_pagamento: { $in: abertos } }] },
  aptos_pagos: { $and: [compraDireta, compraIdentificada, { status_pagamento: 'pago' }] },
  cartao_vinculado: preenchido('lancamento_cartao_id'),
  cartao_sem_vinculo: { $and: [vazio('lancamento_cartao_id'), { forma_pagamento: 'cartao' }] },
  estado_revisao: { $and: [compraDireta, compraIdentificada, { status_pagamento: { $nin: [...abertos, 'pago'] } }] },
};
export function recorteCompras(b) {
  const filtros = [];
  if (['NeuralTec', 'Liesch'].includes(b.empresa)) filtros.push({ empresa: b.empresa });
  if (b.empresa === 'condominio') filtros.push({ $or: [{ origem_compra: 'condominio' }, { empresa: 'condominio' }] });
  if (b.empresa === 'pro_labore') filtros.push({ $or: [{ origem_compra: { $in: ['pro_labore', 'pessoal'] } }, { empresa: 'pessoal' }] });
  if (b.natureza !== 'todos') filtros.push(b.natureza === 'pendente' ? { $or: [vazio('tipo_compra'), { tipo_compra: { $nin: ['receitas', 'estoque', 'despesas', 'folha', 'pro_labore', 'impostos', 'obras', 'financeiro'] } }] } : { tipo_compra: b.natureza });
  if (!b.todosPeriodos) {
    const [ano, mes] = b.mes.split('-').map(Number);
    const inicio = b.anual ? `${ano}-01-01` : `${b.mes}-01`;
    const fim = new Date(Date.UTC(ano, b.anual ? 12 : mes, 0)).toISOString().slice(0, 10);
    const periodo = { $or: [{ data_vencimento: { $gte: inicio, $lte: fim } }, { $and: [vazio('data_vencimento'), { data_emissao: { $gte: inicio, $lte: fim } }] }] };
    const atual = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const vigente = b.anual ? atual.slice(0, 4) === String(ano) : atual.slice(0, 7) === b.mes;
    filtros.push(vigente ? { $or: [periodo, { $and: [{ status_pagamento: { $ne: 'pago' } }, { $or: [{ data_vencimento: { $lt: inicio } }, { $and: [vazio('data_vencimento'), { $or: [{ data_emissao: { $lt: inicio } }, vazio('data_emissao')] }] }] }] }] } : periodo);
  }
  return filtros.length ? { $and: filtros } : {};
}
export function motivosCompra(r) {
  const motivos = [];
  if (!String(r.numero_nota || '').trim()) motivos.push('Sem número da nota');
  if (!String(r.data_vencimento || '').trim()) motivos.push('Sem vencimento');
  if (r.lancamento_cartao_id) motivos.push('Composição da fatura; não somar como pagamento direto');
  else if (r.forma_pagamento === 'cartao') motivos.push('Cartão informado, sem lançamento vinculado; conferir composição');
  if (![...abertos, 'pago'].includes(r.status_pagamento)) motivos.push('Estado de pagamento não identificado');
  return motivos;
}