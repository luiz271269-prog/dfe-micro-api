const fonte = { papel:'fonte_oficial', grupo:'Fonte oficial', conciliacao:'nenhuma', cria_documento:true, cria_obrigacao:true, cria_movimento:false, pode_informar_pagamento:true, pode_propor_liquidacao:true, executor:'canonico', evidencia:false };
const evidencia = { papel:'evidencia_conferencia', grupo:'Evidência de conferência', cria_documento:false, cria_obrigacao:false, cria_movimento:false, pode_informar_pagamento:false, pode_propor_liquidacao:false, executor:null, evidencia:true };
export const MATRIZ_IMPORTACAO = [
  { ...fonte, tipo:'relatorio_vendas_detalhado', label:'Relatório de Vendas Diário (NFs + Parcelas)', entity:'NotaFiscal', icon:'FileText', color:'cyan', direcao:'entrada', conciliacao_posterior:'financeira_recebimento', proxima_acao:'Revisar propostas de recebimento', path:'/cobrancas', regra:'Cria notas e parcelas; valores recebidos pela fonte permanecem informados, não certificados.' },
  { ...evidencia, tipo:'relatorio_nfs', label:'NFes Emitidas no Mês (Fiscal)', entity:'EvidenciaFinanceira', icon:'FileText', color:'green', direcao:'entrada', conciliacao:'documental', proxima_acao:'Conferir documentos fiscais', path:'/faturamento', regra:'Confere número, cliente, empresa, emissão e valor. Não cria notas nem confirma recebimentos.' },
  { ...evidencia, tipo:'boletos_liquidados', label:'Boletos Liquidados', entity:'EvidenciaFinanceira', icon:'Receipt', color:'teal', papel:'evidencia_liquidacao', direcao:'entrada', conciliacao:'financeira_recebimento', pode_informar_pagamento:true, pode_propor_liquidacao:true, executor:'vincularExtrato', proxima_acao:'Revisar recebimentos com crédito bancário', path:'/cobrancas', regra:'Identifica o título; só propõe recebimento com título e crédito bancário compatíveis.' },
  { ...evidencia, tipo:'relatorio_vendas', label:'Resumo Mensal de Vendas (Fabris/Ellitte)', entity:'RelatorioFaturamento', icon:'FileText', color:'teal', evidencia:false, direcao:'entrada', conciliacao:'documental_agregada', proxima_acao:'Conferir total de vendas', path:'/faturamento', regra:'Compara o total mensal com as notas, sem alterar documentos ou recebimentos.' },
  { ...fonte, tipo:'folha_pagamento', label:'Folha de Pagamento', entity:'FolhaPagamento', icon:'Users', color:'slate', direcao:'saida', conciliacao_posterior:'financeira_pagamento', proxima_acao:'Revisar propostas de pagamento', path:'/funcionarios', regra:'Pago na planilha é declaração da fonte. A folha só é liquidada com confirmação e executor.' },
  { ...fonte, tipo:'obra_reforma', label:'Obra e Reforma', entity:'ObraReforma', icon:'Hammer', color:'brown', direcao:'saida', conciliacao_posterior:'financeira_ou_composicao', proxima_acao:'Revisar pagamentos ou composição', path:'/obras', regra:'Banco propõe pagamento; cartão propõe composição, nunca baixa bancária do componente.' },
  { ...fonte, tipo:'despesas_operacionais', label:'Despesas Operacionais', entity:'DespesaOperacional', icon:'Wallet', color:'rose', direcao:'saida', conciliacao_posterior:'financeira_ou_composicao', proxima_acao:'Revisar pagamentos ou composição', path:'/despesas', regra:'Pagamento declarado permanece separado. Cartão vincula composição; banco comprova liquidação.' },
  { ...fonte, tipo:'compras_fornecedor', label:'Compras por Fornecedor', entity:'ItemCompra', icon:'ShoppingCart', color:'orange', direcao:'saida', pode_informar_pagamento:false, conciliacao_posterior:'financeira_ou_composicao', proxima_acao:'Conferir compras e conciliar posteriormente', path:'/compras', regra:'Cria a compra e obrigação. Não amplia a extração de parcelamento ou instrumento nesta etapa.' },
  { ...evidencia, tipo:'dda_boletos', label:'DDA / Boletos a Vencer', entity:'EvidenciaFinanceira', icon:'Landmark', color:'indigo', direcao:'saida', conciliacao:'obrigacao', proxima_acao:'Revisar obrigações', path:'/contas-a-pagar', regra:'DDA é evidência de obrigação, não movimento bancário. Conferência nunca liquida.' },
  { ...fonte, tipo:'fatura_cartao', label:'Fatura de Cartão', entity:'FaturaCartao', icon:'CreditCard', color:'purple', papel:'composicao_obrigacao', grupo:'Composição', direcao:'saida', conciliacao:'composicao', conciliacao_posterior:'financeira_pagamento_fatura', pode_informar_pagamento:false, proxima_acao:'Revisar composição e pagamento da fatura', path:'/cartoes', regra:'Nova fatura nasce aberta, valor pago zero. Pagamentos anteriores do Nexus são preservados; componentes não recebem baixa.' },
  { ...fonte, tipo:'extrato_bancario', label:'Extrato Bancário Sicredi', entity:'LancamentoBancario', icon:'Landmark', color:'blue', papel:'movimento_financeiro', grupo:'Movimento financeiro', direcao:'ambas', conciliacao:'nenhuma', conciliacao_posterior:'financeira', cria_documento:false, cria_obrigacao:false, cria_movimento:true, pode_informar_pagamento:false, proxima_acao:'Revisar conciliação de pagamentos e recebimentos', path:'/extrato', regra:'Somente movimentos contabilizados. Importar não dá baixa; correspondência exata também exige autorização.' },
].map(m => ({...m, id:m.tipo, liquidacao_na_importacao:false}));
export const contratoImportacao = tipo => { const m=MATRIZ_IMPORTACAO.find(m=>m.tipo===tipo); if(!m)throw new Error('Tipo de importação não permitido.'); return m; };
export const CAMPOS_IMPORTACAO = {
  FolhaPagamento:['funcionario_id','funcionario_nome','competencia','tipo','salario_bruto','desconto_inss','desconto_irrf','desconto_vt','desconto_vr','outros_descontos','horas_extras','comissao','eventos','salario_liquido','fgts_valor','empresa','origem_compra','tipo_compra'],
  DespesaOperacional:['data','descricao','fornecedor','categoria','origem_compra','tipo_compra','valor','data_vencimento','empresa','observacoes'],
  ObraReforma:['data','data_vencimento','descricao','responsavel','tipo','tipo_profissional','local_obra','origem_compra','tipo_compra','etapa_obra','numero_nota','orcamento','valor','fornecedor_cnpj_cpf','natureza'],
  ItemCompra:['fornecedor','fornecedor_id','empresa','numero_nota','data_emissao','descricao_produto','categoria_produto','origem_compra','tipo_compra','quantidade','valor_unitario','valor_total','codigo_produto','data_vencimento'],
  FaturaCartao:['conta_cartao_id','mes_referencia','data_vencimento','valor_total'],
  LancamentoCartao:['data_lancamento','estabelecimento','categoria','origem_compra','tipo_compra','valor','natureza','empresa_beneficiada','observacao'],
  LancamentoBancario:['data','descricao','valor','categoria','origem_compra','tipo_compra','saldo_apos','conta_bancaria','detalhe','mes_referencia'],
  RelatorioFaturamento:['mes','ano','mes_nome','saidas','servicos','outros','total','fonte','observacoes']
};
export function informacaoPagamento(r,m) {
  const valor=Number(r.valor_pago_informado ?? r.valor_recebido_informado ?? r.valor_pago ?? r.valor_recebido ?? 0);
  if(!Number.isFinite(valor)||valor<0)throw new Error('Pagamento informado inválido.');
  const status=String(r.status_informado ?? r.status_pagamento ?? r.status ?? '').trim().toLowerCase().slice(0,80);
  return {pagamento_informado:!!m.pode_informar_pagamento&&(valor>0||['pago','paga','paga_total','parcial','adiantamento'].includes(status)), valor_pago_informado:valor, status_informado:status, data_pagamento_informada:String(r.data_pagamento_informada ?? r.data_pagamento ?? '').slice(0,10), forma_informada:String(r.forma_pagamento ?? '').toLowerCase().replace(/^banco_/,''), origem_informacao:'importacao'};
}
export function sanitizarImportacao(tipo,r) {
  const campos=CAMPOS_IMPORTACAO[tipo];if(!campos)throw new Error('Destino não permitido na persistência genérica.');
  const p=Object.fromEntries(campos.filter(k=>r[k]!==undefined&&r[k]!==null).map(k=>[k,r[k]]));
  if(tipo==='FolhaPagamento'){p.salario_bruto=Number(r.salario_bruto ?? r.salario_total ?? r.salarios_total ?? 0);p.status='pendente';p.valor_pago=0;}
  if(tipo==='DespesaOperacional'){p.status='pendente';p.valor_pago=0;}
  if(['ObraReforma','ItemCompra'].includes(tipo)){p.status_pagamento='pendente';p.valor_pago=0;}
  if(tipo==='FaturaCartao'){p.status='aberta';p.valor_pago=0;}
  if(tipo==='ItemCompra')p.forma_pagamento='nao_definida';
  if(tipo==='LancamentoBancario'){p.status_conciliacao='nao_conciliado';p.valor_conciliado=0;p.vinculos_count=0;}
  return p;
}