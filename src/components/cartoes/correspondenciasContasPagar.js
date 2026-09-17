import { formatCurrency, formatDate } from '@/lib/formatters';

const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
const genericos = new Set(['brasil', 'comercial', 'comercio', 'servicos', 'ltda', 'pagamento', 'compra', 'atacado']);
const tokens = v => normalizar(v).split(' ').filter(t => t.length >= 4 && !genericos.has(t));
const diasEntre = (a, b) => a && b ? Math.abs((Date.parse(a.slice(0, 10) + 'T12:00:00Z') - Date.parse(b.slice(0, 10) + 'T12:00:00Z')) / 86400000) : Infinity;

export function prepararCorrespondencias({ compras = [], despesas = [], obras = [] }) {
  const registros = [];
  for (const [tipo, lista] of [['Compra', compras], ['Despesa', despesas], ['Obra', obras]]) {
    for (const r of lista) {
      const documento = r.numero_nota ? `NF ${r.numero_nota}` : r.pedido_central_id;
      registros.push({ id: `${tipo}-${r.id}`, origemId: r.id, tipo, vinculo: r.lancamento_cartao_id,
        label: [tipo, documento, r.fornecedor || r.responsavel || r.descricao || r.descricao_produto].filter(Boolean).join(' · '),
        fornecedor: r.fornecedor || r.responsavel || '', valor: Number(r.valor_total ?? r.valor ?? 0),
        data: r.data_emissao || r.data, vencimento: r.data_vencimento, empresa: r.empresa,
        grupo: tipo === 'Compra' && documento ? JSON.stringify([r.empresa, normalizar(r.fornecedor), documento, r.data_emissao, r.data_vencimento]) : `${tipo}-${r.id}` });
    }
  }
  const grupos = new Map();
  for (const r of registros) {
    if (!grupos.has(r.grupo)) grupos.set(r.grupo, { ...r, valor: 0, registros: [] });
    const grupo = grupos.get(r.grupo);
    grupo.valor += r.valor;
    grupo.registros.push(r);
  }
  return { registros, candidatos: [...grupos.values()] };
}

export default function identificarCorrespondencia(lancamento, catalogo) {
  const diretos = catalogo.registros.filter(r => r.vinculo === lancamento.id || (r.tipo === 'Compra' && r.origemId === lancamento.item_compra_id));
  if (diretos.length) {
    const conflito = diretos.some(r => r.tipo === 'Compra' && r.origemId === lancamento.item_compra_id && r.vinculo && r.vinculo !== lancamento.id);
    return { status: conflito ? 'divergente' : 'vinculado', registros: diretos.map(r => ({ ...r, evidencia: conflito ? 'Referências de vínculo divergentes; conferir antes de conciliar.' : 'Vínculo registrado com este lançamento.' })) };
  }
  const candidatos = [];
  const valor = Number(lancamento.valor || 0);
  const palavras = new Set(tokens(lancamento.estabelecimento));
  if (valor > 0) for (const c of catalogo.candidatos) {
    if (c.registros.some(r => r.vinculo)) continue;
    if (c.empresa && lancamento.empresa_beneficiada && normalizar(c.empresa) !== normalizar(lancamento.empresa_beneficiada)) continue;
    if (!tokens(c.fornecedor).some(t => palavras.has(t))) continue;
    const dias = Math.min(diasEntre(lancamento.data_lancamento, c.data), diasEntre(lancamento.data_lancamento, c.vencimento));
    if (dias > 60 || !Number.isFinite(dias)) continue;
    const multiplicador = Math.round(c.valor / valor);
    const igual = Math.abs(c.valor - valor) <= 0.02;
    const multiplo = c.tipo === 'Compra' && multiplicador >= 2 && multiplicador <= 12 && Math.abs(c.valor - valor * multiplicador) <= 0.05;
    if (!igual && !multiplo) continue;
    const evidencia = `Fornecedor semelhante; data próxima (${Math.round(dias)} dias). ${igual ? 'Valor correspondente.' : `Total equivale a ${multiplicador} × o lançamento; parcelamento não confirmado.`} Documento: ${formatCurrency(c.valor)}${c.data ? ` · ${formatDate(c.data)}` : ''}.`;
    candidatos.push({ ...c, evidencia, score: (igual ? 0 : 100) + dias });
  }
  candidatos.sort((a, b) => a.score - b.score);
  return { status: candidatos.length ? 'possivel' : 'nao_localizado', registros: candidatos, referenciaAusente: Boolean(lancamento.item_compra_id) };
}