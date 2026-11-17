import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { previsaoFixa } from '../../shared/despesasFixasPrevisao.ts';
import { deslocarCompetencia } from '../../shared/tributoRegras.ts';

const EMPRESAS = ['NeuralTec', 'Liesch'];
const proximoDia = d => new Date(Date.parse(`${d}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

async function faturamento(db, empresa, comp) {
  const fim = `${deslocarCompetencia(comp, 1)}-01`;
  const r = await db.NotaFiscal.aggregate({ query: { empresa, data_emissao: { $gte: `${comp}-01`, $lt: fim }, status: { $ne: 'anulada' }, is_espelho_ci: { $ne: true } }, sum: 'valor_total' });
  return Math.round(Number(r.rows[0]?.sum_valor_total || 0) * 100) / 100;
}

// Despesas fixas: uma despesa pendente por regra e ocorrência do mês. Nunca declara pagamento.
async function gerarDespesas(db, comp, dryRun) {
  const geradas = [], ignoradas = [];
  let cursor;
  do {
    const page = await db.RegraRecorrente.filter({ is_ativa: true, tipo_recorrencia: { $ne: 'eventual' } }, { sort: 'id', limit: 100, cursor });
    for (const r of page.items) {
      if (!EMPRESAS.includes(r.empresa) || !(Number(r.valor_esperado) > 0)) { ignoradas.push({ regra: r.nome, motivo: 'Sem empresa ou valor esperado' }); continue; }
      const desde = r.data_inicio > `${comp}-01` ? r.data_inicio : `${comp}-01`;
      let data = previsaoFixa(r, desde);
      if (!data) { ignoradas.push({ regra: r.nome, motivo: 'Calendário incompleto' }); continue; }
      const semanal = r.frequencia === 'semanal';
      if (!semanal && data.slice(0, 7) === comp && await db.DespesaOperacional.count({ regra_recorrente_id: r.id, competencia: comp })) continue;
      while (data?.slice(0, 7) === comp) {
        if (!await db.DespesaOperacional.count({ regra_recorrente_id: r.id, ocorrencia_vencimento: data })) {
          const nova = { data, competencia: comp, data_vencimento: data, descricao: r.nome, fornecedor: r.fornecedor || r.nome, categoria: r.categoria, origem_compra: r.origem_compra || 'empresa', tipo_compra: r.tipo_compra || 'despesas', empresa: r.empresa, valor: r.valor_esperado, valor_pago: 0, status: 'pendente', forma_pagamento: r.forma_pagamento || 'pix', recorrente: true, regra_recorrente_id: r.id, ocorrencia_vencimento: data, observacoes: `Regra recorrente ${r.id} · ${r.nome} · gerada automaticamente no início do mês` };
          if (!dryRun) await db.DespesaOperacional.create(nova);
          geradas.push({ regra: r.nome, empresa: r.empresa, vencimento: data, valor: r.valor_esperado });
        }
        if (!semanal) break;
        data = previsaoFixa(r, proximoDia(data));
      }
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return { geradas, ignoradas };
}

// DAS: previsão pelo faturamento da competência, usando a alíquota efetiva da última guia confirmada.
async function preverDAS(db, compPagamento, dryRun) {
  const comp = deslocarCompetencia(compPagamento, -1), itens = [];
  for (const empresa of EMPRESAS) {
    if (await db.Tributo.count({ empresa, tipo: 'DAS', competencia: comp })) { itens.push({ empresa, competencia: comp, situacao: 'já existe' }); continue; }
    const base = await faturamento(db, empresa, comp);
    if (base <= 0) { itens.push({ empresa, competencia: comp, situacao: 'sem faturamento' }); continue; }
    const historico = await db.Tributo.filter({ empresa, tipo: 'DAS', competencia: { $lt: comp }, previsao: { $ne: true }, valor_original: { $gt: 0 } }, { sort: '-competencia', limit: 6 });
    let aliquota = 0, referencia = '';
    for (const g of historico.items) {
      const fat = await faturamento(db, empresa, g.competencia);
      if (fat > 0) { aliquota = g.valor_original / fat; referencia = g.competencia; break; }
    }
    const valor = Math.round(base * aliquota * 100) / 100;
    const nova = { tipo: 'DAS', empresa, competencia: comp, data_vencimento: `${compPagamento}-20`, valor_original: valor, valor_pago: 0, juros_multa: 0, status: 'a_vencer', origem_compra: 'empresa', tipo_compra: 'impostos', previsao: true, previsao_base: base, previsao_aliquota: Math.round(aliquota * 1000000) / 10000,
      descricao: `DAS ${comp} · previsão pelo faturamento`,
      observacoes: aliquota > 0 ? `Estimativa: faturamento R$ ${base.toFixed(2)} × alíquota efetiva ${(aliquota * 100).toFixed(2)}% (guia ${referencia}). Confirme com a guia apurada.` : `Sem guia anterior para estimar a alíquota. Faturamento R$ ${base.toFixed(2)}. Informe o valor da guia apurada.` };
    if (!dryRun) await db.Tributo.create(nova);
    itens.push({ empresa, competencia: comp, situacao: 'previsão gerada', faturamento: base, aliquota_pct: nova.previsao_aliquota, valor });
  }
  return itens;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.competencia && !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.competencia)) return Response.json({ error: 'Competência inválida.' }, { status: 400 });
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
    const comp = body.competencia || `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
    const dryRun = body.validate_only === true;
    const db = base44.asServiceRole.entities;
    const despesas = await gerarDespesas(db, comp, dryRun);
    const das = await preverDAS(db, comp, dryRun);
    return Response.json({ success: true, modo: dryRun ? 'simulacao' : 'geracao', mes: comp, despesas_geradas: despesas.geradas.length, despesas: despesas.geradas, regras_ignoradas: despesas.ignoradas, das, fgts_inss: 'Gerados pela folha de pagamento', sem_baixas: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}