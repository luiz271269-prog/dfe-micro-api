/**
 * Consolidação das obrigações JÁ PAGAS, normalizada no mesmo formato do contasPagarEngine,
 * mas indexada pela DATA DE EMISSÃO / REGISTRO do documento (não pelo vencimento).
 * Usada no modo "Pagos por emissão" da tela de Contas a Pagar. Somente leitura.
 */

import { consolidarTitulosCompras } from './titulosCompras';
import { normalizarFaturaCarteira } from '@/lib/faturaCarteira';

// Não inferir tipos dos registros antigos: a classificação é manual.

function eixos(reg, origem_tipo) {
  return {
    origem_compra: reg?.origem_compra || 'empresa',
    tipo_compra: reg?.tipo_compra || '',
  };
}

export function consolidarContasPagas({ despesas = [], tributos = [], folhas = [], faturas = [], cartoes = [], compras = [], obras = [] }) {
  const itens = [];

  despesas.filter(d => d.status === 'pago' && !d.lancamento_cartao_id).forEach(d => {
    itens.push({
      id: `desp-${d.id}`, origem_id: d.id, origem_tipo: 'despesa',
      descricao: d.descricao, fornecedor: d.fornecedor || '—', categoria: d.categoria,
      valor: d.valor,
      data_emissao: d.data,
      data_pagamento: d.data_pagamento || null,
      empresa: d.empresa, forma_pagamento: d.forma_pagamento,
      ...eixos(d, 'despesa'),
    });
  });

  tributos.filter(t => t.status === 'pago').forEach(t => {
    const [y, m] = (t.competencia || '').split('-');
    itens.push({
      id: `trib-${t.id}`, origem_id: t.id, origem_tipo: 'tributo',
      descricao: t.descricao || `${t.tipo} ${t.competencia}`, fornecedor: 'Receita / Governo', categoria: t.tipo,
      valor: t.valor_pago || t.valor_original,
      data_emissao: y && m ? `${y}-${m}-01` : t.data_vencimento,
      data_pagamento: t.data_pagamento,
      empresa: t.empresa, forma_pagamento: 'boleto',
      ...eixos(t, 'tributo'),
    });
  });

  folhas.filter(f => f.status === 'pago').forEach(f => {
    const [y, m] = (f.competencia || '').split('-');
    itens.push({
      id: `folha-${f.id}`, origem_id: f.id, origem_tipo: 'folha',
      descricao: `Salário — ${f.funcionario_nome}`, fornecedor: f.funcionario_nome, categoria: 'folha',
      valor: f.salario_liquido,
      data_emissao: y && m ? `${y}-${m}-01` : f.data_pagamento,
      data_pagamento: f.data_pagamento,
      empresa: f.empresa, forma_pagamento: 'transferencia',
      ...eixos(f, 'folha'),
    });
  });

  // Liquidação derivada dos valores, sem confiar isoladamente no status legado.
  itens.push(...faturas.map(fat => normalizarFaturaCarteira(fat, cartoes))
    .filter(fat => fat.valor_total > 0 && fat.liquidacao === 'Quitada')
    .map(fat => ({ ...fat, valor: fat.valor_pago })));

  itens.push(...consolidarTitulosCompras(compras, true));

  obras.filter(o => (o.lancamento_bancario_id || o.status_pagamento === 'pago') && !o.lancamento_cartao_id).forEach(o => {
    itens.push({
      id: `obra-${o.id}`, origem_id: o.id, origem_tipo: 'obra',
      descricao: o.descricao, fornecedor: o.responsavel || 'Prestador',
      categoria: o.tipo_profissional || o.tipo || 'obra',
      valor: o.valor || 0,
      data_emissao: o.data,
      data_pagamento: o.data_pagamento || null,
      empresa: o.empresa || '—', forma_pagamento: o.forma_pagamento,
      ...eixos(o, 'obra'),
    });
  });

  return itens.filter(i => (i.valor || 0) > 0.01);
}