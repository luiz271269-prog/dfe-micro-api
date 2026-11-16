// Grupos de origem do Contas a Pagar — paleta única usada em todas as telas financeiras.
// A fatura de cartão é um instrumento com composição mista e fica em grupo próprio.
export const GRUPOS = {
  compras:         { rotulo: 'Compras de produtos',      dot: 'bg-sky-500',     chip: 'bg-sky-100 text-sky-800 border-sky-200',             barra: 'border-l-sky-500' },
  fixas:           { rotulo: 'Despesas fixas',           dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', barra: 'border-l-emerald-500' },
  eventuais:       { rotulo: 'Despesas eventuais',       dot: 'bg-yellow-500',  chip: 'bg-yellow-100 text-yellow-800 border-yellow-200',    barra: 'border-l-yellow-500' },
  tributos_vendas: { rotulo: 'Tributos sobre vendas',    dot: 'bg-orange-500',  chip: 'bg-orange-100 text-orange-800 border-orange-200',    barra: 'border-l-orange-500' },
  tributos_folha:  { rotulo: 'Tributos sobre a folha',   dot: 'bg-red-500',     chip: 'bg-red-100 text-red-800 border-red-200',             barra: 'border-l-red-500' },
  tributos_outros: { rotulo: 'Taxas e outros tributos',  dot: 'bg-cyan-500',    chip: 'bg-cyan-100 text-cyan-800 border-cyan-200',          barra: 'border-l-cyan-500' },
  folha:           { rotulo: 'Folha de pessoal',         dot: 'bg-indigo-500',  chip: 'bg-indigo-100 text-indigo-800 border-indigo-200',    barra: 'border-l-indigo-500' },
  pro_labore:      { rotulo: 'Pró-labore e retiradas',   dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', barra: 'border-l-fuchsia-500' },
  obras:           { rotulo: 'Obras e reformas',         dot: 'bg-stone-600',   chip: 'bg-stone-200 text-stone-800 border-stone-300',       barra: 'border-l-stone-600' },
  cartao:          { rotulo: 'Fatura de cartão (mista)', dot: 'bg-purple-500',  chip: 'bg-purple-100 text-purple-800 border-purple-200',    barra: 'border-l-purple-500' },
  revisar:         { rotulo: 'Sem grupo · revisar',      dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-700 border-slate-300 border-dashed', barra: 'border-l-slate-400' },
};

export const ORDEM_GRUPOS = Object.keys(GRUPOS);

const TRIBUTOS_VENDAS = ['DAS', 'ICMS', 'ISS', 'PIS', 'COFINS', 'IRPJ', 'CSLL'];
const TRIBUTOS_FOLHA = ['INSS', 'FGTS', 'GPS'];

export function grupoTributo(tipo) {
  if (TRIBUTOS_VENDAS.includes(tipo)) return 'tributos_vendas';
  if (TRIBUTOS_FOLHA.includes(tipo)) return 'tributos_folha';
  return 'tributos_outros';
}

/**
 * Grupo de uma obrigação normalizada (origem_tipo + eixos de classificação).
 * `eventuais` = ids dos cadastros de despesa fixa marcados como "Eventual".
 */
export function grupoDeItem(i, eventuais = new Set()) {
  if (i.origem_tipo === 'obra' || i.tipo_compra === 'obras') return 'obras';
  if (i.origem_tipo === 'pro_labore' || i.tipo_compra === 'pro_labore' || ['pro_labore', 'pessoal'].includes(i.origem_compra)) return 'pro_labore';
  if (i.origem_tipo === 'fatura') return 'cartao';
  if (i.origem_tipo === 'tributo') return grupoTributo(i.categoria);
  if (i.origem_tipo === 'folha') return 'folha';
  if (i.origem_tipo === 'compra') return 'compras';
  if (i.origem_tipo === 'despesa') {
    if (i.tipo_compra === 'impostos') return 'tributos_outros';
    if (i.tipo_compra === 'folha') return 'folha';
    if (i.tipo_compra === 'estoque') return 'compras';
    if (i.regra_recorrente_id) return eventuais.has(i.regra_recorrente_id) ? 'eventuais' : 'fixas';
    return i.recorrente ? 'fixas' : 'eventuais';
  }
  return 'revisar';
}