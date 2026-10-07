export const ETAPAS_CONCILIACAO = [
  { nome: '1. Integridade e proteção', dependencia: 'Antes de qualquer baixa', aceite: 'Referências válidas; registros pagos protegidos; valores alocados não ultrapassam o documento nem o extrato.' },
  { nome: '2. Compra e documento', dependencia: 'Etapa 1', aceite: 'Uma compra reconhecida uma vez; vínculo inequívoco por fornecedor, empresa, valor e data; ambiguidades revisadas.' },
  { nome: '3. Quitação e caixa', dependencia: 'Etapas 1 e 2', aceite: 'Fatura quitada por débitos comprovados; pagamentos parciais preservados; pagamento não gera nova despesa.' },
  { nome: '4. Receita e rastreabilidade', dependencia: 'Etapa 1', aceite: 'Cobrança ligada à nota e aos recebimentos; origem de importação e recorrência documentada.' },
  { nome: '5. Fechamento e exceções', dependencia: 'Etapas 2 a 4', aceite: 'Reexecução sem duplicar vínculos; trilha antes/depois; ponte entre competência e caixa com diferenças explicadas.' },
];
export const PLANO_INTEGRAL = [
  ['P1','RH','Folha → Extrato','Usar os vínculos com valor alocado, preservando identidade, competência e adiantamentos.','Pagamento conciliado não altera a competência; múltiplos débitos conservam o saldo.','/funcionarios'],
  ['P1','Pagamentos','Tributos → Extrato','Validar vínculos existentes em vez de presumir ausência de campo.','Toda baixa conciliada aponta para débito válido; baixa manual continua identificada.','/tributos'],
  ['P1','Cartão','Fatura → Extrato','Distinguir dívida de cartão de compra; revisar pagamentos parciais e alocações.','Somente o débito entra no caixa; quitar fatura não cria despesa operacional.','/cartoes'],
  ['P1','Receita','Cobrança → Nota fiscal','Identificar notas sem vínculo, referências inválidas e candidatos ambíguos.','Vínculo automático somente com documento e empresa comprovados; sem apagar títulos.','/cobrancas'],
  ['P1','Pagamentos','Despesa → Pagamento','Separar compra no cartão de débito bancário; preservar data de competência.','Vínculo auditado; despesa absorvida na fatura não fica novamente a pagar.','/despesas'],
  ['P2','Pagamentos','Obras → Extrato','Confirmar débitos e separar manutenção de investimento.','Cada valor possui prova de pagamento; obra de investimento não vira despesa operacional.','/obras'],
  ['P2','Receita','Conciliação → Cobrança','Preservar a cadeia nota, título e recebimento sem baixa duplicada.','Recebimento aplicado uma vez, com saldo e título rastreáveis.','/conciliacao360'],
  ['P2','Receita','Cobrança → Extrato','Usar alocações para recebimentos parciais e múltiplos.','Valor alocado não supera crédito nem saldo do título.','/cobrancas'],
  ['P2','Banco/Caixa','Previsão → Realização','Associar realização à evidência bancária sem misturar regimes.','Previsto e realizado separados; diferença explicada pela data e pelo saldo.','/fluxocaixa'],
  ['P2','Compras','Nota de entrada → Compra → Pagamento','Rastrear a cadeia pelos itens e vínculos, sem criar pagamento duplicado na análise fiscal.','Documento fiscal chega à compra e à quitação bancária ou à fatura correspondente.','/analise-nfe'],
  ['P3','RH','Folha → Funcionário','Verificar identidade real e referências antigas sem deduplicação destrutiva.','Admissão, rescisão e histórico preservados; referências inválidas ficam para revisão.','/funcionarios'],
  ['P3','Receita','Nota fiscal → Empresa','Verificar preenchimento do campo já existente; não inferir empresa sem evidência.','Totais por empresa não incorporam registros sem empresa comprovada.','/faturamento'],
  ['P3','Infraestrutura','Regra recorrente → Ocorrência','Rastrear regra, documento e pagamento de cada ocorrência.','Regra não conta como despesa; recorrência não reaplica baixa existente.','/recorrentes'],
  ['P3','Infraestrutura','Importação → Registros','Preservar origem do lote e chaves externas; nenhuma exclusão automática.','Reimportar não duplica registros; histórico identifica a origem de cada documento.','/auditoria'],
  ['P3','Receita','Relatório gerencial → Notas','Comparar por período e empresa excluindo espelhos e documentos anulados.','Divergências exibidas sem modificar os valores originais.','/faturamento'],
].map(([priority,grupo,title,desc,aceite,rota],i)=>({id:i+1,priority,grupo,title,desc,aceite,rota,fix:desc,impact:aceite}));