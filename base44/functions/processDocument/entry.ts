import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PROMPTS = {
  extrato_bancario: `Você é um sistema de extração de dados bancários. Analise este extrato bancário Sicredi e extraia TODOS os lançamentos em JSON.
Retorne APENAS um array JSON válido, sem texto adicional, no formato:
[{"data":"YYYY-MM-DD","descricao":"descrição exata do extrato","valor":numero_positivo_ou_negativo,"documento":"COB000001 ou PIX_DEB ou vazio","saldo_apos":numero,"conta_bancaria":"NeuralTec 36092-2"}]
Regras:
- Créditos (entradas): valor POSITIVO
- Débitos (saídas): valor NEGATIVO
- data no formato YYYY-MM-DD
- valor como número (ex: -672.85 ou 45000.00)
- Incluir TODOS os lançamentos, inclusive tarifas e pequenos valores
- saldo_apos é o saldo após cada lançamento
- Ignorar linha "SALDO ANTERIOR"`,

  boletos_liquidados: `Analise este comprovante/tela de boletos liquidados e extraia os pagamentos em JSON.
Retorne APENAS array JSON:
[{"pagador":"NOME DO PAGADOR","valor":numero,"data_vencimento":"YYYY-MM-DD","data_pagamento":"YYYY-MM-DD","nosso_numero":"26/100XXX-X ou vazio","seu_numero":"NF-XXX ou vazio","status":"pago","cliente":"NOME"}]`,

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
Retorne APENAS um objeto JSON:
{"fatura":{"titular":"NOME","cartao_final":"XXXX","mes_referencia":"YYYY-MM","data_vencimento":"YYYY-MM-DD","valor_total":numero},"lancamentos":[{"data_lancamento":"YYYY-MM-DD","estabelecimento":"NOME","valor":numero,"parcela_numero":1,"parcela_total":1,"natureza":"empresarial ou pessoal","empresa_beneficiada":"NeuralTec ou pessoal"}]}
Regras natureza:
- empresarial: MercadoLivre compras, MATV Sul, Canva, fornecedores
- pessoal: KaBuM, Shopee, Samsung, serviços pessoais`,

  obra_reforma: `Analise este comprovante de pagamento (PIX ou boleto) referente a obra/reforma e extraia em JSON.
Retorne APENAS objeto JSON:
{"data":"YYYY-MM-DD","responsavel":"NOME DO DESTINATÁRIO","valor":numero,"descricao":"descrição do serviço se disponível","fornecedor_cnpj_cpf":"CPF ou CNPJ","tipo_profissional":"serralheiro ou pedreiro ou pintor ou vidros ou eletricista ou hidraulico ou material ou outros","local_obra":"loja ou pavilhao ou terraco ou outro","forma_pagamento":"PIX ou boleto","tipo":"mao_obra ou material"}
Regras: Se CPF → mao_obra; Se CNPJ → material`,

  folha_pagamento: `Analise esta folha de pagamento e extraia os dados de TODOS os funcionários em JSON.
Retorne APENAS array JSON:
[{"funcionario_nome":"NOME","competencia":"YYYY-MM","salario_bruto":numero,"horas_extras":numero,"comissao":numero,"outros_descontos":numero,"salario_liquido":numero,"valor_pago":numero,"saldo_a_pagar":numero,"status":"pago ou pendente","empresa":"NeuralTec","setor":"administrativo ou vendas ou assistencia","faturado":numero}]
Regras: competencia: inferir do título ex "FOLHA FEVEREIRO 2026" → "2026-02"`,

  dda_boletos: `Analise este DDA/boletos a vencer e extraia em JSON.
Retorne APENAS array JSON:
[{"beneficiario":"NOME","data_vencimento":"YYYY-MM-DD","valor":numero,"documento":"XXXXXXXXXX","conta_bancaria":"NeuralTec 36092-2 ou Liesch 37101-4 ou KLI Tecnologia"}]`,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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