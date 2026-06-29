// Rótulos dos tipos de importação que podem ser vinculados a uma pasta do Drive.
// 'xml' e 'comprovante' têm processamento automático completo; os demais coletam
// arquivos no inbox (ArquivoImportInbox) pré-classificados pelo tipo da pasta.
export const TIPOS_IMPORTACAO = [
  { id: 'xml',                        label: 'XMLs de NF-e',              desc: 'Importa e analisa notas fiscais automaticamente', auto: true },
  { id: 'comprovante',                label: 'Comprovantes (PDF/foto)',   desc: 'PDFs e fotos viram um inbox deduplicado',          auto: true },
  { id: 'extrato_bancario',           label: 'Extrato Bancário',          desc: 'Coleta extratos novos para importar' },
  { id: 'fatura_cartao',              label: 'Faturas de Cartão',         desc: 'Coleta faturas novas para importar' },
  { id: 'boletos_liquidados',         label: 'Boletos Liquidados',        desc: 'Coleta relatórios de boletos pagos' },
  { id: 'relatorio_vendas_detalhado', label: 'Relatório de Vendas (NFs)', desc: 'Coleta relatórios de vendas diários' },
  { id: 'relatorio_nfs',              label: 'NFes Emitidas (Fiscal)',    desc: 'Coleta relatórios fiscais de NFs' },
  { id: 'compras_fornecedor',         label: 'Compras por Fornecedor',    desc: 'Coleta relatórios de compras' },
  { id: 'folha_pagamento',            label: 'Folha de Pagamento',        desc: 'Coleta folhas de pagamento' },
  { id: 'dda_boletos',                label: 'DDA / Boletos a Vencer',    desc: 'Coleta boletos a vencer' },
  { id: 'despesas_operacionais',      label: 'Despesas Operacionais',     desc: 'Coleta despesas operacionais' },
  { id: 'obra_reforma',               label: 'Obras e Reformas',          desc: 'Coleta comprovantes de obras' },
];

export const TIPO_LABEL = Object.fromEntries(TIPOS_IMPORTACAO.map(t => [t.id, t.label]));
export const TIPO_INFO = Object.fromEntries(TIPOS_IMPORTACAO.map(t => [t.id, t]));