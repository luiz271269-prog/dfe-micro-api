export const FONTES_FINANCEIRAS = {
  entrada: [
    { modulo: 'Vendas', fonte: 'Relatório diário · NFs + parcelas', conciliacao: 'Créditos do extrato e boletos liquidados', path: '/faturamento' },
    { modulo: 'Assistência', fonte: 'Faturas Invoice do aplicativo', conciliacao: 'Créditos bancários identificados', path: '/integracoes-financeiras' },
    { modulo: 'Locações', fonte: 'Recebível de aluguel a validar na origem', conciliacao: 'Contrato é referência, não parcela a receber', path: '/integracoes-financeiras' },
  ],
  saida: [
    { modulo: 'Compras', fonte: 'Compras e pedidos da Central', conciliacao: 'DDA, débitos bancários e compras no cartão', path: '/compras' },
    { modulo: 'Despesas', fonte: 'Despesas realizadas e regras recorrentes', conciliacao: 'Débitos bancários e lançamentos do cartão', path: '/despesas' },
    { modulo: 'Tributos e folha', fonte: 'Guias e folhas de pagamento', conciliacao: 'Débitos bancários identificados', path: '/contas-a-pagar' },
    { modulo: 'Obras e pró-labore', fonte: 'Documentos do módulo de origem', conciliacao: 'Débitos e compras no cartão quando aplicável', path: '/contas-a-pagar' },
    { modulo: 'Cartões', fonte: 'Fatura do cartão', conciliacao: 'Compra vinculada ao documento; fatura quitada pelo banco', path: '/cartoes' },
  ],
};
export const TIPOS_EVIDENCIA = ['boletos_liquidados', 'relatorio_nfs', 'dda_boletos'];
export const DIRECAO_INTEGRADA = { recebimento_aluguel: 'entrada', recebimento_servico: 'entrada', despesa_condominio: 'saida' };
export const GRUPO_IMPORTACAO = { extrato_bancario: 'Banco · evidência comum', relatorio_vendas_detalhado: 'Entradas · fontes oficiais', relatorio_vendas: 'Entradas · conferência', boletos_liquidados: 'Entradas · conciliação', relatorio_nfs: 'Entradas · conciliação', dda_boletos: 'Saídas · conciliação', fatura_cartao: 'Saídas · cartão', folha_pagamento: 'Saídas · fontes oficiais', obra_reforma: 'Saídas · fontes oficiais', despesas_operacionais: 'Saídas · fontes oficiais', compras_fornecedor: 'Saídas · fontes oficiais' };