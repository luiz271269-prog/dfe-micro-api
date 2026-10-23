# Contrato funcional do cartão no Nexus

## Camadas e fontes
- Documento (compra, despesa, obra): natureza e competência do fato econômico.
- LancamentoCartao: componente importado da obrigação do cartão.
- VinculoCartao: correspondência documental auditável, não um pagamento.
- FaturaCartao: total, vencimento, pagamentos registrados e saldo da obrigação.
- VinculoExtrato da FaturaCartao: evidência de pagamento bancário, total ou parcial.
- LancamentoBancario: saída efetiva de caixa, reconhecida uma única vez.

A compra explica a fatura. A fatura possui saldo a pagar. O banco paga a fatura.

## Proibições
O vínculo ao cartão e o pagamento da fatura não copiam valor_pago, status pago ou data_pagamento para os componentes.
O pagamento da fatura não gera outra despesa nem altera a competência dos documentos.
Não reconhecer estoque como CMV apenas pelo uso do cartão; este contrato não implementa nem modifica a apuração de CMV.

## Consultas
Contas a Pagar soma somente o saldo da fatura, nunca os documentos vinculados ao cartão.
Contas Pagas apresenta cada fatura quitada uma vez, com acesso à mesma composição explicativa.
A composição é consultada sob demanda, paginada, sem acrescentar seus valores ao total da carteira.
Liquidação (Aberta, Parcial, Quitada) e temporalidade (A vencer, Vence hoje, Vencida) são dimensões distintas.
Saldo é o total menos pagamentos registrados, em centavos, limitado a zero; eventual excedente não é apagado.
Pagamentos registrados são comparados com evidências bancárias sem substituir automaticamente os valores históricos.

## Duas conciliações
Composição compara o total importado da fatura com os lançamentos líquidos, mantendo créditos e estornos com sinal e excluindo pagamentos meramente informativos.
Naturezas classificadas, encargos e retiradas podem explicar lançamentos sem documento associado.
Fatura menos documentos não é um indicador de não identificados.
Pagamento concilia exclusivamente a obrigação FaturaCartao com débitos bancários; não rateia os pagamentos pelos documentos.

## Automações revisadas
- Aplicação de VinculoCartao: apenas referência, instrumento e auditoria; campos financeiros do documento preservados.
- liquidarItensFaturaPaga: compatibilidade sem escrita e sem cascata.
- Liquidar itens ao pagar fatura: desativada.
- Liquidar item incluído em fatura paga: somente composição documental, sem baixa financeira.

## Histórico
Nenhum saneamento financeiro retroativo nesta etapa.
Antes de qualquer correção futura, distinguir cascata comprovada em auditoria de pagamentos diretos, declarados e bancários; apresentar prévia, preservar originais e exigir confirmação.
Situações históricas divergentes são sinalizadas na consulta, sem regravação.

## Referências conceituais
https://support.ramp.com/overview-of-ramp-accounting
https://quickbooks.intuit.com/r/taxes/are-credit-card-payments-tax-deductible/
Referências conceituais não substituem validação fiscal brasileira nem evidência dos registros do Nexus.