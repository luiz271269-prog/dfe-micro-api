export const PAPEL_IMPORTACAO = {
  relatorio_vendas_detalhado: { papel:'Principal', destino:'Vendas / NFs → Contas a receber', regra:'Cria notas e parcelas; receber informado não é conciliação bancária.' },
  compras_fornecedor: { papel:'Principal', destino:'Compras → Contas a pagar', regra:'Registra a compra e sua obrigação; DDA e banco conferem o pagamento.' },
  despesas_operacionais: { papel:'Principal', destino:'Despesas → Contas a pagar', regra:'Registra a despesa; o extrato é a evidência de pagamento.' },
  folha_pagamento: { papel:'Principal', destino:'Folha → Contas a pagar', regra:'Documento de origem da obrigação trabalhista.' },
  obra_reforma: { papel:'Principal', destino:'Obras → Contas a pagar', regra:'Documento de origem do serviço ou material.' },
  relatorio_nfs: { papel:'Conciliação', destino:'NFs fiscais → Conferência das vendas', regra:'Confere notas existentes; não duplica notas nem parcelas a receber.' },
  boletos_liquidados: { papel:'Conciliação', destino:'Recebimentos → Contas a receber', regra:'Confere títulos com créditos bancários; não cria vendas.' },
  dda_boletos: { papel:'Conciliação', destino:'DDA → Contas a pagar', regra:'Identifica obrigações futuras; não é pagamento nem cria compra.' },
  extrato_bancario: { papel:'Conciliação', destino:'Banco → A receber / A pagar', regra:'Créditos conciliam entradas; débitos conciliam saídas.' },
  fatura_cartao: { papel:'Principal do cartão / Conciliação', destino:'Cartão → Compras / Despesas / A pagar', regra:'Vincula compras; pagar a fatura é uma conciliação bancária separada.' },
  relatorio_vendas: { papel:'Conferência', destino:'Vendas → Resumo mensal', regra:'Resumo gerencial; não cria parcelas nem comprova recebimento.' },
};
export function arquivoDoLote(batch) {
  let notes={};
  if(batch.notes?.startsWith('http')) return {url:batch.notes};
  try { notes=JSON.parse(batch.notes || '{}'); } catch { notes={}; }
  return {uri:batch.file_uri || notes.file_uri, url:notes.file_url};
}