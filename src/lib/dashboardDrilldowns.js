// Constrói os dados de drill-down (auditoria forense) de cada totalizador do Dashboard.
// Replica EXATAMENTE os mesmos filtros usados no cálculo das métricas.

const money = (v) => ({ money: true, value: v });

function filtroMes(arr, field, selectedMonth, isAnnual) {
  const periodo = isAnnual ? selectedMonth.slice(0, 4) : selectedMonth;
  return arr.filter((r) => (r[field] || '').startsWith(periodo));
}

export function getDrilldown(key, { rawData, selectedMonth, isAnnual }) {
  const { lanc, nfs, tit, comp, obras, trib, func, folhas, faturas, fluxo } = rawData;
  const periodo = isAnnual ? selectedMonth.slice(0, 4) : selectedMonth;
  const lancF = lanc.filter((r) => (r.data || '').startsWith(periodo));
  const nfsValidas = filtroMes(nfs, 'data_emissao', selectedMonth, isAnnual).filter((n) => !n.is_espelho_ci && n.status !== 'anulada');

  const colsLanc = [
    { label: 'Data', get: (r) => r.data },
    { label: 'Descrição', get: (r) => r.descricao },
    { label: 'Categoria', get: (r) => r.categoria },
    { label: 'Valor', get: (r) => money(r.valor) },
  ];
  const colsNF = [
    { label: 'Número', get: (r) => `${r.tipo || ''} ${r.numero}` },
    { label: 'Emissão', get: (r) => r.data_emissao },
    { label: 'Cliente', get: (r) => r.cliente },
    { label: 'Vendedor', get: (r) => r.vendedor },
    { label: 'Total', get: (r) => money(r.valor_total) },
    { label: 'Em Aberto', get: (r) => money(r.valor_aberto) },
  ];
  const colsTit = [
    { label: 'Nosso Nº', get: (r) => r.nosso_numero },
    { label: 'Cliente', get: (r) => r.cliente },
    { label: 'Vencimento', get: (r) => r.data_vencimento },
    { label: 'Pagamento', get: (r) => r.data_pagamento || '—' },
    { label: 'Valor', get: (r) => money(r.valor_titulo) },
    { label: 'Pago', get: (r) => money(r.valor_pago) },
    { label: 'Status', get: (r) => r.status },
  ];

  switch (key) {
    case 'saldo': {
      const rows = lanc
        .filter((l) => l.conta_bancaria === 'NeuralTec 36092-2' && l.saldo_apos != null)
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
        .slice(0, 100);
      return {
        title: 'Saldo NeuralTec — Sicredi 36092-2',
        subtitle: 'Últimos 100 lançamentos com saldo registrado (mais recente primeiro)',
        columns: [...colsLanc, { label: 'Saldo Após', get: (r) => money(r.saldo_apos) }],
        rows, total: null, link: '/extrato',
      };
    }
    case 'entradas': {
      const rows = lancF.filter((l) => l.categoria === 'recebimento');
      return {
        title: 'Entradas (Recebimentos)', columns: colsLanc, rows,
        total: rows.reduce((s, l) => s + (l.valor || 0), 0), link: '/extrato',
      };
    }
    case 'saidas': {
      const rows = lancF.filter((l) => l.categoria !== 'recebimento');
      return {
        title: 'Saídas (Pagamentos)', columns: colsLanc, rows,
        total: -rows.reduce((s, l) => s + Math.abs(l.valor || 0), 0), link: '/extrato',
      };
    }
    case 'totalFat':
      return {
        title: 'Total Faturado', subtitle: 'NFs + CIs válidas (exclui NFs-espelho de CI)',
        columns: colsNF, rows: nfsValidas,
        total: nfsValidas.reduce((s, n) => s + (n.valor_total || 0), 0), link: '/faturamento',
      };
    case 'aReceber': {
      const rows = nfsValidas.filter((n) => (n.valor_aberto || 0) > 0);
      return {
        title: 'A Receber — NFs em aberto', columns: colsNF, rows,
        total: rows.reduce((s, n) => s + (n.valor_aberto || 0), 0), link: '/faturamento',
      };
    }
    case 'tiago':
    case 'thais': {
      const vend = key === 'tiago' ? 'Tiago' : 'Thais';
      const rows = nfsValidas.filter((n) => n.vendedor === vend);
      return {
        title: `Vendas — ${vend}`, columns: colsNF, rows,
        total: rows.reduce((s, n) => s + (n.valor_total || 0), 0), link: '/faturamento',
      };
    }
    case 'emitido': {
      const rows = filtroMes(tit, 'data_vencimento', selectedMonth, isAnnual);
      return {
        title: 'Cobranças Emitidas', subtitle: 'Boletos com vencimento no período',
        columns: colsTit, rows,
        total: rows.reduce((s, t) => s + (t.valor_titulo || 0), 0), link: '/cobrancas',
      };
    }
    case 'recebido': {
      const rows = filtroMes(tit, 'data_vencimento', selectedMonth, isAnnual)
        .filter((t) => t.status === 'pago');
      return {
        title: 'Recebidos da Carteira', subtitle: 'Títulos pagos com vencimento no período selecionado',
        columns: colsTit, rows,
        total: rows.reduce((s, t) => s + (t.valor_pago || 0), 0), link: '/cobrancas',
      };
    }
    case 'emAberto': {
      const rows = tit.filter((t) => t.status !== 'pago');
      return {
        title: 'Cobranças em Aberto', subtitle: 'Total geral — todos os vencimentos',
        columns: colsTit, rows,
        total: rows.reduce((s, t) => s + (t.valor_titulo || 0), 0), link: '/cobrancas',
      };
    }
    case 'compras': {
      const rows = filtroMes(comp, 'data_emissao', selectedMonth, isAnnual);
      return {
        title: 'Compras',
        columns: [
          { label: 'Emissão', get: (r) => r.data_emissao },
          { label: 'Fornecedor', get: (r) => r.fornecedor },
          { label: 'Descrição', get: (r) => r.descricao || r.numero_nota || '—' },
          { label: 'Valor', get: (r) => money(r.valor_total) },
        ],
        rows, total: rows.reduce((s, c) => s + (c.valor_total || 0), 0), link: '/compras',
      };
    }
    case 'obras': {
      const rows = filtroMes(obras, 'data', selectedMonth, isAnnual);
      return {
        title: 'Obras e Reformas',
        columns: [
          { label: 'Data', get: (r) => r.data },
          { label: 'Descrição', get: (r) => r.descricao },
          { label: 'Tipo', get: (r) => r.tipo },
          { label: 'Local', get: (r) => r.local_obra },
          { label: 'Valor', get: (r) => money(r.valor) },
        ],
        rows, total: rows.reduce((s, o) => s + (o.valor || 0), 0), link: '/obras',
      };
    }
    case 'cartoes': {
      const rows = filtroMes(faturas, 'mes_referencia', selectedMonth, isAnnual);
      return {
        title: 'Faturas de Cartão no Período',
        columns: [
          { label: 'Mês Ref.', get: (r) => r.mes_referencia },
          { label: 'Vencimento', get: (r) => r.data_vencimento },
          { label: 'Total', get: (r) => money(r.valor_total) },
          { label: 'Pago', get: (r) => money(r.valor_pago) },
          { label: 'Status', get: (r) => r.status },
        ],
        rows, total: rows.reduce((s, f) => s + (f.valor_total || 0), 0), link: '/cartoes',
      };
    }
    case 'proxVenc': {
      const rows = faturas.filter((f) => f.status !== 'paga_total')
        .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));
      return {
        title: 'Faturas em Aberto', subtitle: 'Ordenadas por vencimento',
        columns: [
          { label: 'Mês Ref.', get: (r) => r.mes_referencia },
          { label: 'Vencimento', get: (r) => r.data_vencimento },
          { label: 'Total', get: (r) => money(r.valor_total) },
          { label: 'Status', get: (r) => r.status },
        ],
        rows, total: rows.reduce((s, f) => s + (f.valor_total || 0), 0), link: '/cartoes',
      };
    }
    case 'tributos': {
      const rows = trib.filter((t) => t.status === 'a_vencer' || t.status === 'vencido');
      return {
        title: 'Tributos a Pagar', subtitle: 'A vencer + vencidos',
        columns: [
          { label: 'Tipo', get: (r) => r.tipo },
          { label: 'Competência', get: (r) => r.competencia },
          { label: 'Vencimento', get: (r) => r.data_vencimento },
          { label: 'Empresa', get: (r) => r.empresa },
          { label: 'Valor', get: (r) => money(r.valor_original) },
          { label: 'Status', get: (r) => r.status },
        ],
        rows, total: rows.reduce((s, t) => s + (t.valor_original || 0), 0), link: '/tributos',
      };
    }
    case 'tribVencidos': {
      const rows = trib.filter((t) => t.status === 'vencido');
      return {
        title: 'Tributos Vencidos',
        columns: [
          { label: 'Tipo', get: (r) => r.tipo },
          { label: 'Competência', get: (r) => r.competencia },
          { label: 'Vencimento', get: (r) => r.data_vencimento },
          { label: 'Empresa', get: (r) => r.empresa },
          { label: 'Valor', get: (r) => money(r.valor_original) },
        ],
        rows, total: rows.reduce((s, t) => s + (t.valor_original || 0), 0), link: '/tributos',
      };
    }
    case 'funcAtivos': {
      const rows = func.filter((f) => f.status === 'ativo');
      return {
        title: 'Colaboradores Ativos',
        columns: [
          { label: 'Nome', get: (r) => r.nome },
          { label: 'Cargo', get: (r) => r.cargo },
          { label: 'Setor', get: (r) => r.setor },
          { label: 'Empresa', get: (r) => r.empresa },
          { label: 'Salário Base', get: (r) => money(r.salario_base) },
        ],
        rows, total: null, link: '/funcionarios',
      };
    }
    case 'folhaAtual': {
      const rows = folhas.filter((f) => f.competencia === selectedMonth && f.status === 'pago');
      return {
        title: `Folha Paga — ${selectedMonth}`,
        columns: [
          { label: 'Funcionário', get: (r) => r.funcionario_nome },
          { label: 'Bruto', get: (r) => money(r.salario_bruto) },
          { label: 'Comissão', get: (r) => money(r.comissao) },
          { label: 'Líquido', get: (r) => money(r.salario_liquido) },
          { label: 'Pagamento', get: (r) => r.data_pagamento || '—' },
        ],
        rows, total: rows.reduce((s, f) => s + (f.salario_liquido || 0), 0), link: '/funcionarios',
      };
    }
    case 'fluxo': {
      const hoje = new Date().toISOString().slice(0, 10);
      const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const rows = fluxo.filter((r) =>
        (r.status === 'previsto' || r.status === 'confirmado') &&
        r.data_prevista && r.data_prevista <= limite &&
        (r.tipo === 'entrada' || r.data_prevista >= hoje));
      return {
        title: 'Previsões — Próximos 30 dias',
        columns: [
          { label: 'Data', get: (r) => r.data_prevista },
          { label: 'Tipo', get: (r) => r.tipo },
          { label: 'Descrição', get: (r) => r.descricao },
          { label: 'Valor', get: (r) => money(r.tipo === 'saida' ? -(r.valor_previsto || 0) : (r.valor_previsto || 0)) },
          { label: 'Status', get: (r) => r.status },
        ],
        rows,
        total: rows.reduce((s, r) => s + (r.tipo === 'entrada' ? (r.valor_previsto || 0) : -(r.valor_previsto || 0)), 0),
        link: '/fluxocaixa',
      };
    }
    default:
      return null;
  }
}