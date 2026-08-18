import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const PROMPTS = {
  extrato_bancario: `Você é um sistema de extração de dados bancários. Analise este extrato bancário Sicredi e extraia TODOS os lançamentos em JSON.
Retorne APENAS um array JSON válido, sem texto adicional, no formato:
[{"data":"YYYY-MM-DD","descricao":"descrição exata do extrato","valor":numero_positivo_ou_negativo,"categoria":"recebimento ou fornecedor ou pessoal ou tributo ou despesa_operacional ou financeiro ou saque ou transferencia ou interno","saldo_apos":numero,"conta_bancaria":"NeuralTec 36092-2","detalhe":"documento ex: COB000001 ou PIX_DEB ou vazio"}]
Regras:
- Créditos (entradas): valor POSITIVO
- Débitos (saídas): valor NEGATIVO
- data no formato YYYY-MM-DD
- valor como número (ex: -672.85 ou 45000.00)
- categoria: recebimento para créditos; fornecedor para pagamentos a fornecedores; tributo para impostos/DAS/INSS/FGTS/IRRF/DARF/GPS; pessoal para FOLHA DE PAGAMENTO / SALÁRIOS / adiantamento salarial / vale / comissão de funcionário CLT; pro_labore para PRÓ-LABORE / RETIRADA DE SÓCIO / distribuição de lucros; financeiro para tarifas/IOF/anuidade/juros bancários; transferencia para TEDs entre contas próprias; interno para estornos; despesa_operacional para demais débitos
- ATENÇÃO PRÓ-LABORE (categoria SEPARADA): descrições contendo "PROLABORE", "PRÓ-LABORE", "PRO LABORE", "PRÓ LABORE", "RETIRADA SOCIO", "RETIRADA SÓCIO", "DISTRIB. LUCROS", "DIVIDENDOS" → SEMPRE categoria="pro_labore"
- ATENÇÃO FOLHA: descrições contendo "FOLHA", "SALARIO", "SALÁRIO", "PAGTO FUNCIONARIO", "PGTO FUNC", "ADIANTAMENTO SALARIAL", "VALE FUNCIONARIO" → SEMPRE categoria="pessoal" (Folha Pgto)
- Incluir TODOS os lançamentos, inclusive tarifas e pequenos valores
- saldo_apos é o saldo após cada lançamento
- Ignorar linha "SALDO ANTERIOR"`,


  boletos_liquidados: `Analise este comprovante/tela de boletos liquidados e extraia os pagamentos em JSON.
Retorne APENAS array JSON:
[{"nosso_numero":"26/100XXX-X ou vazio","seu_numero":"NF-XXX ou vazio","cliente":"NOME DO CLIENTE","data_vencimento":"YYYY-MM-DD","data_pagamento":"YYYY-MM-DD","valor_titulo":numero,"valor_pago":numero,"status":"pago","canal_cobranca":"sicredi"}]`,


  relatorio_nfs: `Analise este relatório de notas fiscais (sistema Fabris/Ellitte) e extraia TODAS as NFs em JSON.
Retorne APENAS array JSON:
[{"numero":"77","tipo":"NF","data_emissao":"YYYY-MM-DD","cliente":"NOME COMPLETO DO CLIENTE","valor_total":numero,"vendedor":"Thais ou Tiago ou Fat.Direto","status":"pago","valor_recebido":numero,"valor_aberto":numero}]
Regras:
- tipo: "NF" para notas normais, "CI" para contratos/instrumentos
- vendedor: Thais (V-05) ou Tiago (V-01) ou Fat.Direto; se não souber usar "Tiago"
- NFs com valor 0 ou ANULADA: status="pago", valor_total=0
- status: "pago" para meses passados, "a_vencer" para mês atual`,

  compras_fornecedor: `Analise este relatório de compras e extraia todos os itens em JSON.
Retorne APENAS array JSON:
[{"fornecedor":"COMPRAS A VISTA ou MERCADO LIVRE ou PAUTA DISTRIBUIÇÃO","numero_nota":"XXXXX","data_emissao":"YYYY-MM-DD","descricao_produto":"NOME DO PRODUTO","categoria_produto":"notebook ou tablet ou componente ou periferico ou software ou outro","quantidade":numero,"valor_unitario":numero,"valor_total":numero}]`,

  fatura_cartao: `Analise esta fatura de cartão de crédito e extraia as informações em JSON.
Retorne APENAS um objeto JSON válido, sem texto adicional, markdown ou explicações:
{"fatura":{"mes_referencia":"YYYY-MM","data_vencimento":"YYYY-MM-DD","valor_total":numero,"valor_minimo":numero_ou_null},"lancamentos":[{"data_lancamento":"YYYY-MM-DD","estabelecimento":"NOME DO ESTABELECIMENTO","descricao":"descricao completa","valor":numero,"parcela_numero":1,"parcela_total":1,"natureza":"empresarial ou pessoal","categoria":"fornecedor ou pessoal ou operacional ou alimentacao ou transporte ou tecnologia ou outro"}]}
Regras:
- data_lancamento: formato YYYY-MM-DD
- valor: sempre positivo (débitos positivos, estornos/créditos negativos)
- mes_referencia: inferir do cabeçalho da fatura (ex: FATURA MARÇO/2026 = 2026-03)
- natureza empresarial: MercadoLivre, MATV Sul, Canva, fornecedores de negócios
- natureza pessoal: KaBuM, Shopee, Samsung, serviços pessoais
- Ignorar linhas de pagamento anterior, saldo anterior, limite
- Incluir TODOS os lançamentos da fatura`,

  obra_reforma: `Analise este comprovante de pagamento (PIX ou boleto) referente a obra/reforma e extraia em JSON.
Retorne APENAS objeto JSON:
{"data":"YYYY-MM-DD","responsavel":"NOME DO DESTINATÁRIO","valor":numero,"descricao":"descrição do serviço se disponível","fornecedor_cnpj_cpf":"CPF ou CNPJ","tipo_profissional":"serralheiro ou pedreiro ou pintor ou vidros ou eletricista ou hidraulico ou material ou outros","local_obra":"loja ou pavilhao ou terraco ou outro","forma_pagamento":"PIX ou boleto","tipo":"mao_obra ou material"}
Regras: Se CPF → mao_obra; Se CNPJ → material`,

  folha_pagamento: `Analise esta planilha de folha de pagamento e extraia os dados de TODOS os funcionários em JSON, capturando TODAS as colunas da planilha NA MESMA ORDEM.
Retorne APENAS array JSON, um objeto por funcionário, com EXATAMENTE estas chaves nesta ordem:
[{"funcionario_nome":"NOME","setor":"administracao ou vendas ou assistencia","admissao":"texto da coluna Admissão como está","folha":numero,"por_fora":numero,"salarios_total":numero,"vantagem":numero,"extras":numero,"premio":numero,"comissao":numero,"salario_total":numero,"dias_trabalhados":numero,"desconto_folha":numero,"compras":numero,"vales":numero,"salario_liquido":numero,"valor_pago":numero,"saldo_a_receber":numero,"competencia":"YYYY-MM","status":"pago ou pendente","empresa":"NeuralTec"}]
Regras:
- Mapeie: "Folha"→folha, "Por Fora"→por_fora, "Salários Total"→salarios_total, "Vantagem"→vantagem, "Extras"→extras, "Premio"→premio, "Comissão"→comissao, "Salário Total"→salario_total, "Dias Trab."→dias_trabalhados, "Desc. Folha"→desconto_folha, "Compras"→compras, "Vales"→vales, "LÍQUIDO"→salario_liquido, "Pago"→valor_pago, "Saldo a receber"→saldo_a_receber.
- salario_bruto = salario_total (ou salarios_total se vazio). Valores SEM R$, ponto decimal. Vazio ou "-" = 0.
- setor: inferir do agrupamento (ADMINISTRAÇÃO, VENDAS, ASSISTÊNCIA). status: "pago" se coluna Pago tiver valor.
- competencia: inferir do título ex "FOLHA MÊS maio 2026" → "2026-05". NÃO inclua linhas de subtotal/total geral.`,

  dda_boletos: `Analise este DDA/boletos a vencer e extraia em JSON.
Retorne APENAS array JSON:
[{"data":"YYYY-MM-DD","descricao":"NOME DO BENEFICIÁRIO / DESCRIÇÃO","valor":numero_negativo,"categoria":"fornecedor ou tributo ou financeiro ou despesa_operacional","conta_bancaria":"NeuralTec 36092-2 ou Liesch 37101-4 ou KLI Tecnologia","detalhe":"código de barras ou documento se disponível"}]
Regras:
- valor: NEGATIVO (são saídas/débitos futuros)
- data: data de vencimento do boleto no formato YYYY-MM-DD`,

};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const { fileData, fileType, docType } = await req.json();

    const prompt = PROMPTS[docType];
    if (!prompt) return Response.json({ error: `Tipo desconhecido: ${docType}` }, { status: 400 });

    // Upload file first to get a real URL (InvokeLLM doesn't support data: URIs for PDFs)
    const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
    const ext = fileType.includes('pdf') ? 'pdf' : (fileType.split('/')[1] || 'bin');
    const uploadFile = new File([binaryData], `upload.${ext}`, { type: fileType });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadFile });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      file_urls: [file_url],
      model: 'claude_sonnet_4_6',
    });

    // result is a string when no response_json_schema is given
    const rawText = typeof result === 'string' ? result.trim() : JSON.stringify(result);

    let parsed = null;
    try {
      const clean = rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // Return raw text for manual review
    }

    return Response.json({ success: true, rawText, parsed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});