import { base44 } from '@/api/base44Client';

const money = (v) => ({ money: true, value: v });
const c = (label, get) => ({ label, get });

export const COLUNAS = {
  LancamentoBancario: { link: '/extrato', cols: [c('Data', (r) => r.data), c('Descrição', (r) => r.descricao), c('Conta', (r) => r.conta_bancaria), c('Categoria', (r) => r.categoria), c('Valor', (r) => money(r.valor))] },
  NotaFiscal: { link: '/faturamento', cols: [c('Número', (r) => `${r.tipo || ''} ${r.numero || ''}`), c('Emissão', (r) => r.data_emissao), c('Cliente', (r) => r.cliente), c('Total', (r) => money(r.valor_total))] },
  IntegracaoFinanceira: { link: '/integracoes-financeiras', cols: [c('Data', (r) => r.data_referencia), c('App', (r) => r.app_origem), c('Tipo', (r) => r.tipo_registro), c('Contraparte', (r) => r.contraparte), c('Valor', (r) => money(r.valor))] },
  ItemCompra: { link: '/compras', cols: [c('Emissão', (r) => r.data_emissao), c('Fornecedor', (r) => r.fornecedor), c('Descrição', (r) => r.descricao_produto || r.numero_nota), c('Pagamento', (r) => ({ banco_pix: 'PIX', cartao: 'Cartão', banco_boleto: 'Boleto a prazo', banco_transferencia: 'Transferência', dinheiro: 'Dinheiro' }[r.forma_pagamento] || 'Não informado')), c('Status', (r) => r.status_pagamento), c('Total da compra', (r) => money(r.valor_total)), c('Pago ao fornecedor', (r) => money(r.valor_pago || 0)), c('Saldo a pagar', (r) => money(r.status_pagamento === 'pago' ? 0 : Math.max(0, (r.valor_total || 0) - (r.valor_pago || 0))))] },
  Tributo: { link: '/tributos', cols: [c('Tipo', (r) => r.tipo), c('Competência', (r) => r.competencia), c('Vencimento', (r) => r.data_vencimento), c('Status', (r) => r.status), c('Valor', (r) => money(r.valor_original))] },
  FolhaPagamento: { link: '/funcionarios', cols: [c('Funcionário', (r) => r.funcionario_nome), c('Competência', (r) => r.competencia), c('Tipo', (r) => r.tipo), c('Status', (r) => r.status), c('Líquido', (r) => money(r.salario_liquido))] },
  DespesaOperacional: { link: '/despesas', cols: [c('Data', (r) => r.data), c('Descrição', (r) => r.descricao), c('Categoria', (r) => r.categoria), c('Status', (r) => r.status), c('Valor', (r) => money(r.valor))] },
  ObraReforma: { link: '/obras', cols: [c('Data', (r) => r.data), c('Descrição', (r) => r.descricao), c('Local', (r) => r.local_obra), c('Natureza', (r) => r.natureza || 'investimento'), c('Valor', (r) => money(r.valor))] },
  TituloCobranca: { link: '/cobrancas', cols: [c('Nosso Nº', (r) => r.nosso_numero), c('Cliente', (r) => r.cliente), c('Vencimento', (r) => r.data_vencimento), c('Status', (r) => r.status), c('Valor', (r) => money(r.valor_titulo))] },
  FaturaCartao: { link: '/cartoes', cols: [c('Mês Ref.', (r) => r.mes_referencia), c('Vencimento', (r) => r.data_vencimento), c('Status', (r) => r.status), c('Total', (r) => money(r.valor_total))] },
};

// Carrega os registros exatos (ids) que compõem uma linha do motor e monta o drill-down.
export async function carregarDrill(linha, mesLabel) {
  const cfg = COLUNAS[linha.entidade];
  if (!cfg) return null;
  const rows = linha.ids?.length ? await base44.entities[linha.entidade].filter({ id: { $in: linha.ids } }, '-created_date', 500) : [];
  return {
    title: linha.rotulo || linha.entidade,
    subtitle: `${mesLabel} · regime de ${linha.regime || 'caixa'}${linha.confianca ? ` · ${linha.confianca}` : ''}${linha.registros > linha.ids?.length ? ` · exibindo ${linha.ids.length} de ${linha.registros}` : ''}`,
    columns: cfg.cols, rows, total: linha.valor, link: cfg.link,
  };
}