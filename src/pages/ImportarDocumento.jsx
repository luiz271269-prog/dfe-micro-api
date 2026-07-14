import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { InvokeLLM, UploadFile } from '@/integrations/Core';
import { Upload, FileText, ShoppingCart, CreditCard, Hammer, Users, Landmark, Receipt, CheckCircle, AlertTriangle, XIcon, Calendar, Wallet, Trash2 } from 'lucide-react';
import { deduplicarImportacoes } from '@/functions/deduplicarImportacoes';
import { conciliarNFsTitulosSicredi } from '@/functions/conciliarNFsTitulosSicredi';
import { deduplicateRecords, saveDeduplicatedRecords } from '@/lib/deduplicationEngine';
import { Button } from '@/components/ui/button';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency } from '../lib/formatters';
import TabelaRevisaoVendasDetalhado from '../components/importar/TabelaRevisaoVendasDetalhado';
import PainelMemoriaImportacao from '../components/importar/PainelMemoriaImportacao';
import ExtratoValidationCard from '../components/importar/ExtratoValidationCard';
import { registrarResultado, assinaturaDeRegistros } from '../lib/memoriaImportacaoEngine';
import { aplicarRegrasHistorico } from '../lib/aplicarRegrasHistorico';
import { validateExtratoRecords } from '../lib/extratoValidation';

const DOC_TYPES = [
{ id: 'extrato_bancario', label: 'Extrato Bancário Sicredi', icon: Landmark, color: 'blue', entity: 'LancamentoBancario', dedup: ['data', 'valor'], group: 'Visão Geral' },
{ id: 'dda_boletos', label: 'DDA / Boletos a Vencer', icon: Landmark, color: 'indigo', entity: 'LancamentoBancario', dedup: ['data', 'descricao', 'valor'], group: 'Visão Geral' },
{ id: 'fatura_cartao', label: 'Fatura de Cartão', icon: CreditCard, color: 'purple', entity: 'FaturaCartao', dedup: ['conta_cartao_id', 'mes_referencia'], group: 'Visão Geral' },
{ id: 'relatorio_nfs', label: 'NFes Emitidas no Mês (Fiscal)', icon: FileText, color: 'green', entity: 'NotaFiscal', dedup: ['tipo', 'numero'], group: 'Receita' },
{ id: 'relatorio_vendas_detalhado', label: 'Relatório de Vendas Diário (NFs + Parcelas)', icon: FileText, color: 'cyan', entity: 'NotaFiscal', dedup: ['numero'], group: 'Receita' },
{ id: 'relatorio_vendas', label: 'Resumo Mensal de Vendas (Fabris/Ellitte)', icon: FileText, color: 'teal', entity: 'RelatorioFaturamento', dedup: ['mes'], group: 'Receita' },
{ id: 'boletos_liquidados', label: 'Boletos Liquidados', icon: Receipt, color: 'teal', entity: 'TituloCobranca', dedup: ['nosso_numero'], group: 'Receita' },
{ id: 'folha_pagamento', label: 'Folha de Pagamento', icon: Users, color: 'slate', entity: 'FolhaPagamento', dedup: ['funcionario_nome', 'competencia'], group: 'Pagamentos' },
{ id: 'obra_reforma', label: 'Obra e Reforma', icon: Hammer, color: 'brown', entity: 'ObraReforma', dedup: ['data', 'responsavel', 'valor'], group: 'Pagamentos' },
{ id: 'despesas_operacionais', label: 'Despesas Operacionais', icon: Wallet, color: 'rose', entity: 'DespesaOperacional', dedup: ['data', 'descricao', 'valor'], group: 'Pagamentos' },
{ id: 'compras_fornecedor', label: 'Compras por Fornecedor', icon: ShoppingCart, color: 'orange', entity: 'ItemCompra', dedup: ['fornecedor', 'numero_nota', 'descricao_produto'], group: 'Compras & Estoque' }];

// Ordem oficial dos grupos (espelha o menu lateral de acessos)
const DOC_GROUPS = ['Visão Geral', 'Receita', 'Pagamentos', 'Compras & Estoque'];


const COLOR_MAP = {
  blue: { card: 'border-blue-200 bg-blue-50', icon: 'text-blue-600 bg-blue-100', active: 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' },
  teal: { card: 'border-teal-200 bg-teal-50', icon: 'text-teal-600 bg-teal-100', active: 'border-teal-500 bg-teal-100 ring-2 ring-teal-300' },
  cyan: { card: 'border-cyan-200 bg-cyan-50', icon: 'text-cyan-600 bg-cyan-100', active: 'border-cyan-500 bg-cyan-100 ring-2 ring-cyan-300' },
  green: { card: 'border-green-200 bg-green-50', icon: 'text-green-600 bg-green-100', active: 'border-green-500 bg-green-100 ring-2 ring-green-300' },
  orange: { card: 'border-orange-200 bg-orange-50', icon: 'text-orange-600 bg-orange-100', active: 'border-orange-500 bg-orange-100 ring-2 ring-orange-300' },
  purple: { card: 'border-purple-200 bg-purple-50', icon: 'text-purple-600 bg-purple-100', active: 'border-purple-500 bg-purple-100 ring-2 ring-purple-300' },
  brown: { card: 'border-amber-200 bg-amber-50', icon: 'text-amber-700 bg-amber-100', active: 'border-amber-600 bg-amber-100 ring-2 ring-amber-400' },
  slate: { card: 'border-slate-200 bg-slate-50', icon: 'text-slate-600 bg-slate-100', active: 'border-slate-500 bg-slate-100 ring-2 ring-slate-300' },
  indigo: { card: 'border-indigo-200 bg-indigo-50', icon: 'text-indigo-600 bg-indigo-100', active: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300' },
  rose: { card: 'border-rose-200 bg-rose-50', icon: 'text-rose-600 bg-rose-100', active: 'border-rose-500 bg-rose-100 ring-2 ring-rose-300' }
};

const PROMPTS = {
  extrato_bancario: `Você é um sistema de extração de dados bancários. Analise este extrato (PDF, imagem ou arquivo OFX/QFX do Sicredi ou qualquer banco) e extraia TODOS os lançamentos em JSON.
Para arquivos OFX/QFX: extraia cada <STMTTRN> — use <DTPOSTED> como data, <TRNAMT> como valor (mantendo sinal), <MEMO> ou <NAME> como descrição, <FITID> como detalhe.
Retorne APENAS um array JSON válido, sem texto adicional, no formato:
[{"data":"YYYY-MM-DD","descricao":"descrição exata do extrato","valor":numero_positivo_ou_negativo,"categoria":"recebimento ou fornecedor ou pessoal ou tributo ou despesa_operacional ou financeiro ou saque ou transferencia ou interno","saldo_apos":numero,"conta_bancaria":"NeuralTec 36092-2","detalhe":"documento ex: COB000001 ou PIX_DEB ou FITID ou vazio"}]
Regras: Créditos=valor POSITIVO, Débitos=valor NEGATIVO, incluir TODOS os lançamentos efetivamente contabilizados. Ignore "SALDO ANTERIOR", linhas de saldo consolidado e lançamentos agendados, projetados ou futuros. A data deve ser a data de contabilização impressa na linha, nunca vencimento ou data prevista. Confira cada dia separadamente: saldo inicial do dia + entradas − saídas = saldo final do mesmo dia; nunca mova um lançamento para outro dia.`,

  boletos_liquidados: `Analise este relatório/comprovante de BOLETOS LIQUIDADOS (Sicredi/Banco) e extraia TODOS os pagamentos em JSON.

Retorne APENAS um array JSON válido (sem texto adicional, sem markdown):
[{"nosso_numero":"26/100XXX-XIcon","seu_numero":"NF-XXX","cliente":"NOME DO CLIENTE","data_vencimento":"YYYY-MM-DD","data_pagamento":"YYYY-MM-DD","valor_titulo":numero,"valor_pago":numero,"status":"pago","canal_cobranca":"sicredi"}]

REGRAS CRÍTICAS:

1. nosso_numero — OBRIGATÓRIO. É o identificador do título no banco (Sicredi). Procure por:
   - "Nosso Número", "Nosso Nº", "NN", "Nro Título", "Documento" ou similar.
   - Formato típico Sicredi: "26/100XXX-XIcon", "26/100123-4", "100123-4" ou apenas dígitos longos (8+ caracteres).
   - Se o relatório só listar "Seu Número" + data + valor (sem Nosso Número explícito), use a coluna que identifica unicamente o boleto no banco — geralmente é um código numérico longo. NUNCA retorne vazio para nosso_numero.
   - Se realmente não houver Nosso Número, construa um identificador DETERMINÍSTICO baseado em dados do PRÓPRIO boleto: "BOL-{primeiras_8_letras_alfanum_do_cliente}-{data_pagamento}-{valor_em_centavos}" (ex: "BOL-SAOJUDAS-2026-06-01-130133"). REGRA CRÍTICA: NÃO incluir seu_numero nem nenhum dado variável no BOL — assim duas importações do mesmo boleto geram o MESMO nosso_numero, garantindo deduplicação natural.

2. seu_numero — REFERÊNCIA À NF DE ORIGEM (campo crítico para conciliação). Procure ATIVAMENTE em TODOS os campos do boleto (descrição, histórico, sacado, observações, "Documento", "Referência") por padrões "NF-XXX", "NF XXX", "NFE-XXX", "CI-XXXXXX". Se encontrar, preencha como "NF-XXX" ou "CI-XXXXXX". Esse campo é OBRIGATÓRIO sempre que houver qualquer indício de número de nota fiscal — sem ele, o título não consegue ser conciliado com o relatório de vendas. Deixe vazio APENAS se realmente não houver nenhuma referência a NF/CI no boleto.

3. cliente — nome do sacado/pagador exatamente como aparece no relatório.

4. data_vencimento e data_pagamento — formato YYYY-MM-DD. Se só houver uma data, use a mesma para ambas.

5. valor_titulo — valor original do boleto (use valor_pago se valor_titulo não estiver explícito).
   valor_pago — valor efetivamente recebido.
   Formato decimal com PONTO: "3.850,00" → 3850.00.

6. status — "pago" para todos os boletos liquidados (este relatório lista apenas pagos).

7. canal_cobranca — "sicredi" (padrão para este tipo de relatório).

8. EXTRAIA TODOS os boletos do relatório, sem exceção. Conte antes e depois.`,

  relatorio_nfs: `Analise este relatório/XML/PDF de notas fiscais emitidas (sistema fiscal, SEFAZ ou contabilidade) e extraia TODAS as NFs em JSON.
Retorne APENAS array JSON:
[{"numero":"77","tipo":"NF","data_emissao":"YYYY-MM-DD","cliente":"NOME COMPLETO DO CLIENTE","valor_total":numero,"vendedor":"Thais ou Tiago ou Fat.Direto","status":"pago","valor_recebido":numero,"valor_aberto":numero}]`,

  relatorio_vendas: `Analise este relatório de vendas do mês (sistema Fabris/Ellitte ou planilha de vendas) e extraia o resumo mensal em JSON.
Retorne APENAS um objeto JSON:
{"mes":"YYYY-MM","ano":YYYY,"mes_nome":"Março 2026","saidas":numero_vendas_tiago,"servicos":numero_vendas_thais,"outros":numero_fat_direto,"total":numero_total_geral,"fonte":"fabris","observacoes":"observacao opcional"}
Onde: saidas=vendas Tiago (V-01), servicos=vendas Thais (V-05), outros=faturamento direto, total=soma geral.`,

  relatorio_vendas_detalhado: `Você é um sistema de extração do RELATÓRIO DE VENDAS DIÁRIO (NeuralTec — sistema Fabris/Ellitte).
O relatório lista NOTAS FISCAIS (NF-XXX) e CONTRATOS DE INTERMEDIAÇÃO (CI-XXXXXX), com suas PARCELAS de cobrança.

CABEÇALHO DO RELATÓRIO contém o período: "Período: DD/MM/AAAA até DD/MM/AAAA".

ESTRUTURA — duas variantes:
A) Linha de cabeçalho (NF ou CI): "NF- 180   6.040,00   22855 - SEPE GERACAO DE ENERGIA LTDA   95 - TIAGO - V 01"
   ou: "CI- 100084  2.799,00  22791 - INC INDUSTRIA NAVAL CATARINENSE  8 - THAIS -V-05"
B) Linhas de parcelas indentadas: "180/1   3.020,00   21   27/04/2026   SICREDI   27/04/2026   3.020,00"

COLUNAS: DP (nº doc ou parcela) | Valor | Prazo Dias | Venc. | Tipo Cobran. | Pagto. (data) | Valor Pago

Retorne APENAS um objeto JSON válido com DUAS LISTAS:
{
  "notas":[
    {"numero":"180","tipo":"NF","data_emissao":"2026-04-06","cliente":"SEPE GERACAO DE ENERGIA LTDA","vendedor":"Tiago","valor_total":6040.00,"valor_recebido":3020.00,"valor_aberto":3020.00,"status":"parcial","canal_cobranca":"sicredi","data_vencimento_proxima":"2026-05-18"}
  ],
  "cobrancas":[
    {"nosso_numero":"180/1","seu_numero":"NF-180","cliente":"SEPE GERACAO DE ENERGIA LTDA","data_vencimento":"2026-04-27","data_pagamento":"2026-04-27","valor_titulo":3020.00,"valor_pago":3020.00,"status":"pago","canal_cobranca":"sicredi","parcela_numero":1,"parcela_total":2},
    {"nosso_numero":"180/2","seu_numero":"NF-180","cliente":"SEPE GERACAO DE ENERGIA LTDA","data_vencimento":"2026-05-18","valor_titulo":3020.00,"valor_pago":0,"status":"em_aberto","canal_cobranca":"sicredi","parcela_numero":2,"parcela_total":2}
  ]
}

REGRAS CRÍTICAS:

1. EXTRAIA ABSOLUTAMENTE TODOS OS DOCUMENTOS — TODAS as NFs e TODOS os CIs do relatório, sem exceção. Conte antes e depois para garantir.

2. TIPO DO DOCUMENTO:
   - "NF- XXX" → tipo="NF", numero="XXX" (ex: "180")
   - "CI- XXXXXX" → tipo="CI", numero="XXXXXX" (ex: "100084")

3. VENDEDOR — identifique pelo final do cabeçalho:
   - "95 - TIAGO" ou "V 01" ou "V-01" → "Tiago"
   - "8 - THAIS" ou "V-05" ou "V 05" → "Thais"
   - "1306 - MATHEUS" → "Matheus"
   - "138 - BALCAO" → "Balcao"
   - "2 - FATURAMENTO DIRETO" ou "FAT.DIRETO" → "Fat.Direto"
   - Se não conseguir identificar, use "Fat.Direto".

4. CLIENTE — extraia APENAS o nome após "código - ". 
   ATENÇÃO À QUEBRA DE LINHA: às vezes o nome do cliente fica grudado no código do vendedor (ex: "PORTONAVE TERMINAIS PORTUÁRIOS DE NAVEGANTE8 - THAIS -V-05\nS SA" → cliente real é "PORTONAVE TERMINAIS PORTUÁRIOS DE NAVEGANTES SA"). Reconstrua o nome juntando as quebras quando o nome do cliente continua na linha seguinte.
   Casos especiais: "1 - VENDA A VISTA" → cliente="VENDA A VISTA".

5. CANAL DE COBRANÇA (campo "Tipo Cobran." de cada parcela) — SEMPRE minúsculas:
   - "SICREDI" → "sicredi"
   - "CARTEIRA" → "carteira"
   - "MAGALU" → "magalu"
   - VAZIO/em branco → "sicredi" (padrão quando o campo aparece vazio em parcelas com prazo)
   - Para vendas à vista (CI-100088, 100090, 100095): use "carteira".

6. DATA DE EMISSÃO da NF/CI (YYYY-MM-DD):
   - Se há prazo: data_emissao = data_vencimento_1ª_parcela − prazo_dias.
   - Exemplo: parcela 21 dias com venc 27/04/2026 → emissão 06/04/2026.
   - Se SEM prazo (venda à vista): use a data de pagamento como data_emissao, ou a data do vencimento.
   - VALIDE contra o período do cabeçalho — se sair fora, ajuste para o último dia do período.

7. PAGAMENTO DE PARCELA — REGRA CRÍTICA, LEIA COM ATENÇÃO:
   - Coluna "Pagto." PREENCHIDA + "Valor Pago" PREENCHIDO → status="pago", data_pagamento=data, valor_pago=valor.
   - Coluna "Pagto." VAZIA → valor_pago=0, OMITA o campo data_pagamento (não inclua no JSON), status conforme regra 9.
   - NUNCA invente data_pagamento. NUNCA copie data de vencimento como pagamento.

8. PARCELA SEM PRAZO/VENCIMENTO (vendas à vista — ex: NF-198/1, CI-100088/1, CI-100090/1, CI-100095/1, CI-100092/XIcon com pagto antecipado):
   - parcela_numero=1, parcela_total=1
   - Se há data de pagamento → use data_pagamento como data_vencimento E como data_pagamento, status="pago".
   - canal_cobranca="carteira".

9. STATUS DA COBRANÇA (use a DATA DE REFERÊNCIA fornecida no final deste prompt):
   - "pago" se valor_pago > 0
   - "em_aberto" se valor_pago = 0 E data_vencimento >= hoje
   - "vencido" se valor_pago = 0 E data_vencimento < hoje

10. STATUS DA NF/CI (cabeçalho):
    - "pago" se TODAS parcelas pagas (valor_recebido = valor_total, tolerância de R$ 0,02)
    - "parcial" se ≥1 paga e ≥1 não paga
    - "a_vencer" se nenhuma paga e nenhuma vencida
    - "vencido" se há ≥1 parcela vencida sem pagamento

11. CÁLCULOS DO CABEÇALHO:
    - valor_recebido = SOMA dos valor_pago das parcelas (zero se nenhuma paga)
    - valor_aberto = valor_total − valor_recebido
    - data_vencimento_proxima = MENOR data_vencimento entre parcelas NÃO pagas; se todas pagas, omita o campo.
    - canal_cobranca = canal mais frequente entre as parcelas; "sicredi" como padrão.

12. VALORES — formato decimal com PONTO, PRESERVE centavos exatos:
    - "3.020,00" → 3020.00
    - "1.301,34" → 1301.34
    - "1.301,33" → 1301.33 (NÃO arredondar para 1301.34)
    - Em parcelas desiguais (ex: 1.301,34 / 1.301,33 / 1.301,33), mantenha cada valor EXATO.

13. parcela_numero e parcela_total — extraídos de "180/1":
    - "180/1" → parcela_numero=1
    - parcela_total = quantidade de linhas indentadas para essa NF (180/1 + 180/2 → total=2; 200/1 + 200/2 + 200/3 → total=3).

14. seu_numero da cobrança = "NF-XXX" ou "CI-XXXXXX" (com hífen, conforme tipo).

15. CONFERÊNCIA FINAL: o relatório possui rodapé com totais ("Faturado", "Recebido", "Aberto"). Sua extração deve bater com esses totais (tolerância R$ 1,00). Se não bater, revise antes de retornar.

16. ⚠️ IGNORAR COMPLETAMENTE O RODAPÉ — REGRA CRÍTICA:
    Após a última linha de parcela do último documento, o PDF contém um BLOCO DE TOTAIS E RESUMOS que NÃO deve gerar registros. Identifique e PARE de extrair quando encontrar QUALQUER uma destas palavras-chave/padrões:
    - "Saldo Ant.", "Saldo Atual", "Totais", "Recebido", "Aberto", "Faturado"
    - "Notas", "C.I." (em linhas de totalização, isoladas com valores)
    - "04-Liesch", "06-NeuralTec" (linhas de resumo por empresa)
    - "Carteira", "LISTO-Credito", "SICREDI-NeuralTec" (linhas de resumo por canal de cobrança, com valores totalizados)
    - Tabela com colunas "F | J | Total de CI | Total de NF | Total"
    
    Essas linhas contêm apenas SOMATÓRIOS — não são NFs nem cobranças individuais. NÃO crie registros a partir delas.

17. ⚠️ DESCARTAR PARCELAS ÓRFÃS — REGRA CRÍTICA:
    Toda parcela (linha indentada tipo "180/1", "100084/2") DEVE ter um cabeçalho NF-XXX ou CI-XXXXXX EXPLÍCITO acima dela na mesma página ou na imediatamente anterior.
    Se encontrar uma linha que parece ser parcela mas NÃO consegue identificar com certeza o número da NF/CI pai (formato "NF- XXX" ou "CI- XXXXXX"), DESCARTE essa linha. NÃO invente número, NÃO crie cobrança sem seu_numero válido.
    Toda TituloCobranca retornada DEVE ter: nosso_numero (preenchido), seu_numero (NF-XXX ou CI-XXXXXX), cliente (não vazio), valor_titulo > 0.`,

  compras_fornecedor: `Analise este relatório de compras e extraia todos os itens em JSON.
Retorne APENAS array JSON:
[{"fornecedor":"NOME","numero_nota":"XXXXX","data_emissao":"YYYY-MM-DD","descricao_produto":"NOME DO PRODUTO","categoria_produto":"notebook ou tablet ou componente ou periferico ou software ou outro","quantidade":numero,"valor_unitario":numero,"valor_total":numero}]`,

  fatura_cartao: `Você é um sistema de extração FISCAL de fatura de cartão de crédito. PRECISÃO ABSOLUTA é mandatória.

Retorne APENAS um objeto JSON válido (sem markdown, sem texto extra):
{
  "fatura":{"mes_referencia":"YYYY-MM","data_vencimento":"YYYY-MM-DD","valor_total":numero},
  "lancamentos":[
    {"data_lancamento":"YYYY-MM-DD","estabelecimento":"TEXTO LITERAL EXATAMENTE COMO IMPRESSO","descricao":"observação adicional (parcelamento, cidade) — vazio se nenhuma","valor":numero,"parcela_numero":1,"parcela_total":1,"natureza":"empresarial ou pessoal","categoria":"outro"}
  ]
}

REGRAS CRÍTICAS — LEIA TODAS:

1. FIDELIDADE LITERAL — o campo "estabelecimento" DEVE ser copiado EXATAMENTE como impresso na fatura.
   - NÃO traduzir, NÃO normalizar, NÃO abreviar, NÃO completar, NÃO corrigir grafia, NÃO trocar maiúsculas/minúsculas.
   - Manter acentos, asteriscos, números, sufixos de cidade/UF, IDs de transação, espaços e pontuação.
   - Exemplos: "MERCPAGO*MERCADOLIVRE" permanece "MERCPAGO*MERCADOLIVRE" (NÃO virar "Mercado Livre");
     "AMZN*Mktp BR" permanece "AMZN*Mktp BR" (NÃO virar "Amazon");
     "UBER *TRIP HELP.UBER.COM" permanece tal qual.

2. UM LANÇAMENTO POR LINHA IMPRESSA — cada linha do extrato detalhado da fatura = um item no array.
   - NÃO consolidar várias linhas em uma só.
   - NÃO incluir o mesmo lançamento duas vezes. Se a mesma compra aparece em dois lugares (ex: resumo + detalhe), inclua APENAS UMA VEZ — prefira o bloco "lançamentos detalhados/transações".
   - Parcelamento: se a linha indica "PARC 03/10" ou "3/10", use parcela_numero=3 e parcela_total=10, mantendo o estabelecimento original.

3. SOMA DEVE BATER COM O TOTAL — a soma de TODOS os "valor" dos lançamentos DEVE ser igual ao "valor_total" da fatura (tolerância R$ 0,02).
   - ANTES de retornar, CALCULE a soma e CONFIRA contra o total impresso.
   - Se não bater: você esqueceu lançamentos OU duplicou alguns. REVISE até bater.
   - Estornos/créditos a favor entram com valor NEGATIVO (e somam negativamente).
   - IGNORE COMPLETAMENTE: "Pagamento da fatura anterior", "Saldo anterior", "Limite disponível", "Juros sobre saldo", linhas de resumo/totalizador, encargos de mora calculados.

4. VALOR — decimal com PONTO, preserve centavos EXATOS.
   - "1.234,56" → 1234.56 · "89,00" → 89.00
   - Despesa: valor POSITIVO · Estorno/crédito a favor: valor NEGATIVO.

5. data_lancamento — formato YYYY-MM-DD, usar a data IMPRESSA da transação (não a data de vencimento da fatura).

6. mes_referencia e data_vencimento — REGRA CRÍTICA. O "mes_referencia" é SEMPRE o mês do VENCIMENTO da fatura (não o mês dos lançamentos, não o mês de fechamento).
   PRIORIDADE de inferência:
   a) NOME DO ARQUIVO — quando o arquivo tem padrão "EMPRESA DIA-MES.pdf" (ex: "ACENTRA LIESCH 11-01.pdf" = venc. 11/01, "SICOOB KLI 22-06.pdf" = venc. 22/06), USE essa data como vencimento. O formato é SEMPRE DD-MM (dia-mês, padrão BR), NUNCA MM-DD.
   b) CABEÇALHO impresso — "FATURA MARÇO/2026" → "2026-03"; "Vencimento 11/03/2026" → data_vencimento="2026-03-11", mes_referencia="2026-03".
   c) Se só tiver o dia (ex: "Vencimento 11"), combine com o ano/mês do contexto dos lançamentos: pegue o mês MAIOR (mais recente) dos data_lancamento e some 1 mês para obter o vencimento.
   FORMATO DE DATA — TODAS as datas no PDF estão em padrão BRASILEIRO (DD/MM/AAAA). "10/03/2026" = 10 de março de 2026, NÃO 3 de outubro. "10/12" = 10 de dezembro, NÃO 12 de outubro. JAMAIS inverta.
   ANO — se o vencimento for inferido apenas do nome do arquivo (sem ano), use o ano em que esse mês cai LOGO APÓS o último data_lancamento dos lançamentos. Ex: lançamentos em dez/2025, venc. "11-01" → 2026-01-11.

7. natureza — empresarial para fornecedores B2B/hospedagem/SaaS/distribuidores; pessoal para varejo/alimentação/lazer/serviços pessoais. Em dúvida → "pessoal".

8. CONFERÊNCIA FINAL OBRIGATÓRIA antes de retornar o JSON:
   ✓ Soma dos lançamentos == valor_total (tolerância R$ 0,02)? Se não → REVISE.
   ✓ Há linhas com mesma data + mesmo estabelecimento + mesmo valor? Se sim → REMOVA as cópias duplicadas.
   ✓ Todos os estabelecimentos estão LITERAIS como impresso? Se traduziu algum → RESTAURE o texto original.`,

  obra_reforma: `Analise este comprovante de pagamento de obra/reforma e extraia em JSON.
Retorne APENAS objeto JSON:
{"data":"YYYY-MM-DD","responsavel":"NOME","valor":numero,"descricao":"descrição","fornecedor_cnpj_cpf":"CPF ou CNPJ","tipo_profissional":"serralheiro ou pedreiro ou pintor ou vidros ou eletricista ou hidraulico ou material ou outros","local_obra":"loja ou pavilhao ou terraco ou outro","forma_pagamento":"PIX ou boleto","tipo":"mao_obra ou material"}`,

  folha_pagamento: `Analise esta planilha de folha de pagamento e extraia os dados de TODOS os funcionários em JSON, capturando TODAS as colunas da planilha NA MESMA ORDEM em que aparecem.
Retorne APENAS array JSON, um objeto por funcionário, com EXATAMENTE estas chaves nesta ordem:
[{"funcionario_nome":"NOME","setor":"administracao ou vendas ou assistencia","admissao":"texto da coluna Admissão como está (ex: 19-nov ou 02.03.2020)","folha":numero,"por_fora":numero,"salarios_total":numero,"vantagem":numero,"extras":numero,"premio":numero,"comissao":numero,"salario_total":numero,"dias_trabalhados":numero,"desconto_folha":numero,"compras":numero,"vales":numero,"salario_liquido":numero,"valor_pago":numero,"saldo_a_receber":numero,"competencia":"YYYY-MM","status":"pago ou pendente","empresa":"NeuralTec"}]
Regras:
- Mapeie: coluna "Folha"→folha, "Por Fora"→por_fora, "Salários Total"→salarios_total, "Vantagem"→vantagem, "Extras"→extras, "Premio"→premio, "Comissão"→comissao, "Salário Total"→salario_total, "Dias Trab."→dias_trabalhados, "Desc. Folha"→desconto_folha, "Compras"→compras, "Vales"→vales, "LÍQUIDO"→salario_liquido, "Pago"→valor_pago, "Saldo a receber"→saldo_a_receber.
- salario_bruto = salario_total (ou salarios_total se salario_total vazio).
- Valores numéricos SEM símbolo R$, use ponto decimal. Célula vazia ou "-" = 0.
- setor: inferir do agrupamento da planilha (ADMINISTRAÇÃO, VENDAS, ASSISTÊNCIA).
- status: "pago" se a coluna Pago tiver valor; senão "pendente".
- competencia: inferir do título ex "FOLHA MÊS maio 2026" → "2026-05".
- NÃO inclua as linhas de subtotal/total geral, apenas funcionários individuais.`,

  dda_boletos: `Analise este DDA/boletos a vencer e extraia em JSON.
Retorne APENAS array JSON:
[{"data":"YYYY-MM-DD","descricao":"NOME DO BENEFICIÁRIO","valor":numero_negativo,"categoria":"fornecedor ou tributo ou financeiro ou despesa_operacional","conta_bancaria":"NeuralTec 36092-2 ou Liesch 37101-4","detalhe":"código se disponível"}]`,

  despesas_operacionais: `Analise este documento de despesas operacionais (nota fiscal, recibo, comprovante, planilha ou extrato) e extraia TODAS as despesas em JSON.
Retorne APENAS array JSON:
[{"data":"YYYY-MM-DD","descricao":"descrição da despesa","fornecedor":"nome do fornecedor ou prestador","categoria":"aluguel ou energia ou agua ou internet ou telefone ou manutencao ou limpeza ou marketing ou contabilidade ou juridico ou seguro ou transporte ou alimentacao ou material_escritorio ou outro","valor":numero_positivo,"forma_pagamento":"pix ou boleto ou cartao ou debito_automatico ou dinheiro ou transferencia","status":"pago ou pendente","empresa":"NeuralTec ou Liesch","observacoes":"observação opcional"}]
Regras: valor SEMPRE positivo. Se data de vencimento informada mas não paga = status pendente. Identificar empresa pelo contexto (NeuralTec ou Liesch).`
};

function StatusBadge({ status }) {
  const map = {
    novo: 'bg-green-100 text-green-700', duplicata: 'bg-yellow-100 text-yellow-700',
    erro: 'bg-red-100 text-red-700', completed: 'bg-green-100 text-green-700',
    processing: 'bg-blue-100 text-blue-700', failed: 'bg-red-100 text-red-700'
  };
  const labels = { novo: 'NOVO', duplicata: 'DUPLICATA', erro: 'ERRO', completed: 'Concluído', processing: 'Processando', failed: 'Falhou' };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>;
}

async function sha256OfFile(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function FieldValue({ value }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'number') return <span className="tabular-nums">{Math.abs(value) > 100 ? formatCurrency(value) : value}</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Sim' : 'Não'}</span>;
  return <span className="truncate max-w-[180px] block">{String(value)}</span>;
}

export default function ImportarDocumento() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselected = urlParams.get('tipo');

  const [selectedType, setSelectedType] = useState(preselected || null);
  const [file, setFile] = useState(null);
  const [contasCartao, setContasCartao] = useState([]);
  const [selectedCartaoId, setSelectedCartaoId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [rawText, setRawText] = useState(null);
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastImports, setLastImports] = useState({});
  const [fileUrl, setFileUrl] = useState(null);
  const [fileHash, setFileHash] = useState(null);
  const [step, setStep] = useState(1);
  const [dedupRunning, setDedupRunning] = useState(false);
  const [faturaValidacao, setFaturaValidacao] = useState(null);
  const [extratoValidacao, setExtratoValidacao] = useState(null);
  const [memoriaRefresh, setMemoriaRefresh] = useState(0);
  const fileInputRef = useRef();
  const queryClient = useQueryClient();

  async function handleDedupManual() {
    if (dedupRunning) return;
    setDedupRunning(true);
    try {
      const res = await deduplicarImportacoes({});
      const total = res?.data?.total || 0;
      showToast(total > 0 ? `🧹 ${total} duplicatas removidas do banco` : 'Nenhuma duplicata encontrada — banco limpo!', 'success');
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (err) {
      showToast(`Erro ao deduplicar: ${err.message}`, 'error');
    }
    setDedupRunning(false);
  }

  useEffect(() => {
    loadHistory();
    loadCartoes();
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) handleFileSelect(new File([f], `print_${Date.now()}.png`, { type: f.type }));
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []); // eslint-disable-line

  async function loadCartoes() {
    const cartoes = await base44.entities.ContaCartao.filter({ is_ativo: true });
    setContasCartao(cartoes);
  }

  async function loadHistory() {
    const batches = await base44.entities.ImportBatch.list('-created_date', 100);
    setHistory(batches.slice(0, 20));
    // Última importação por tipo
    const map = {};
    batches.forEach((b) => {
      if (!map[b.batch_type] && b.status === 'completed') map[b.batch_type] = b;
    });
    setLastImports(map);
    setLoadingHistory(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  function handleFileSelect(f) {
    if (!f) return;
    setFile(f);
    setStep(Math.max(step, 2));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function processWithAI() {
    if (!selectedType || !file) return showToast('Selecione o tipo de documento e faça upload do arquivo.', 'error');
    // selectedCartaoId é opcional para fatura_cartao — a IA tentará identificar automaticamente
    setProcessing(true);
    setProcessingStage('hash');
    setRecords([]);
    setRawText(null);
    setFileUrl(null);
    setFaturaValidacao(null);
    setExtratoValidacao(null);
    try {
      // 0. Calcular hash SHA-256 do arquivo (cache exato)
      const hashCalculado = await sha256OfFile(file);
      console.log('[CACHE] Hash do arquivo:', hashCalculado.substring(0, 16) + '...', 'tipo:', selectedType);

      // 0.1 Buscar extração anterior — busca AMPLA (todos batches concluídos do mesmo tipo) para garantir match
      let rawStr = null;
      let cachedFileUrl = null;
      let cacheSource = null;

      const todosBatchesDoTipo = await base44.entities.ImportBatch.filter({
        batch_type: selectedType,
        status: 'completed'
      });
      console.log('[CACHE] Batches anteriores deste tipo:', todosBatchesDoTipo?.length || 0);

      // Match 1: hash idêntico (mesmo arquivo byte-a-byte)
      let hitBatch = todosBatchesDoTipo?.find((b) => b.file_hash === hashCalculado && b.ai_extraction);
      if (hitBatch) {cacheSource = 'hash-exato';console.log('[CACHE] ✓ HIT por hash exato — batch:', hitBatch.id);}

      // Match 2: mesmo nome de arquivo
      if (!hitBatch && file?.name) {
        const nomeAlvo = file.name.toLowerCase().trim();
        hitBatch = todosBatchesDoTipo?.find((b) => {
          if (!b.ai_extraction || !b.file_name) return false;
          if (b.file_name.toLowerCase().trim() !== nomeAlvo) return false;
          if (b.file_hash && b.file_hash !== hashCalculado) return false;
          return true;
        });
        if (hitBatch) {cacheSource = 'nome-arquivo';console.log('[CACHE] ✓ HIT por nome de arquivo — batch:', hitBatch.id);}
      }

      if (hitBatch) {
        // ai_extraction pode ser: (a) o JSON inline (legado) ou (b) uma URL para o JSON salvo no storage
        const ext = hitBatch.ai_extraction;
        if (ext.startsWith('http')) {
          // Baixa o JSON salvo no storage
          try {
            const resp = await fetch(ext);
            rawStr = await resp.text();
          } catch (e) {
            console.warn('[CACHE] Falha ao baixar extração do storage, vai reprocessar:', e);
          }
        } else {
          rawStr = ext;
        }
        if (rawStr) {
          try {
            const parsed = JSON.parse(hitBatch.notes || '{}');
            cachedFileUrl = parsed.file_url || (hitBatch.notes?.startsWith('http') ? hitBatch.notes : null);
          } catch {
            cachedFileUrl = hitBatch.notes?.startsWith('http') ? hitBatch.notes : null;
          }
          showToast(`✓ Cache acionado (${cacheSource}) — reusando extração anterior sem chamar IA.`, 'success');
          if (cachedFileUrl) setFileUrl(cachedFileUrl);
        }
      }

      if (!rawStr) {
        console.log('[CACHE] ✗ MISS — nenhum batch anterior com mesmo arquivo. Processando com IA...');
        // 1. Upload via integração nativa Base44
        setProcessingStage('upload');
        const { file_url } = await UploadFile({ file });
        setFileUrl(file_url);
        setProcessingStage('ai');

        // 2. Extrair com InvokeLLM nativo Base44 — injeta data atual no prompt
        const hojeISO = new Date().toISOString().split('T')[0];
        const promptComContexto = PROMPTS[selectedType].replace(/\{\{HOJE\}\}/g, hojeISO) +
        `\n\nDATA DE REFERÊNCIA (hoje): ${hojeISO}` +
        `\nNOME DO ARQUIVO ENVIADO: "${file.name}"  ← USE como pista (padrão "EMPRESA DD-MM.pdf" = dia-mês BR, ex: "11-01" = 11 de janeiro)`;
        // Modelo: relatorio_vendas_detalhado exige raciocínio robusto (17 regras + cabeçalho+parcelas)
        // → usa claude_sonnet_4_6. Demais tipos usam gemini_3_flash (rápido e barato).
        const modeloIA = selectedType === 'relatorio_vendas_detalhado' || selectedType === 'fatura_cartao' ? 'claude_sonnet_4_6' : 'gemini_3_flash';
        const result = await InvokeLLM({
          prompt: promptComContexto,
          file_urls: [file_url],
          model: modeloIA
        });

        rawStr = typeof result === 'string' ? result.trim() : JSON.stringify(result);
      }
      setFileHash(hashCalculado);
      setRawText(rawStr);

      // 3. Parse robusto
      let parsed;
      const clean = rawStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        parsed = JSON.parse(clean);
      } catch {
        const match = clean.match(/[\[{][\s\S]*[\]|}]/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (!parsed) {
        setProcessing(false);
        return showToast('IA retornou texto não estruturado. Verifique o resultado bruto.', 'error');
      }

      // 4. Normalizar para array de itens
      let items;
      if (selectedType === 'fatura_cartao') {
        // Auto-identificação do cartão se nenhum foi selecionado
        let cartaoIdFinal = selectedCartaoId;
        if (!cartaoIdFinal && parsed.fatura) {
          const fatTitular = (parsed.fatura.titular || parsed.fatura.portador || parsed.fatura.nome_cartao || '').toLowerCase();
          const fatBandeira = (parsed.fatura.bandeira || parsed.fatura.operadora || '').toLowerCase();
          const match = contasCartao.find((c) => {
            const titular = (c.titular || '').toLowerCase();
            const bandeira = (c.bandeira || '').toLowerCase();
            const nomePartes = c.nome.toLowerCase().split('—').map((p) => p.trim());
            if (fatTitular && titular && fatTitular.split(' ').some((w) => w.length > 3 && titular.includes(w))) return true;
            if (fatBandeira && bandeira && fatBandeira.includes(bandeira)) return true;
            if (fatTitular && nomePartes.some((p) => fatTitular.includes(p) || p.split(' ').some((w) => w.length > 3 && fatTitular.includes(w)))) return true;
            return false;
          });
          if (match) {
            cartaoIdFinal = match.id;
            setSelectedCartaoId(match.id);
            showToast(`✓ Cartão identificado automaticamente: ${match.nome}`, 'success');
          }
        }
        const fatData = { ...parsed.fatura, __type: 'FaturaCartao', conta_cartao_id: cartaoIdFinal };
        const lancsRaw = (parsed.lancamentos || []).map((l) => ({ ...l, __type: 'LancamentoCartao' }));

        // Fidelidade: remove duplicatas internas da própria fatura (mesma data + estabelecimento normalizado + valor)
        const seenInternal = new Set();
        let dupsInternas = 0;
        const lancs = [];
        for (const l of lancsRaw) {
          const norm = (l.estabelecimento || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
          const key = `${l.data_lancamento}|${norm}|${Math.round((l.valor || 0) * 100)}`;
          if (seenInternal.has(key)) {dupsInternas++;continue;}
          seenInternal.add(key);
          lancs.push(l);
        }

        // Conferência fiscal: soma dos lançamentos deve bater com o valor_total impresso
        const totalFat = Number(parsed.fatura?.valor_total || 0);
        const somaLancs = lancs.reduce((s, l) => s + Number(l.valor || 0), 0);
        const diffSoma = Math.abs(totalFat - somaLancs);
        const somaIaInformada = Number(parsed.fatura?.soma_lancamentos || 0);
        const totalIaInformado = Number(parsed.fatura?.total_lancamentos_pdf || 0);

        setFaturaValidacao({
          totalFat,
          somaLancs,
          diffSoma,
          qtdLancs: lancs.length,
          qtdLancsIa: totalIaInformado,
          somaIaInformada,
          dupsInternas,
          ok: diffSoma <= 0.02
        });

        if (diffSoma > 0.02 || dupsInternas > 0) {
          const msgs = [];
          if (diffSoma > 0.02) msgs.push(`⚠️ Soma ${formatCurrency(somaLancs)} ≠ total impresso ${formatCurrency(totalFat)} (dif. ${formatCurrency(diffSoma)})`);
          if (dupsInternas > 0) msgs.push(`🧹 ${dupsInternas} duplicata(s) interna(s) removida(s)`);
          showToast(msgs.join(' · '), diffSoma > 0.02 ? 'error' : 'success');
        }

        items = [fatData, ...lancs];
      } else if (selectedType === 'relatorio_vendas_detalhado') {
        // Caso especial: 2 entidades — NotaFiscal + TituloCobranca
        const notas = (parsed.notas || []).map((n) => ({
          ...n,
          numero: String(n.numero ?? '').trim(),
          __type: 'NotaFiscal'
        }));
        const cobrancas = (parsed.cobrancas || []).map((c) => ({
          ...c,
          nosso_numero: String(c.nosso_numero ?? '').trim(),
          __type: 'TituloCobranca'
        }));
        items = [...notas, ...cobrancas];
      } else {
        items = Array.isArray(parsed) ? parsed : [parsed];
      }

      if (selectedType === 'relatorio_nfs') items = items.map((i) => ({ ...i, numero: String(i.numero ?? '').trim() }));
      if (selectedType === 'boletos_liquidados') items = items.map((i) => ({ ...i, nosso_numero: String(i.nosso_numero ?? '').trim() }));
      if (selectedType === 'extrato_bancario') {
        const validation = validateExtratoRecords(items, new Date().toISOString().split('T')[0]);
        items = validation.records;
        setExtratoValidacao(validation);
      }

      // 5. Deduplicação via motor genérico
      const typeConfig = DOC_TYPES.find((d) => d.id === selectedType);
      let enriched = [];

      if (selectedType === 'fatura_cartao') {
        // Caso especial: 2 tipos de entidade — deduplicar em paralelo
        const fats = items.filter((i) => i.__type === 'FaturaCartao');
        const lancs = items.filter((i) => i.__type === 'LancamentoCartao');

        const [dedupFats, dedupLancs] = await Promise.all([
        deduplicateRecords(fats, 'FaturaCartao'),
        deduplicateRecords(lancs, 'LancamentoCartao')]
        );

        enriched = [...dedupFats, ...dedupLancs];
      } else if (selectedType === 'relatorio_vendas_detalhado') {
        // Caso especial: 2 entidades — NotaFiscal + TituloCobranca
        const notas = items.filter((i) => i.__type === 'NotaFiscal');
        const cobs = items.filter((i) => i.__type === 'TituloCobranca');

        const [dedupNotas, dedupCobs] = await Promise.all([
        deduplicateRecords(notas, 'NotaFiscal'),
        deduplicateRecords(cobs, 'TituloCobranca')]
        );

        enriched = [...dedupNotas, ...dedupCobs];
      } else {
        // Caso genérico: aplica deduplicação via motor
        enriched = await deduplicateRecords(items, typeConfig.entity);
      }

      // Aplica regras de categoria aprendidas do histórico — resolve localmente
      // o que a IA já "errou" no passado e foi corrigido manualmente (economiza IA).
      const escopoRegras = selectedType === 'fatura_cartao' ? 'cartao' :
      selectedType === 'extrato_bancario' ? 'extrato' : null;
      if (escopoRegras) {
        try {
          const res = await aplicarRegrasHistorico({ escopo: escopoRegras, records: enriched });
          enriched = res.records;
          if (res.aplicados > 0) {
            showToast(`🧠 ${res.aplicados} lançamento(s) categorizados pelo histórico — sem precisar de IA.`, 'success');
          }
        } catch {/* histórico é auxiliar — nunca bloqueia */}
      }

      setRecords(enriched);
      setStep(3);
    } catch (err) {
      const msg = String(err?.message || err);
      const isPdfProtegido = /password protected|password.protected|encrypted pdf|criptografad/i.test(msg);
      if (isPdfProtegido) {
        setRawText(
          '⚠️ PDF PROTEGIDO POR SENHA\n\n' +
          'O arquivo enviado está criptografado e não pode ser lido pela IA.\n\n' +
          'Como resolver:\n' +
          '1) Abra o PDF no navegador (Chrome/Edge) ou Adobe Reader com a senha.\n' +
          '2) Use "Imprimir → Salvar como PDF" para gerar uma cópia SEM senha.\n' +
          '3) Faça upload da cópia sem senha aqui.\n\n' +
          'Alternativa: tire prints (PNG/JPG) das páginas da fatura e envie as imagens — a IA também extrai a partir delas.'
        );
        showToast('PDF protegido por senha. Veja as instruções abaixo para remover a senha.', 'error');
      } else {
        showToast(`Erro ao processar: ${msg}`, 'error');
      }
    }
    setProcessing(false);
  }

  async function confirmSave() {
    if (selectedType === 'extrato_bancario' && extratoValidacao && !extratoValidacao.ok) {
      return showToast('A sequência de saldos não bate. Corrija a extração antes de salvar.', 'error');
    }
    // Respeita seleção explícita do usuário — se marcou um registro com status 'erro',
    // ele será salvo mesmo assim (usuário viu que os dados estão corretos)
    const toSave = records.filter((r) => r.selected);
    if (toSave.length === 0) return showToast('Nenhum registro selecionado para salvar.', 'error');
    setSaving(true);
    try {
      const typeConfig = DOC_TYPES.find((d) => d.id === selectedType);
      let saved = 0,errors = 0;

      // Usar motor de deduplicação para salvar
      if (selectedType === 'fatura_cartao') {
        // Pegar fatura independente de estar selecionada — lançamentos dependem do ID dela
        const faturaRec = records.find((r) => r.data.__type === 'FaturaCartao');
        const lancRecs = records.filter((r) => r.data.__type === 'LancamentoCartao' && r.selected && r.status !== 'erro');

        let faturaId = null;

        if (faturaRec) {
          const { __type, ...fatData } = faturaRec.data;

          if (faturaRec.status === 'duplicata') {
            // Fatura já existe — buscar no banco. Tentar por conta_cartao_id+mês, ou só pelo mês se sem cartão
            let ex = [];
            if (fatData.conta_cartao_id) {
              ex = await base44.entities.FaturaCartao.filter({
                conta_cartao_id: fatData.conta_cartao_id,
                mes_referencia: fatData.mes_referencia
              });
            }
            if (!ex?.length && fatData.mes_referencia) {
              // Fallback: buscar todas do mês e cruzar por valor_total
              const todas = await base44.entities.FaturaCartao.filter({ mes_referencia: fatData.mes_referencia });
              ex = todas.filter((f) => Math.abs(f.valor_total - fatData.valor_total) < 1);
            }
            faturaId = ex?.[0]?.id || null;
            if (faturaId) saved++;
          } else if (faturaRec.selected) {
            // Criar fatura nova
            const createdFatura = await base44.entities.FaturaCartao.create({ ...fatData, status: fatData.status || 'aberta', valor_pago: fatData.valor_pago ?? 0 });
            faturaId = createdFatura?.id || null;
            if (faturaId) saved++;else
            errors++;
          }
        }

        if (faturaId) {
          // Dedup contra o banco — usa a MESMA normalização do prompt/deduplicarCartoes
          // (data + estabelecimento normalizado + valor em centavos) para impedir reimportação duplicar
          const existentes = await base44.entities.LancamentoCartao.filter({ fatura_id: faturaId });
          const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
          const chavesExistentes = new Set(
            (existentes || []).map((e) => `${e.data_lancamento}|${norm(e.estabelecimento)}|${Math.round((e.valor || 0) * 100)}`)
          );
          let pulados = 0;
          for (let i = 0; i < lancRecs.length; i++) {
            setSaveProgress(`Salvando lançamento ${i + 1} de ${lancRecs.length}...`);
            const { __type, ...lancData } = lancRecs[i].data;
            const chave = `${lancData.data_lancamento}|${norm(lancData.estabelecimento)}|${Math.round((lancData.valor || 0) * 100)}`;
            if (chavesExistentes.has(chave)) {pulados++;continue;}
            chavesExistentes.add(chave);
            await base44.entities.LancamentoCartao.create({ ...lancData, fatura_id: faturaId });
            saved++;
          }
          if (pulados > 0) {
            console.log(`[FaturaCartao] ${pulados} lançamento(s) já existentes na fatura — pulados.`);
          }
        } else if (lancRecs.length > 0) {
          showToast('⚠️ Selecione um cartão no calendário — não foi possível identificar a fatura para vincular os lançamentos.', 'error');
        }
      } else if (selectedType === 'relatorio_vendas_detalhado') {
        // Salvar NotaFiscal + TituloCobranca em paralelo (motor genérico, mas separado por __type)
        const notasToSave = records.filter((r) => r.selected && r.status !== 'erro' && r.data.__type === 'NotaFiscal').
        map((r) => ({ ...r, data: { ...r.data, __type: undefined } }));
        const cobsToSave = records.filter((r) => r.selected && r.status !== 'erro' && r.data.__type === 'TituloCobranca').
        map((r) => ({ ...r, data: { ...r.data, __type: undefined } }));

        // Remover __type antes de salvar
        notasToSave.forEach((r) => delete r.data.__type);
        cobsToSave.forEach((r) => delete r.data.__type);

        setSaveProgress(`Salvando ${notasToSave.length} notas + ${cobsToSave.length} cobranças...`);
        const [statsN, statsC] = await Promise.all([
        saveDeduplicatedRecords('NotaFiscal', notasToSave),
        saveDeduplicatedRecords('TituloCobranca', cobsToSave)]
        );
        saved = statsN.saved + statsC.saved;
        errors = statsN.errors + statsC.errors;
      } else {
        // Caso genérico: usar motor genérico
        const stats = await saveDeduplicatedRecords(typeConfig.entity, toSave);
        saved = stats.saved;
        errors = stats.errors;
      }

      const dupes = records.filter((r) => r.status === 'duplicata').length;

      // Salvar metadados extras no notes como JSON conforme tipo
      let notesValue = fileUrl || '';
      if (selectedType === 'folha_pagamento') {
        const competencias = [...new Set(
          records.filter((r) => r.data.competencia).map((r) => r.data.competencia)
        )];
        notesValue = JSON.stringify({
          file_url: fileUrl || '',
          competencias,
          competencia: competencias[0] || null
        });
      } else if (selectedType === 'fatura_cartao') {
        const faturaRec2 = records.find((r) => r.data.__type === 'FaturaCartao');
        const cartaoInfo = contasCartao.find((c) => c.id === (faturaRec2?.data?.conta_cartao_id || selectedCartaoId));
        notesValue = JSON.stringify({
          file_url: fileUrl || '',
          valor_total: faturaRec2?.data?.valor_total || null,
          data_vencimento: faturaRec2?.data?.data_vencimento || null,
          nome_cartao: cartaoInfo?.nome || null,
          bandeira: cartaoInfo?.bandeira || null,
          dia_vencimento: cartaoInfo?.dia_vencimento || null
        });
      }

      // Salvar extração da IA como arquivo no storage (evita estourar limite do campo)
      let aiExtractionUrl = '';
      if (rawText) {
        try {
          const jsonBlob = new Blob([rawText], { type: 'application/json' });
          const jsonFile = new File([jsonBlob], `extracao_${selectedType}_${Date.now()}.json`, { type: 'application/json' });
          const { file_url: jsonUrl } = await UploadFile({ file: jsonFile });
          aiExtractionUrl = jsonUrl;
        } catch (e) {
          console.warn('Falha ao salvar extração no storage:', e);
        }
      }

      await base44.entities.ImportBatch.create({
        title: `${typeConfig?.label} — ${file?.name || 'arquivo'}`,
        batch_type: selectedType,
        file_name: file?.name || '',
        file_hash: fileHash || '',
        ai_extraction: aiExtractionUrl,
        total_records: records.length,
        success_count: saved,
        duplicate_count: dupes,
        error_count: errors,
        status: errors === records.length ? 'failed' : 'completed',
        notes: notesValue
      });

      // Memória de aprendizado: registra se a importação saiu "redonda"
      // (sem erros e com registros salvos). Ao atingir o limite, libera o aval.
      try {
        const typeLabel = DOC_TYPES.find((d) => d.id === selectedType)?.label || selectedType;
        const redonda = errors === 0 && saved > 0;
        const user = await base44.auth.me().catch(() => null);
        await registrarResultado(selectedType, typeLabel, {
          redonda,
          assinatura: assinaturaDeRegistros(records),
          user
        });
        setMemoriaRefresh((k) => k + 1);
      } catch {/* memória é auxiliar — nunca bloqueia o salvamento */}

      // Deduplicação automática pós-salvamento — varre TODAS as entidades do sistema
      setSaveProgress('Verificando duplicatas em todo o sistema...');
      let removidos = 0;
      try {
        const dedupRes = await deduplicarImportacoes({});
        removidos = dedupRes?.data?.total || 0;
      } catch {/* falha silenciosa — importação já foi salva */}

      // Conciliação NF ↔ Títulos Sicredi — após importar relatório do Elite ou boletos liquidados
      let nfsConciliadas = 0;
      let titulosVinc = 0;
      if (selectedType === 'relatorio_vendas_detalhado' || selectedType === 'boletos_liquidados') {
        setSaveProgress('Conciliando NFs × títulos Sicredi...');
        try {
          const conc = await conciliarNFsTitulosSicredi({});
          nfsConciliadas = conc?.data?.notas_atualizadas || 0;
          titulosVinc = conc?.data?.titulos_vinculados || 0;
        } catch {/* falha silenciosa */}
      }

      setSaving(false);
      setSaveProgress('');
      setStep(4);
      const dedupMsg = removidos > 0 ? ` · 🧹 ${removidos} duplicatas removidas do banco` : '';
      const concMsg = nfsConciliadas > 0 || titulosVinc > 0 ? ` · 🔗 ${nfsConciliadas} NF(s) conciliadas com ${titulosVinc} título(s) Sicredi` : '';
      showToast(`✓ ${saved} novos registros salvos · ${dupes} ignoradas na importação${dedupMsg}${concMsg}`);
      loadHistory();
      window.dispatchEvent(new Event('neuralfinRefresh'));
      localStorage.setItem('neuralfinPendingRefresh', Date.now().toString());
    } catch (err) {
      setSaving(false);
      setSaveProgress('');
      showToast(`Erro ao salvar: ${err.message}`, 'error');
    }
  }

  function reset() {
    setSelectedType(preselected || null);
    setFile(null);
    setFileUrl(null);
    setFileHash(null);
    setRecords([]);setRawText(null);setStep(1);
    setFaturaValidacao(null);
    setExtratoValidacao(null);
  }

  const selectedCount = records.filter((r) => r.selected).length;
  const dupeCount = records.filter((r) => r.status === 'duplicata').length;

  // Ordem oficial das colunas da folha de pagamento (segue a planilha original)
  const FOLHA_COL_ORDER = [
  'funcionario_nome', 'setor', 'admissao', 'folha', 'por_fora', 'salarios_total',
  'vantagem', 'extras', 'premio', 'comissao', 'salario_total', 'dias_trabalhados',
  'desconto_folha', 'compras', 'vales', 'salario_liquido', 'valor_pago',
  'saldo_a_receber', 'competencia', 'status', 'empresa'];


  const allKeys = records.length > 0 ?
  [...new Set(records.flatMap((r) => Object.keys(r.data)))].filter((k) => k !== '__type') :
  [];

  const isFolha = selectedType === 'folha_pagamento';
  const recordKeys = records.length === 0 ? [] :
  isFolha
  // Folha: mantém a ordem da planilha e mostra TODAS as colunas presentes
  ? [...FOLHA_COL_ORDER.filter((k) => allKeys.includes(k)), ...allKeys.filter((k) => !FOLHA_COL_ORDER.includes(k))] :
  allKeys.slice(0, 9);

  // Totais brutos e líquidos (folha) — somente registros selecionados
  const folhaTotais = isFolha ? records.reduce((acc, r) => {
    if (!r.selected) return acc;
    acc.bruto += Number(r.data.salario_total ?? r.data.salarios_total ?? r.data.salario_bruto ?? 0) || 0;
    acc.liquido += Number(r.data.salario_liquido ?? 0) || 0;
    acc.pago += Number(r.data.valor_pago ?? 0) || 0;
    return acc;
  }, { bruto: 0, liquido: 0, pago: 0 }) : null;

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Importar Documento" subtitle="Extração de dados financeiros com IA · deduplicação automática">
        <Button variant="outline" size="sm" onClick={handleDedupManual} disabled={dedupRunning} className="gap-2">
          {dedupRunning ?
          <><div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Limpando…</> :

          <><Trash2 className="w-3.5 h-3.5" /> Limpar duplicatas</>
          }
        </Button>
      </PageHeader>

      {toast &&
      <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)}><XIcon className="w-4 h-4" /></button>
        </div>
      }

      {/* Steps + Upload compacto ao lado */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1">
          {['Selecionar tipo', 'Fazer upload', 'Revisar dados', 'Concluído'].map((s, i) =>
          <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all ${step > i + 1 ? 'bg-gradient-to-br from-violet-600 to-indigo-600' : step === i + 1 ? 'bg-gradient-to-br from-fuchsia-600 to-indigo-600 ring-4 ring-violet-200 shadow-md' : 'bg-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${step === i + 1 ? 'text-foreground' : step > i + 1 ? 'text-violet-700' : 'text-muted-foreground'}`}>{s}</span>
              {i < 3 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-gradient-to-r from-violet-500 to-indigo-500' : 'bg-border'}`} />}
            </div>
          )}
        </div>

        {step !== 4 &&
        <div
          onDragOver={(e) => {e.preventDefault();setDragging(true);}}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-all py-2 px-3 flex items-center gap-2 shrink-0 w-full lg:w-[260px] ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.ofx,.qfx,.txt" className="hidden"
          onChange={(e) => handleFileSelect(e.target.files[0])} />
            {file ?
          <>
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <span className="text-xs font-semibold truncate flex-1 text-left">{file.name}</span>
              <button onClick={(e) => {e.stopPropagation();setFile(null);}} className="text-red-500 shrink-0"><XIcon className="w-4 h-4" /></button>
            </> :
          <>
              <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-semibold text-foreground text-left leading-tight">Arraste o arquivo aqui<span className="block text-[10px] text-muted-foreground font-normal">PDF, PNG, JPG, XLSX, CSV, OFX</span></span>
            </>
          }
          </div>
        }
      </div>

      {step === 4 ?
      <div className="text-center py-16">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Importação Concluída!</h2>
          <p className="text-muted-foreground mb-6">Os registros foram salvos com sucesso.</p>
          <Button onClick={reset}>Nova Importação</Button>
        </div> :

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 mb-8">
          {/* Tipo de documento */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">1. Tipo de Documento</h2>
            <div className="space-y-4">
              {DOC_GROUPS.map((groupLabel) => {
              const groupTypes = DOC_TYPES.filter((dt) => dt.group === groupLabel);
              if (groupTypes.length === 0) return null;
              return (
                <div key={groupLabel}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-1">{groupLabel}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {groupTypes.map((dt) => {
                      const isActive = selectedType === dt.id;
                      const colors = COLOR_MAP[dt.color];
                      return (
                        <button key={dt.id} onClick={() => {setSelectedType(dt.id);setStep(Math.max(step, 1));}}
                        className={`flex items-center gap-3 rounded-xl border text-left transition-all pr-1 pl-1 ${isActive ? colors.active : `${colors.card} hover:shadow-sm`}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors.icon}`}>
                              <dt.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-semibold block ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>{dt.label}</span>
                              {lastImports[dt.id] ?
                            <span className="text-[10px] text-muted-foreground block truncate">
                                  {new Date(lastImports[dt.id].created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} · {lastImports[dt.id].created_by?.split('@')[0] || '—'} · {lastImports[dt.id].success_count ?? 0} registros
                                </span> :

                            <span className="text-[10px] text-muted-foreground/50 block">Nunca importado</span>
                            }
                            </div>
                            {isActive && <span className="ml-auto text-primary text-xs font-bold shrink-0">✓</span>}
                          </button>);

                    })}
                    </div>
                  </div>);

            })}
            </div>
          </div>

          {/* Upload + Calendário + Histórico */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">2. Arquivo</h2>

            <PainelMemoriaImportacao
            tipoImport={selectedType}
            label={DOC_TYPES.find((d) => d.id === selectedType)?.label}
            refreshKey={memoriaRefresh} />
          

            {selectedType === 'fatura_cartao' &&
          <div className="mb-4">
                {/* Calendário visual de vencimentos */}
                <div className="bg-muted/30 rounded-xl border p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Calendário de Vencimentos — clique para selecionar
                  </p>
                  <div className="flex items-start gap-3 overflow-x-auto pb-1">
                    {[...contasCartao].sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0)).map((c) => {
                  const isSelected = selectedCartaoId === c.id;
                  const lastImp = history.find((h) => h.batch_type === 'fatura_cartao' && h.status === 'completed' && (h.title || '').toLowerCase().includes(c.nome.split('—')[0].trim().toLowerCase()));
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCartaoId(isSelected ? '' : c.id)}
                      className="flex flex-col items-center gap-1 min-w-[62px] shrink-0">
                      
                          <div className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-all ${
                      isSelected ?
                      'bg-primary border-primary text-primary-foreground scale-110 shadow-md' :
                      'bg-slate-100 border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300'}`
                      }>
                            <span className="text-base font-bold leading-none">{c.dia_vencimento}</span>
                            <span className="text-[8px] font-medium">dia</span>
                          </div>
                          <p className="text-[9px] text-center text-muted-foreground leading-tight max-w-[62px] truncate font-medium">{c.nome.split('—')[0].trim()}</p>
                          {lastImp ?
                      <p className="text-[8px] text-center text-emerald-600 leading-tight max-w-[62px]">
                              {new Date(lastImp.created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {lastImp.success_count > 0 && <> · {lastImp.success_count}reg</>}
                            </p> :

                      <p className="text-[8px] text-center text-muted-foreground/40 leading-tight">nunca</p>
                      }
                        </button>);

                })}
                  </div>
                  {selectedCartaoId &&
              <p className="text-xs text-primary font-semibold mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> {contasCartao.find((c) => c.id === selectedCartaoId)?.nome}
                    </p>
              }
                  {!selectedCartaoId &&
              <p className="text-[10px] text-muted-foreground/60 mt-2 italic">Nenhum cartão selecionado — a IA tentará identificar automaticamente</p>
              }
                </div>
              </div>
          }

            {file && selectedType &&
          <Button onClick={processWithAI} disabled={processing} className="w-full mt-4 gap-2 h-11">
                {processing ?
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {processingStage === 'hash' ? 'Verificando cache...' : processingStage === 'upload' ? 'Enviando arquivo...' : 'Analisando com IA (pode levar ~30s)...'}
                  </> :
            <>✨ Processar com IA</>}
              </Button>
          }

            {rawText && records.length === 0 &&
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-800 mb-1">Resultado bruto da IA:</p>
                <pre className="text-[11px] text-yellow-900 whitespace-pre-wrap max-h-48 overflow-y-auto">{rawText}</pre>
              </div>
          }

            {/* Histórico inline — abaixo do drop zone */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Histórico de Importações</h2>
                {selectedType &&
              <span className="text-[10px] text-primary font-semibold">{DOC_TYPES.find((d) => d.id === selectedType)?.label}</span>
              }
              </div>
              <div className="bg-card rounded-xl border overflow-hidden">
                {loadingHistory ?
              <div className="p-6 text-center"><div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div> :
              (() => {
                const filtered = selectedType ? history.filter((h) => h.batch_type === selectedType) : history;
                if (filtered.length === 0) return (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                      {selectedType ? 'Nenhuma importação deste tipo ainda' : 'Nenhuma importação realizada ainda'}
                    </div>);

                return (
                  <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                       <thead>
                         <tr className="border-b bg-muted/30">
                           <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px] w-8">Img</th>
                           <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px]">Data/Hora</th>
                           {!selectedType && <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px]">Documento</th>}
                           <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px]">Arquivo</th>
                           <th className="text-right px-3 py-2 font-semibold text-muted-foreground text-[10px]">Salvos</th>
                           {selectedType === 'fatura_cartao' && <>
                             <th className="text-right px-3 py-2 font-semibold text-muted-foreground text-[10px]">Total</th>
                             <th className="text-center px-3 py-2 font-semibold text-muted-foreground text-[10px]">Vencimento</th>
                           </>}
                           {selectedType === 'folha_pagamento' &&
                          <th className="text-center px-3 py-2 font-semibold text-muted-foreground text-[10px]">Competência</th>
                          }
                           <th className="text-center px-3 py-2 font-semibold text-muted-foreground text-[10px]">Status</th>
                         </tr>
                       </thead>
                       <tbody>
                         {filtered.map((h) => {
                          const dt = DOC_TYPES.find((d) => d.id === h.batch_type);
                          // Parse notes: pode ser JSON (fatura_cartao) ou URL direta
                          let notesData = null;
                          let imgUrl = null;
                          if (h.notes) {
                            try {
                              notesData = JSON.parse(h.notes);
                              imgUrl = notesData.file_url && notesData.file_url.startsWith('http') ? notesData.file_url : null;
                            } catch {
                              imgUrl = h.notes.startsWith('http') ? h.notes : null;
                            }
                          }
                          const isImage = imgUrl && /\.(png|jpg|jpeg|gif|webp)/i.test(imgUrl);
                          return (
                            <tr key={h.id} className="border-b hover:bg-muted/20 transition-colors">
                               <td className="px-3 py-1.5">
                                 {isImage ?
                                <a href={imgUrl} target="_blank" rel="noreferrer">
                                     <img src={imgUrl} alt="thumb" className="w-8 h-8 object-cover rounded-lg border shadow-sm hover:scale-110 transition-transform" />
                                   </a> :
                                imgUrl ?
                                <a href={imgUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg border bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                                     <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                   </a> :

                                <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center">
                                     {dt && <dt.icon className="w-3.5 h-3.5 text-muted-foreground/40" />}
                                   </div>
                                }
                               </td>
                               <td className="px-3 py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                                 {h.created_date ? new Date(h.created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                 {notesData?.nome_cartao &&
                                <p className="text-[9px] text-purple-600 font-semibold">
                                     {notesData.nome_cartao.split('—')[0].trim()}{notesData.bandeira ? ` · ${notesData.bandeira}` : ''}{notesData.dia_vencimento ? ` · dia ${notesData.dia_vencimento}` : ''}
                                   </p>
                                }
                                 {notesData?.competencia &&
                                <p className="text-[9px] text-blue-600 font-semibold">Competência: {notesData.competencia}</p>
                                }
                               </td>
                               {!selectedType && <td className="px-3 py-1.5 font-semibold text-[10px]">{dt?.label || h.batch_type}</td>}
                               <td className="px-3 py-1.5 text-[10px] text-primary font-medium truncate max-w-[120px]">{h.file_name || '—'}</td>
                               <td className="px-3 py-1.5 text-right font-bold text-green-700 text-[10px]">{h.success_count ?? 0}</td>
                               {selectedType === 'fatura_cartao' && <>
                                 <td className="px-3 py-1.5 text-right font-bold text-[10px]">
                                   {notesData?.valor_total ? formatCurrency(notesData.valor_total) : '—'}
                                 </td>
                                 <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                                   {notesData?.data_vencimento ?
                                  new Date(notesData.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) :
                                  '—'}
                                 </td>
                               </>}
                               {selectedType === 'folha_pagamento' &&
                              <td className="px-3 py-1.5 text-center text-[10px] font-semibold text-blue-700">
                                   {notesData?.competencia || '—'}
                                 </td>
                              }
                               <td className="px-3 py-1.5 text-center"><StatusBadge status={h.status} /></td>
                             </tr>);

                        })}
                        </tbody>
                      </table>
                    </div>);

              })()}
              </div>
            </div>

          </div>
        </div>
      }

      {/* Tabela de revisão */}
      {records.length > 0 && step !== 4 &&
      <div className="mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">3. Revisar Dados Extraídos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {records.length} registros · <span className="text-green-600">{records.filter((r) => r.status === 'novo').length} novos</span> · <span className="text-yellow-600">{dupeCount} duplicatas</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRecords((r) => r.map((rec) => ({ ...rec, selected: rec.status === 'novo' })))}>
                Selecionar novos
              </Button>
              <Button onClick={confirmSave} disabled={saving || selectedCount === 0} className="gap-2">
                {saving ?
              <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{saveProgress}</> :
              `Confirmar e Salvar (${selectedCount})`}
              </Button>
            </div>
          </div>
          {selectedType === 'extrato_bancario' && <ExtratoValidationCard validation={extratoValidacao} />}
          {selectedType === 'fatura_cartao' && faturaValidacao &&
        <div className={`mb-3 rounded-xl border p-3 ${faturaValidacao.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                {faturaValidacao.ok ?
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> :
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                <div className="flex-1 text-xs">
                  <p className={`font-bold ${faturaValidacao.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                    {faturaValidacao.ok ?
                '✓ Extração fiel — soma dos lançamentos bate com o total impresso' :
                '⚠️ Divergência detectada — soma não bate com o total impresso da fatura'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[11px]">
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Total impresso</p>
                      <p className="font-bold tabular-nums">{formatCurrency(faturaValidacao.totalFat)}</p>
                    </div>
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Soma extraída</p>
                      <p className="font-bold tabular-nums">{formatCurrency(faturaValidacao.somaLancs)}</p>
                    </div>
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Diferença</p>
                      <p className={`font-bold tabular-nums ${faturaValidacao.ok ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(faturaValidacao.diffSoma)}</p>
                    </div>
                    <div className="bg-white/60 rounded px-2 py-1">
                      <p className="text-muted-foreground">Lançamentos</p>
                      <p className="font-bold tabular-nums">
                        {faturaValidacao.qtdLancs}
                        {faturaValidacao.qtdLancsIa > 0 && faturaValidacao.qtdLancsIa !== faturaValidacao.qtdLancs + faturaValidacao.dupsInternas &&
                    <span className="text-[10px] text-amber-600 ml-1">(IA contou {faturaValidacao.qtdLancsIa})</span>
                    }
                        {faturaValidacao.dupsInternas > 0 &&
                    <span className="text-[10px] text-purple-600 ml-1 block">🧹 {faturaValidacao.dupsInternas} dup removidas</span>
                    }
                      </p>
                    </div>
                  </div>
                  {!faturaValidacao.ok &&
              <p className="text-[11px] text-red-700 mt-2">
                      Sugestão: tente reenviar o arquivo (a IA pode ter pulado lançamentos) ou verifique se o PDF está completo. Não salve até a soma bater.
                    </p>
              }
                </div>
              </div>
            </div>
        }
          {selectedType === 'relatorio_vendas_detalhado' ?
        <TabelaRevisaoVendasDetalhado records={records} setRecords={setRecords} /> :

        <div className="bg-card rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox" checked={records.every((r) => r.selected)}
                    onChange={(e) => setRecords((r) => r.map((rec) => ({ ...rec, selected: e.target.checked })))} />
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-24">Status</th>
                      {recordKeys.map((k) => <th key={k} className="px-2 py-2 text-left font-semibold text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec, i) =>
                <tr key={i} className={`border-b transition-colors ${rec.selected ? 'bg-card' : 'bg-muted/20 opacity-60'} hover:bg-muted/30`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={rec.selected}
                    onChange={(e) => setRecords((r) => r.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))} />
                        </td>
                        <td className="px-2 py-2"><StatusBadge status={rec.status} /></td>
                        {recordKeys.map((k) =>
                  <td key={k} className="px-2 py-2 max-w-[180px]">
                            <FieldValue value={rec.data[k]} />
                          </td>
                  )}
                      </tr>
                )}
                  </tbody>
                  {isFolha && folhaTotais &&
              <tfoot>
                      <tr className="border-t-2 bg-muted/40 font-bold">
                        <td className="px-3 py-2" />
                        <td className="px-2 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">Totais</td>
                        {recordKeys.map((k) => {
                    let content = null;
                    if (k === 'salario_total' || k === 'salarios_total' || k === 'salario_bruto') {
                      content = <span className="tabular-nums text-blue-700">{formatCurrency(folhaTotais.bruto)}</span>;
                    } else if (k === 'salario_liquido') {
                      content = <span className="tabular-nums text-emerald-700">{formatCurrency(folhaTotais.liquido)}</span>;
                    } else if (k === 'valor_pago') {
                      content = <span className="tabular-nums text-purple-700">{formatCurrency(folhaTotais.pago)}</span>;
                    }
                    return <td key={k} className="px-2 py-2">{content}</td>;
                  })}
                      </tr>
                    </tfoot>
              }
                </table>
              </div>
            </div>
        }
        </div>
      }

    </div>);

}