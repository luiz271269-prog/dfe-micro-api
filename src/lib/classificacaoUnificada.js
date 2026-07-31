// Vocabulário único de classificação usado em Extrato, Cartões e Contas a Pagar.
// Eixo 1 — Quem comprou (origem_compra) | Eixo 2 — Tipo de compra (tipo_compra)

export const ORIGENS_COMPRA = {
  empresa: 'Empresa',
  pro_labore: 'Pró-labore',
  condominio: 'Condomínio',
  pessoal: 'Pessoal',
};

export const TIPOS_COMPRA = {
  estoque: 'Estoque',
  fretes: 'Fretes',
  impostos: 'Impostos',
  despesas: 'Despesas',
  folha: 'Folha',
  pro_labore: 'Pró-labore',
  obras: 'Obras/Reforma',
  financeiro: 'Financeiro',
  outro: 'Outro',
};

export const ORIGEM_COLORS = {
  empresa: 'bg-blue-100 text-blue-700',
  pro_labore: 'bg-purple-100 text-purple-700',
  condominio: 'bg-amber-100 text-amber-700',
  pessoal: 'bg-pink-100 text-pink-700',
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

const CUSTOM_KEY = 'neuralfin_classificacao_custom';

export function slugify(label) {
  return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function loadCustom() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : { origem: {}, tipo: {} };
  } catch {
    return { origem: {}, tipo: {} };
  }
}

export function saveCustom(next) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export function getOpcoes(eixo, custom) {
  const base = eixo === 'origem' ? ORIGENS_COMPRA : TIPOS_COMPRA;
  return { ...base, ...(custom?.[eixo] || {}) };
}

export function getCor(eixo, valor) {
  const map = eixo === 'origem' ? ORIGEM_COLORS : TIPO_COLORS;
  return map[valor] || 'bg-slate-100 text-slate-600';
}