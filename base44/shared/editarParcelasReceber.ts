import { centavos } from './recebimentosExtrato.ts';

export const LIMITE_PARCELAS = 60;
const pago = t => t.status === 'pago' || Number(t.valor_pago) > 0 || Number(t.valor_pago_informado) > 0 || !!(t.data_pagamento || t.data_pagamento_informada || t.lancamento_bancario_id);
const campos = t => ({ data_vencimento: t.data_vencimento, valor_titulo: t.valor_titulo, status: t.status, parcela_total: t.parcela_total ?? null });
const snapshot = (nota, parcelas, bloqueio) => JSON.stringify([
  nota.id, nota.numero, nota.cliente, nota.empresa, nota.tipo, nota.valor_total, nota.data_vencimento_proxima, bloqueio, parcelas,
]);

export async function lerParcelasReceber(db, nota) {
  const { items, has_more } = await db.TituloCobranca.filter({ nota_fiscal_id: nota.id }, { limit: LIMITE_PARCELAS });
  if (has_more) return { bloqueio: 'Este documento excede o limite de parcelas do editor.' };
  const ids = items.map(t => t.id);
  const [ligados, notaVinculada] = await Promise.all([
    ids.length ? db.VinculoExtrato.aggregate({ query: { entidade_tipo: 'TituloCobranca', entidade_id: { $in: ids } }, groupBy: 'entidade_id' }) : { rows: [] },
    db.VinculoExtrato.count({ entidade_tipo: 'NotaFiscal', entidade_id: nota.id }),
  ]);
  const vinculados = new Set(ligados.rows.map(v => v.entidade_id));
  const ordenados = items.sort((a, b) => (a.parcela_numero || Infinity) - (b.parcela_numero || Infinity) || a.data_vencimento.localeCompare(b.data_vencimento) || a.id.localeCompare(b.id));
  const parcelas = ordenados.map(t => ({ id: t.id, nosso_numero: t.nosso_numero, parcela_numero: t.parcela_numero, valor_pago: t.valor_pago, ...campos(t), bloqueada: pago(t) || vinculados.has(t.id) }));
  const bloqueio = nota.status === 'anulada' || nota.is_espelho_ci ? 'Documento anulado ou espelho: use o documento original ativo.' : notaVinculada ? 'O documento tem recebimento vinculado diretamente. Confira a conciliação antes de editar.' : !parcelas.some(t => !t.bloqueada) ? 'Não há parcelas em aberto sem pagamento para editar.' : '';
  const assinatura = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot(nota, parcelas, bloqueio)));
  const versao = Array.from(new Uint8Array(assinatura), b => b.toString(16).padStart(2, '0')).join('');
  return { nota: { numero: nota.numero, tipo: nota.tipo, cliente: nota.cliente, valor_total: nota.valor_total }, parcelas, versao, bloqueio, items: ordenados };
}

const dataValida = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
export function planejarParcelasReceber(nota, estado, linhas) {
  if (!Array.isArray(linhas) || linhas.length > LIMITE_PARCELAS) return { erro: `Informe até ${LIMITE_PARCELAS} parcelas.` };
  const editaveis = estado.parcelas.filter(t => !t.bloqueada), base = new Map(editaveis.map(t => [t.id, t]));
  const vistas = new Set();
  let total = estado.parcelas.filter(t => t.bloqueada).reduce((s, t) => s + centavos(t.valor_titulo), 0);
  for (const l of linhas) {
    if (!l || !dataValida(l.data_vencimento) || !Number.isSafeInteger(l.centavos) || l.centavos <= 0 || l.centavos > centavos(nota.valor_total)) return { erro: 'Informe vencimentos válidos e valores positivos.' };
    if (l.id != null) {
      if (!base.has(l.id) || vistas.has(l.id)) return { erro: 'Parcelas pagas ou vinculadas não podem ser editadas.' };
      vistas.add(l.id);
    }
    total += l.centavos;
  }
  const novas = linhas.filter(l => l.id == null);
  if (vistas.size !== base.size || novas.length + estado.parcelas.length > LIMITE_PARCELAS) return { erro: 'Mantenha todas as parcelas existentes e respeite o limite de parcelas.' };
  if (total !== centavos(nota.valor_total)) return { erro: 'A soma de todas as parcelas, incluindo as bloqueadas, deve ser igual ao valor do documento.' };
  const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const atualizar = linhas.filter(l => l.id != null).filter(l => novas.length || l.centavos !== centavos(base.get(l.id).valor_titulo) || l.data_vencimento !== base.get(l.id).data_vencimento);
  const valores = l => ({ valor_titulo: l.centavos / 100, data_vencimento: l.data_vencimento, status: l.data_vencimento < hoje ? 'vencido' : 'em_aberto', parcela_total: estado.parcelas.length + novas.length });
  const numero = Math.max(0, ...estado.parcelas.map(t => Number(t.parcela_numero) || 0));
  const origem = estado.items.find(t => base.has(t.id));
  return {
    alteradas: atualizar.map(l => ({ id: l.id, ...valores(l) })),
    anteriores: atualizar.map(l => ({ id: l.id, ...campos(base.get(l.id)) })),
    novas: novas.map((l, i) => ({ ...valores(l), nota_fiscal_id: nota.id, nosso_numero: `INTERNO-${crypto.randomUUID()}`, seu_numero: origem?.seu_numero || `${nota.tipo}-${nota.numero}`, cliente: nota.cliente, ...(nota.empresa ? { empresa: nota.empresa } : {}), ...(origem?.canal_cobranca || nota.canal_cobranca ? { canal_cobranca: origem?.canal_cobranca || nota.canal_cobranca } : {}), ...(origem?.cliente_telefone ? { cliente_telefone: origem.cliente_telefone } : {}), valor_pago: 0, parcela_numero: numero + i + 1 })),
    proximo: [...linhas.map(l => l.data_vencimento), ...estado.parcelas.filter(t => t.bloqueada && t.status !== 'pago' && centavos(t.valor_pago) < centavos(t.valor_titulo)).map(t => t.data_vencimento)].filter(Boolean).sort()[0],
  };
}