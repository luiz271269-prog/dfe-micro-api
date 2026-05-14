/**
 * Motor de Contas a Pagar Unificado
 * Consolida 4 origens em uma única lista normalizada:
 *  - DespesaOperacional (status: pendente)
 *  - Tributo (status: a_vencer / vencido)
 *  - FolhaPagamento (status: pendente)
 *  - FaturaCartao (status: aberta / vencida)
 *
 * Também faz o pareamento com débitos do extrato para baixa automática.
 */

export function consolidarContasPagar({ despesas = [], tributos = [], folhas = [], faturas = [], cartoes = [] }) {
  const itens = [];

  despesas.filter(d => d.status === 'pendente').forEach(d => {
    itens.push({
      id: `desp-${d.id}`,
      origem_id: d.id,
      origem_tipo: 'despesa',
      descricao: d.descricao,
      fornecedor: d.fornecedor || '—',
      categoria: d.categoria,
      valor: d.valor,
      data_vencimento: d.data_vencimento || d.data,
      empresa: d.empresa,
      forma_pagamento: d.forma_pagamento,
    });
  });

  tributos.filter(t => t.status === 'a_vencer' || t.status === 'vencido').forEach(t => {
    itens.push({
      id: `trib-${t.id}`,
      origem_id: t.id,
      origem_tipo: 'tributo',
      descricao: t.descricao || `${t.tipo} ${t.competencia}`,
      fornecedor: 'Receita / Governo',
      categoria: t.tipo,
      valor: (t.valor_original || 0) - (t.valor_pago || 0),
      data_vencimento: t.data_vencimento,
      empresa: t.empresa,
      forma_pagamento: 'boleto',
    });
  });

  folhas.filter(f => f.status === 'pendente').forEach(f => {
    // Folha vence dia 5 do mês seguinte à competência
    const [y, m] = (f.competencia || '').split('-').map(Number);
    const venc = y && m ? new Date(y, m, 5).toISOString().slice(0, 10) : null;
    itens.push({
      id: `folha-${f.id}`,
      origem_id: f.id,
      origem_tipo: 'folha',
      descricao: `Salário — ${f.funcionario_nome}`,
      fornecedor: f.funcionario_nome,
      categoria: 'folha',
      valor: f.salario_liquido,
      data_vencimento: venc,
      empresa: f.empresa,
      forma_pagamento: 'transferencia',
    });
  });

  faturas.filter(fat => fat.status === 'aberta' || fat.status === 'vencida').forEach(fat => {
    const cartao = cartoes.find(c => c.id === fat.conta_cartao_id);
    itens.push({
      id: `fat-${fat.id}`,
      origem_id: fat.id,
      origem_tipo: 'fatura',
      descricao: `Fatura ${cartao?.nome || 'Cartão'} — ${fat.mes_referencia}`,
      fornecedor: cartao?.nome || 'Cartão de Crédito',
      categoria: 'cartao',
      valor: fat.valor_total - (fat.valor_pago || 0),
      data_vencimento: fat.data_vencimento,
      empresa: cartao?.empresa_vinculada || '—',
      forma_pagamento: 'debito_automatico',
    });
  });

  return itens;
}

/**
 * Agrupa por faixa de vencimento (aging).
 * Retorna: { vencidos, hoje, semana, ate15, ate30, acima30 }
 */
export function calcularAging(itens, hoje = new Date()) {
  const hojeStr = hoje.toISOString().slice(0, 10);
  const addDias = n => new Date(hoje.getTime() + n * 86400000).toISOString().slice(0, 10);
  const d7 = addDias(7);
  const d15 = addDias(15);
  const d30 = addDias(30);

  const buckets = { vencidos: [], hoje: [], semana: [], ate15: [], ate30: [], acima30: [], semData: [] };
  itens.forEach(i => {
    const v = i.data_vencimento;
    if (!v) buckets.semData.push(i);
    else if (v < hojeStr) buckets.vencidos.push(i);
    else if (v === hojeStr) buckets.hoje.push(i);
    else if (v <= d7) buckets.semana.push(i);
    else if (v <= d15) buckets.ate15.push(i);
    else if (v <= d30) buckets.ate30.push(i);
    else buckets.acima30.push(i);
  });
  return buckets;
}

/**
 * Normaliza string para matching (remove acentos, lowercase, trim).
 */
function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Calcula afinidade textual entre descrição/detalhe do extrato e a conta a pagar.
 * Retorna bônus de score (negativo = melhor) baseado no tipo de origem:
 *  - folha: PIX no nome do funcionário (procura primeiro nome na descrição/detalhe)
 *  - cartao: descrição menciona "cartao", "fatura" ou o nome do cartão
 *  - tributo: descrição menciona DAS, DARF, GPS, ICMS, ISS, FGTS, INSS, tributo, gov
 *  - despesa: nome do fornecedor aparece na descrição
 */
function bonusAfinidade(lanc, conta) {
  const texto = norm(`${lanc.descricao || ''} ${lanc.detalhe || ''}`);
  if (!texto) return 0;

  if (conta.origem_tipo === 'folha') {
    const nome = norm(conta.fornecedor);
    if (!nome) return 0;
    const primeiroNome = nome.split(' ')[0];
    // PIX a funcionário tipicamente tem o nome no detalhe
    if (primeiroNome.length >= 3 && texto.includes(primeiroNome)) return -50;
    return 0;
  }

  if (conta.origem_tipo === 'fatura') {
    // Faturas: débito automático ou pagamento de cartão
    const palavras = ['cartao', 'fatura', 'credito'];
    if (palavras.some(p => texto.includes(p))) return -30;
    const nomeCartao = norm(conta.fornecedor); // ex: "Sicoob - Luiz Carlos"
    const partes = nomeCartao.split(/[\s\-—–]+/).filter(p => p.length >= 4);
    if (partes.some(p => texto.includes(p))) return -40;
    return 0;
  }

  if (conta.origem_tipo === 'tributo') {
    const tags = ['das', 'darf', 'gps', 'icms', 'iss', 'inss', 'fgts', 'simples', 'tributo', 'gov', 'receita', 'federal'];
    if (tags.some(t => texto.includes(t))) return -40;
    return 0;
  }

  if (conta.origem_tipo === 'despesa') {
    const fornecedor = norm(conta.fornecedor);
    if (fornecedor && fornecedor.length >= 4 && texto.includes(fornecedor)) return -40;
    // tenta palavras significativas do fornecedor
    const partes = fornecedor.split(/\s+/).filter(p => p.length >= 5);
    if (partes.some(p => texto.includes(p))) return -25;
    return 0;
  }

  return 0;
}

/**
 * Dado um débito do extrato bancário, procura o item de conta a pagar compatível.
 * Match por valor (±0.50) + data_vencimento próxima (±15 dias) + afinidade textual por tipo.
 * Cartão e folha aceitam janela maior (±20 dias) pois costumam variar de data.
 */
export function acharContaPagarPorLancamento(lanc, contasPagar, toleranciaDias = 15, toleranciaValor = 0.5) {
  const valor = Math.abs(lanc.valor);
  const dataLanc = new Date(lanc.data);

  const candidatos = contasPagar
    .map(c => {
      if (Math.abs(c.valor - valor) > toleranciaValor) return null;
      if (!c.data_vencimento) return null;
      // Folha e cartão podem ter variação maior de data
      const janela = (c.origem_tipo === 'folha' || c.origem_tipo === 'fatura') ? 20 : toleranciaDias;
      const diffDias = Math.abs((new Date(c.data_vencimento) - dataLanc) / 86400000);
      if (diffDias > janela) return null;
      const diffValor = Math.abs(c.valor - valor);
      const bonus = bonusAfinidade(lanc, c);
      // score: menor é melhor. Afinidade textual reduz drasticamente o score.
      const score = diffDias * 10 + diffValor + bonus;
      return { item: c, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  return candidatos[0]?.item || null;
}

/**
 * Baixa automática a partir do extrato bancário.
 * Para cada lançamento de débito (saída) ainda não conciliado, procura uma conta a pagar
 * compatível e atualiza a entidade-origem para status 'pago' + cria VinculoExtrato.
 *
 * Retorna: { conciliados, totalLancamentos, totalContas, baixas: [...] }
 */
export async function executarBaixaAutomatica(base44, { despesas, tributos, folhas, faturas, cartoes }) {
  const itens = consolidarContasPagar({ despesas, tributos, folhas, faturas, cartoes });

  // Buscar débitos do extrato não conciliados (valor negativo)
  // Limitar aos últimos 90 dias para performance
  const todosLancamentos = await base44.entities.LancamentoBancario.list('-data', 2000);
  const lancamentosDebito = todosLancamentos.filter(l =>
    l.valor < 0 &&
    l.status_conciliacao !== 'conciliado' &&
    l.categoria !== 'transferencia' &&
    l.categoria !== 'interno'
  );

  // Buscar vínculos existentes para evitar dupla baixa
  const vinculosExistentes = await base44.entities.VinculoExtrato.list('-created_date', 5000);
  const lancsJaVinculados = new Set(vinculosExistentes.map(v => v.lancamento_bancario_id));
  const contasJaVinculadas = new Set(
    vinculosExistentes.map(v => `${v.entidade_tipo}-${v.entidade_id}`)
  );

  const contasDisponiveis = itens.filter(i => {
    const tipoEntidade = mapearTipoEntidade(i.origem_tipo);
    return !contasJaVinculadas.has(`${tipoEntidade}-${i.origem_id}`);
  });

  const baixas = [];
  const usadas = new Set();

  for (const lanc of lancamentosDebito) {
    if (lancsJaVinculados.has(lanc.id)) continue;

    const candidatos = contasDisponiveis.filter(c => !usadas.has(c.id));
    const match = acharContaPagarPorLancamento(lanc, candidatos);
    if (!match) continue;

    usadas.add(match.id);
    baixas.push({ lanc, conta: match });
  }

  // Aplicar baixas em paralelo (lotes de 5)
  let aplicadas = 0;
  for (let i = 0; i < baixas.length; i += 5) {
    const chunk = baixas.slice(i, i + 5);
    await Promise.all(chunk.map(({ lanc, conta }) => aplicarBaixa(base44, lanc, conta)));
    aplicadas += chunk.length;
  }

  return {
    conciliados: aplicadas,
    totalLancamentos: lancamentosDebito.length,
    totalContas: itens.length,
    baixas,
  };
}

function mapearTipoEntidade(origem_tipo) {
  return {
    despesa: 'DespesaOperacional',
    tributo: 'Tributo',
    folha: 'FolhaPagamento',
    fatura: 'FaturaCartao',
  }[origem_tipo];
}

async function aplicarBaixa(base44, lanc, conta) {
  const entidadeTipo = mapearTipoEntidade(conta.origem_tipo);
  const valorAlocado = Math.abs(lanc.valor);

  // 1. Atualiza a entidade-origem para status 'pago'
  if (conta.origem_tipo === 'despesa') {
    await base44.entities.DespesaOperacional.update(conta.origem_id, {
      status: 'pago',
      data: lanc.data,
    });
  } else if (conta.origem_tipo === 'tributo') {
    await base44.entities.Tributo.update(conta.origem_id, {
      status: 'pago',
      data_pagamento: lanc.data,
      valor_pago: valorAlocado,
    });
  } else if (conta.origem_tipo === 'folha') {
    await base44.entities.FolhaPagamento.update(conta.origem_id, {
      status: 'pago',
      data_pagamento: lanc.data,
    });
  } else if (conta.origem_tipo === 'fatura') {
    await base44.entities.FaturaCartao.update(conta.origem_id, {
      status: 'paga_total',
      data_pagamento: lanc.data,
      valor_pago: valorAlocado,
    });
  }

  // 2. Cria o VinculoExtrato (rastreabilidade — evita dupla baixa)
  await base44.entities.VinculoExtrato.create({
    lancamento_bancario_id: lanc.id,
    entidade_tipo: entidadeTipo,
    entidade_id: conta.origem_id,
    valor_alocado: valorAlocado,
    tipo_vinculo: 'pagamento_integral',
    conciliado_por: 'auto',
    confianca: 95,
    observacao: `Baixa automática · ${conta.descricao}`,
  });

  // 3. Atualiza o lançamento para conciliado
  await base44.entities.LancamentoBancario.update(lanc.id, {
    status_conciliacao: 'conciliado',
    vinculos_count: (lanc.vinculos_count || 0) + 1,
    valor_conciliado: (lanc.valor_conciliado || 0) + valorAlocado,
  });
}