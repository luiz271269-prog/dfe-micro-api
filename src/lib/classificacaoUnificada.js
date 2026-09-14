// Vocabulário único de classificação usado em Extrato, Cartões e Contas a Pagar.
// Eixo 1 — Centro de custo (origem_compra)
// Eixo 2 — Tipo de compra (tipo_compra)
// Eixo 3 — Plano de contas / Categoria (categoria)

export const ORIGENS_COMPRA = {
  empresa: 'Empresa',
  condominio: 'Condomínio',
  investimento: 'Investimento',
  pro_labore: 'Pró-labore',
};

export const TIPOS_COMPRA = {
  estoque: 'Compras (estoque/revenda)',
  despesas: 'Despesas fixas/variáveis',
  impostos: 'Impostos (vendas + folha)',
  folha: 'Folha',
  obras: 'Obras / Reformas',
  pro_labore: 'Pró-labore',
};

export function tipoGastoValido(valor) {
  return Object.prototype.hasOwnProperty.call(TIPOS_COMPRA, valor);
}

export function rotuloTipoGasto(valor) {
  return tipoGastoValido(valor) ? TIPOS_COMPRA[valor] : 'Pendente de classificação';
}

export function exigeTipoGasto(entidade, registro) {
  if (entidade === 'FaturaCartao') return false;
  if (entidade === 'VinculoExtrato') return !['FaturaCartao', 'NotaFiscal', 'TituloCobranca', 'TransferenciaInterna', 'MovimentoFinanceiro'].includes(registro.entidade_tipo) && !['recebimento_integral', 'recebimento_parcial', 'estorno'].includes(registro.tipo_vinculo);
  if (entidade !== 'LancamentoBancario') return true;
  if (!(registro.valor < 0) || ['saque', 'transferencia', 'interno', 'recebimento'].includes(registro.categoria)) return false;
  const texto = `${registro.descricao || ''} ${registro.detalhe || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return !/\b(saque|aplicacao|investimento|cdb|rdb|lci|lca|tesouro|poupanca|fundo|resgate)\b/.test(texto);
}

// Plano de contas único — união das categorias do Extrato e dos Cartões
export const CATEGORIAS_CONTAS = {
  recebimento: 'Recebimento',
  fornecedor: 'Fornecedor',
  pessoal: 'Pessoal',
  pro_labore: 'Pró-labore',
  tributo: 'Tributo',
  despesa_operacional: 'Despesa Operacional',
  financeiro: 'Financeiro',
  saque: 'Saque',
  obras_reforma: 'Obras/Reforma',
  transferencia: 'Transferência',
  interno: 'Interno',
  alimentacao: 'Alimentação',
  combustivel: 'Combustível',
  lazer: 'Lazer',
  tecnologia: 'Tecnologia',
  servico_pessoal: 'Serviço Pessoal',
  saude_bem_estar: 'Saúde/Bem-Estar',
  beleza: 'Beleza',
  farmacia: 'Farmácia',
  transporte: 'Transporte',
  seguro: 'Seguro',
  produtos: 'Produtos',
  estoque: 'Estoque',
  outro: 'Outro',
};

export const ORIGEM_COLORS = {
  empresa: 'bg-blue-100 text-blue-700',
  condominio: 'bg-amber-100 text-amber-700',
  investimento: 'bg-emerald-100 text-emerald-700',
  pro_labore: 'bg-purple-100 text-purple-700',
};

export const TIPO_COLORS = {
  estoque: 'bg-emerald-100 text-emerald-700',
  fretes: 'bg-orange-100 text-orange-700',
  impostos: 'bg-red-100 text-red-700',
  despesas: 'bg-slate-100 text-slate-700',
  folha: 'bg-indigo-100 text-indigo-700',
  pro_labore: 'bg-purple-100 text-purple-700',
  obras: 'bg-yellow-100 text-yellow-700',
  financeiro: 'bg-cyan-100 text-cyan-700',
  outro: 'bg-gray-100 text-gray-700',
};

export const CATEGORIA_COLORS = {
  recebimento: 'bg-green-100 text-green-700',
  fornecedor: 'bg-red-100 text-red-700',
  pessoal: 'bg-purple-100 text-purple-700',
  pro_labore: 'bg-violet-100 text-violet-700',
  tributo: 'bg-orange-100 text-orange-700',
  despesa_operacional: 'bg-yellow-100 text-yellow-800',
  financeiro: 'bg-red-100 text-red-700',
  saque: 'bg-slate-100 text-slate-700',
  obras_reforma: 'bg-amber-100 text-amber-700',
  transferencia: 'bg-blue-100 text-blue-700',
  interno: 'bg-gray-100 text-gray-700',
  alimentacao: 'bg-green-100 text-green-700',
  combustivel: 'bg-orange-100 text-orange-700',
  lazer: 'bg-purple-100 text-purple-700',
  tecnologia: 'bg-blue-100 text-blue-700',
  servico_pessoal: 'bg-pink-100 text-pink-700',
  saude_bem_estar: 'bg-teal-100 text-teal-700',
  beleza: 'bg-rose-100 text-rose-700',
  farmacia: 'bg-cyan-100 text-cyan-700',
  transporte: 'bg-slate-100 text-slate-700',
  seguro: 'bg-gray-100 text-gray-700',
  produtos: 'bg-indigo-100 text-indigo-700',
  estoque: 'bg-emerald-100 text-emerald-700',
  outro: 'bg-amber-100 text-amber-700',
};

const CUSTOM_KEY = 'neuralfin_classificacao_custom';
const LEGACY_CARTAO_KEY = 'neuralfin_categorias_cartao_custom';

export function slugify(label) {
  return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function loadCustom() {
  let data;
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    data = raw ? JSON.parse(raw) : { origem: {}, tipo: {}, categoria: {} };
  } catch {
    data = { origem: {}, tipo: {}, categoria: {} };
  }
  if (!data.categoria) data.categoria = {};
  // Migração: categorias custom antigas dos cartões entram no plano de contas único
  try {
    const legacy = localStorage.getItem(LEGACY_CARTAO_KEY);
    if (legacy) {
      data.categoria = { ...JSON.parse(legacy), ...data.categoria };
      localStorage.removeItem(LEGACY_CARTAO_KEY);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(data));
    }
  } catch { /* ignore */ }
  return data;
}

export function saveCustom(next) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

const BASES = { origem: ORIGENS_COMPRA, tipo: TIPOS_COMPRA, categoria: CATEGORIAS_CONTAS };
const COLORS = { origem: ORIGEM_COLORS, tipo: TIPO_COLORS, categoria: CATEGORIA_COLORS };

export function getOpcoes(eixo, custom) {
  if (eixo === 'tipo') return { ...TIPOS_COMPRA };
  return { ...(BASES[eixo] || {}), ...(custom?.[eixo] || {}) };
}

export function getItensCadastro(cadastro, eixo, role = 'user', natureza = '') {
  const cadastrados = cadastro.filter(item => item.eixo === eixo);
  if (!cadastrados.length) return Object.entries(BASES[eixo] || {}).map(([chave, rotulo], ordem) => ({ chave, rotulo, ordem, nivel: 'base' }));
  return cadastrados
    .filter(item => item.ativo && (item.perfis_permitidos || []).includes(role))
    .sort((a, b) => {
      const prioridadeA = eixo === 'categoria' && natureza && (a.naturezas_vinculadas || [a.natureza_vinculada]).includes(natureza) ? 0 : 1;
      const prioridadeB = eixo === 'categoria' && natureza && (b.naturezas_vinculadas || [b.natureza_vinculada]).includes(natureza) ? 0 : 1;
      return prioridadeA - prioridadeB || (a.ordem || 0) - (b.ordem || 0);
    });
}

export function getCor(eixo, valor) {
  return (COLORS[eixo] || {})[valor] || 'bg-slate-100 text-slate-600';
}