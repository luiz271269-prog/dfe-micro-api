// Regras comuns da revisão de compras do cartão: leitura do grupo, estabelecimento, parcelas e assinatura da classificação conferida.
export const CAMPOS_GRUPO_CARTAO = ['origem_compra', 'tipo_compra', 'categoria', 'natureza', 'classificacao_conferida', 'valor', 'observacao'];

export const classificacaoDe = (r) => ({ origem_compra: r.origem_compra || '', tipo_compra: r.tipo_compra || '', categoria: r.categoria || '', natureza: r.natureza || '' });

export const assinaturaClassificacao = (r) => [r.origem_compra || '', r.tipo_compra || '', r.categoria || ''].join('|');

// A conferência só vale enquanto a assinatura for igual à classificação salva.
export const estaConferido = (r) => !!r.classificacao_conferida && r.classificacao_conferida === assinaturaClassificacao(r);

export const chaveGrupoCartao = (r) => [r.fatura_id, r.estabelecimento, r.origem_compra || '', r.tipo_compra || ''].join('|');

export const motivoGrupoCartao = (grupo) => `grupo limitado à fatura ${grupo.fatura_id} e estabelecimento ${grupo.estabelecimento}`;

// Conserva vendedor, filial e códigos: não confunde compras diferentes em marketplaces. Ignora só o marcador de parcela.
export function estabelecimentoChave(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\d{1,2}\s*\/\s*\d{1,2}/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

// Nomes genéricos de marketplace: o mesmo nome cobre compras sem relação entre si.
export const estabelecimentoGenerico = (chave) => /^(mercadolivre (?:merca\w*|\d*produt\w*)|mercado pago merc\w*|amazon (?:br(?: amazo)?|marketplacev?))$/.test(chave);

// Parcela informada na descrição ou observação importada (ex.: 02/05).
export function parcelaDe(r) {
  const m = `${r.estabelecimento || ''} ${r.observacao || ''}`.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  const numero = Number(m?.[1]), total = Number(m?.[2]);
  return m && numero >= 1 && total >= 2 && numero <= total ? { numero, total } : null;
}

export async function carregarGrupoCartao(db, grupo) {
  if (!grupo || typeof grupo.fatura_id !== 'string' || !grupo.fatura_id || grupo.fatura_id.length > 120 || typeof grupo.estabelecimento !== 'string' || !grupo.estabelecimento || grupo.estabelecimento.length > 300 || !Number.isInteger(grupo.quantidade) || grupo.quantidade < 1 || grupo.quantidade > 100) throw new Error('Grupo inválido ou acima de 100 lançamentos; revise os lançamentos individuais.');
  if (/pagamento.*fatura|pgto.*fatura|pagto.*fatura|credito.*pagamento/i.test(grupo.estabelecimento)) throw new Error('Pagamento de fatura não pode ser classificado como compra.');
  const condicoes = ['origem_compra', 'tipo_compra'].map(campo => {
    const valor = grupo[campo];
    if (typeof valor !== 'string' || valor.length > 100) throw new Error('Classificação original do grupo inválida.');
    return valor ? { [campo]: valor } : { $or: [{ [campo]: '' }, { [campo]: null }, { [campo]: { $exists: false } }] };
  });
  const pagina = await db.LancamentoCartao.filter({ fatura_id: grupo.fatura_id, estabelecimento: grupo.estabelecimento, valor: { $gt: 0 }, observacao: { $not: { $regex: 'Não faz parte', $options: 'i' } }, $and: condicoes }, { limit: 100, fields: CAMPOS_GRUPO_CARTAO });
  if (pagina.has_more || pagina.items.length !== grupo.quantidade) throw new Error('O grupo mudou desde a análise. Atualize a revisão antes de salvar.');
  return pagina.items;
}