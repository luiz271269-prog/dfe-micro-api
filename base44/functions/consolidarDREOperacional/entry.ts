import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// DRE Operacional Consolidado — grupo econômico (NeuralTec + Liesch), regime Simples Nacional.
// Duas visões lado a lado:
//   COMPETÊNCIA: o que aconteceu no mês (data de emissão / competência / execução)
//   CAIXA: o que efetivamente entrou ou saiu, tendo VinculoExtrato como fonte única da verdade,
//          com fallback nas datas de pagamento próprias da entidade quando não há vínculo.
// FaturaCartao e TransferenciaInterna são ignorados no caixa: são meio de pagamento / movimento
// interno, não origem de obrigação (evita dupla contagem).

const LINHAS = [
  'receita_bruta',
  'das',
  'cmv',
  'folha',
  'prolabore',
  'despesas',
  'obras',
  'outros_tributos',
];

const mesDe = (d) => (d || '').slice(0, 7);
const ehProLabore = (r) => r?.origem_compra === 'pro_labore' || r?.tipo_compra === 'pro_labore';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mes = body.mes_referencia || new Date().toISOString().slice(0, 7);
    // Período: um único mês, ou os últimos N meses terminando em `mes` (visão anual = 12)
    const janela = Math.max(1, Number(body.meses) || 1);
    let [ay, am] = mes.split('-').map(Number);
    am -= janela - 1;
    while (am < 1) {
      am += 12;
      ay -= 1;
    }
    const mesInicio = `${ay}-${String(am).padStart(2, '0')}`;
    const dentro = (m) => !!m && m >= mesInicio && m <= mes;

    const sr = base44.asServiceRole.entities;
    const [notas, titulos, analises, itens, despesas, folhas, tributos, obras, vinculos, lancs] =
      await Promise.all([
        sr.NotaFiscal.list('-data_emissao', 5000),
        sr.TituloCobranca.list('-data_vencimento', 5000),
        sr.NFeAnalise.list('-data_emissao', 5000),
        sr.ItemCompra.list('-data_emissao', 5000),
        sr.DespesaOperacional.list('-data', 5000),
        sr.FolhaPagamento.list('-competencia', 5000),
        sr.Tributo.list('-data_vencimento', 5000),
        sr.ObraReforma.list('-data', 5000),
        sr.VinculoExtrato.list('-created_date', 5000),
        sr.LancamentoBancario.list('-data', 5000),
      ]);

    const comp = {};
    const cx = {};
    const itensOut = {};
    for (const l of LINHAS) {
      comp[l] = 0;
      cx[l] = 0;
      itensOut[l] = { competencia: [], caixa: [] };
    }

    function add(col, linha, valor, item) {
      const v = Number(valor) || 0;
      if (!v) return;
      if (col === 'competencia') comp[linha] += v;
      else cx[linha] += v;
      if (itensOut[linha][col].length < 300) itensOut[linha][col].push({ ...item, valor: v });
    }

    // ───────────────────────── COMPETÊNCIA ─────────────────────────

    // Receita bruta: notas emitidas no mês (exclui anuladas e NF-espelho de CI)
    for (const n of notas) {
      if (n.status === 'anulada' || n.is_espelho_ci) continue;
      if (!dentro(mesDe(n.data_emissao))) continue;
      add('competencia', 'receita_bruta', n.valor_total, {
        data: n.data_emissao,
        descricao: `${n.tipo} ${n.numero} — ${n.cliente}`,
        empresa: n.empresa || '—',
        origem: 'NotaFiscal',
        id: n.id,
      });
    }

    // Tributos por competência (DAS separado dos demais)
    for (const t of tributos) {
      const ref = t.competencia || mesDe(t.data_vencimento);
      if (!dentro(ref)) continue;
      add('competencia', t.tipo === 'DAS' ? 'das' : 'outros_tributos', t.valor_original, {
        data: t.data_vencimento,
        descricao: `${t.tipo}${t.descricao ? ' — ' + t.descricao : ''}`,
        empresa: t.empresa || '—',
        origem: 'Tributo',
        id: t.id,
      });
    }

    // CMV: preferência para NFeAnalise (com ICMS-ST e IPI, não recuperáveis no Simples)
    const analisesMes = analises.filter((a) => dentro(mesDe(a.data_emissao)));
    if (analisesMes.length > 0) {
      for (const a of analisesMes) {
        const custo =
          (a.valor_produtos || 0) +
          (a.icms_st_total || 0) +
          (a.ipi_total || 0) +
          (a.valor_frete || 0) +
          (a.valor_outras_despesas || 0) -
          (a.valor_desconto || 0);
        add('competencia', 'cmv', custo, {
          data: a.data_emissao,
          descricao: `NF-e ${a.numero_nota || ''} — ${a.emitente_nome || ''}`,
          empresa: '—',
          origem: 'NFeAnalise',
          id: a.id,
        });
      }
    } else {
      for (const i of itens) {
        if (!dentro(mesDe(i.data_emissao))) continue;
        add('competencia', 'cmv', i.valor_total, {
          data: i.data_emissao,
          descricao: `${i.descricao_produto || ''} — ${i.fornecedor || ''}`,
          empresa: '—',
          origem: 'ItemCompra',
          id: i.id,
        });
      }
    }

    // Folha por competência: custo total (bruto + FGTS). Pró-labore em linha própria.
    for (const f of folhas) {
      if (!dentro(f.competencia)) continue;
      const custo = (f.salario_bruto || 0) + (f.fgts_valor || 0);
      add('competencia', ehProLabore(f) ? 'prolabore' : 'folha', custo, {
        data: f.data_pagamento || `${f.competencia}-01`,
        descricao: `${f.funcionario_nome} — ${f.tipo || 'mensal'}`,
        empresa: f.empresa || '—',
        origem: 'FolhaPagamento',
        id: f.id,
      });
    }

    // Despesas operacionais por data de competência (execução)
    for (const d of despesas) {
      if (!dentro(mesDe(d.data))) continue;
      add('competencia', ehProLabore(d) ? 'prolabore' : 'despesas', d.valor, {
        data: d.data,
        descricao: `${d.descricao}${d.fornecedor ? ' — ' + d.fornecedor : ''}`,
        empresa: d.empresa || '—',
        origem: 'DespesaOperacional',
        id: d.id,
      });
    }

    // Obras e reformas por data de execução
    for (const o of obras) {
      if (!dentro(mesDe(o.data))) continue;
      add('competencia', 'obras', o.valor, {
        data: o.data,
        descricao: `${o.descricao} — ${o.local_obra || ''}`,
        empresa: '—',
        origem: 'ObraReforma',
        id: o.id,
      });
    }

    // ─────────────────────────── CAIXA ───────────────────────────
    // Fonte única da verdade: VinculoExtrato ligado a lançamentos do extrato no mês.

    const lancsMes = new Map();
    for (const l of lancs) if (dentro(mesDe(l.data))) lancsMes.set(l.id, l);

    const tributoById = new Map(tributos.map((t) => [t.id, t]));
    const folhaById = new Map(folhas.map((f) => [f.id, f]));
    const despesaById = new Map(despesas.map((d) => [d.id, d]));
    const comVinculo = {};
    // Créditos de receita: um mesmo lançamento pode ter vínculo com a NotaFiscal E com o
    // TituloCobranca. Acumula por lançamento e limita ao valor real do crédito no extrato,
    // para nunca contar o mesmo dinheiro duas vezes.
    const receitaPorLanc = new Map();

    for (const v of vinculos) {
      const l = lancsMes.get(v.lancamento_bancario_id);
      if (!l) continue;

      let linha = null;
      if (v.entidade_tipo === 'ItemCompra') linha = 'cmv';
      else if (v.entidade_tipo === 'ObraReforma') linha = 'obras';
      else if (v.entidade_tipo === 'Tributo') {
        const t = tributoById.get(v.entidade_id);
        linha = t && t.tipo !== 'DAS' ? 'outros_tributos' : 'das';
      } else if (v.entidade_tipo === 'FolhaPagamento') {
        linha = ehProLabore(folhaById.get(v.entidade_id)) ? 'prolabore' : 'folha';
      } else if (v.entidade_tipo === 'DespesaOperacional') {
        linha = ehProLabore(despesaById.get(v.entidade_id)) ? 'prolabore' : 'despesas';
      } else if (v.entidade_tipo === 'TituloCobranca' || v.entidade_tipo === 'NotaFiscal') {
        linha = 'receita_bruta';
      }
      if (!linha) continue;

      if (!comVinculo[v.entidade_tipo]) comVinculo[v.entidade_tipo] = new Set();
      comVinculo[v.entidade_tipo].add(v.entidade_id);

      if (linha === 'receita_bruta') {
        const atual = receitaPorLanc.get(l.id) || { lanc: l, total: 0 };
        atual.total += Math.abs(v.valor_alocado || 0);
        receitaPorLanc.set(l.id, atual);
        continue;
      }

      add('caixa', linha, Math.abs(v.valor_alocado || 0), {
        data: l.data,
        descricao: l.descricao,
        empresa: '—',
        origem: `Extrato → ${v.entidade_tipo}`,
        id: l.id,
      });
    }

    for (const { lanc, total } of receitaPorLanc.values()) {
      add('caixa', 'receita_bruta', Math.min(total, Math.abs(lanc.valor || 0)), {
        data: lanc.data,
        descricao: lanc.descricao,
        empresa: '—',
        origem: 'Extrato → recebimento',
        id: lanc.id,
      });
    }

    const jaContado = (tipo, id) => comVinculo[tipo]?.has(id);

    // Fallbacks de caixa para pagamentos sem vínculo no extrato
    for (const t of titulos) {
      if (t.status !== 'pago' || mesDe(t.data_pagamento) !== mes) continue;
      if (jaContado('TituloCobranca', t.id)) continue;
      add('caixa', 'receita_bruta', t.valor_pago || t.valor_titulo, {
        data: t.data_pagamento,
        descricao: `Título ${t.nosso_numero} — ${t.cliente}`,
        empresa: '—',
        origem: 'TituloCobranca',
        id: t.id,
      });
    }

    for (const t of tributos) {
      if (mesDe(t.data_pagamento) !== mes) continue;
      if (jaContado('Tributo', t.id)) continue;
      add('caixa', t.tipo === 'DAS' ? 'das' : 'outros_tributos', t.valor_pago || t.valor_original, {
        data: t.data_pagamento,
        descricao: `${t.tipo}${t.descricao ? ' — ' + t.descricao : ''}`,
        empresa: t.empresa || '—',
        origem: 'Tributo',
        id: t.id,
      });
    }

    for (const f of folhas) {
      if (f.status !== 'pago' || mesDe(f.data_pagamento) !== mes) continue;
      if (jaContado('FolhaPagamento', f.id)) continue;
      add('caixa', ehProLabore(f) ? 'prolabore' : 'folha', f.valor_pago || f.salario_liquido, {
        data: f.data_pagamento,
        descricao: `${f.funcionario_nome} — ${f.tipo || 'mensal'}`,
        empresa: f.empresa || '—',
        origem: 'FolhaPagamento',
        id: f.id,
      });
    }

    for (const d of despesas) {
      if (d.status !== 'pago' || mesDe(d.data) !== mes) continue;
      if (jaContado('DespesaOperacional', d.id)) continue;
      add('caixa', ehProLabore(d) ? 'prolabore' : 'despesas', d.valor, {
        data: d.data,
        descricao: `${d.descricao}${d.fornecedor ? ' — ' + d.fornecedor : ''}`,
        empresa: d.empresa || '—',
        origem: 'DespesaOperacional',
        id: d.id,
      });
    }

    for (const o of obras) {
      if (mesDe(o.data) !== mes) continue;
      if (jaContado('ObraReforma', o.id)) continue;
      add('caixa', 'obras', o.valor, {
        data: o.data,
        descricao: `${o.descricao} — ${o.local_obra || ''}`,
        empresa: '—',
        origem: 'ObraReforma',
        id: o.id,
      });
    }

    // ───────────────────── Estrutura do DRE ─────────────────────
    function montar(c) {
      const receita_liquida = c.receita_bruta - c.das;
      const lucro_bruto = receita_liquida - c.cmv;
      const total_despesas_operacionais =
        c.folha + c.prolabore + c.despesas + c.obras + c.outros_tributos;
      const lucro_operacional = lucro_bruto - total_despesas_operacionais;
      return {
        ...c,
        receita_liquida,
        lucro_bruto,
        total_despesas_operacionais,
        lucro_operacional,
        margem_bruta: c.receita_bruta ? (lucro_bruto / c.receita_bruta) * 100 : 0,
        margem_operacional: c.receita_bruta ? (lucro_operacional / c.receita_bruta) * 100 : 0,
      };
    }

    const competencia = montar(comp);
    const caixa = montar(cx);
    const temDados =
      competencia.receita_bruta !== 0 ||
      competencia.total_despesas_operacionais !== 0 ||
      competencia.cmv !== 0 ||
      caixa.receita_bruta !== 0 ||
      caixa.total_despesas_operacionais !== 0;

    return Response.json({
      mes_referencia: mes,
      regime: 'simples_nacional',
      escopo: 'grupo_consolidado',
      tem_dados: temDados,
      origem_cmv: analisesMes.length > 0 ? 'nfe_analise' : 'item_compra',
      competencia,
      caixa,
      itens: itensOut,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}