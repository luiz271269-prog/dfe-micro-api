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
- pessoal: KaBuM, Shopee, Samsung, serviços pessoais
- estornos: valor negativo`,

  obra_reforma: `Analise este comprovante de pagamento (PIX ou boleto) referente a obra/reforma e extraia em JSON.
Retorne APENAS objeto JSON:
{"data":"YYYY-MM-DD","responsavel":"NOME DO DESTINATÁRIO","valor":numero,"descricao":"descrição do serviço se disponível","fornecedor_cnpj_cpf":"CPF ou CNPJ","tipo_profissional":"serralheiro ou pedreiro ou pintor ou vidros ou eletricista ou hidraulico ou material ou outros","local_obra":"loja ou pavilhao ou terraco ou outro","forma_pagamento":"PIX ou boleto","tipo":"mao_obra ou material"}
Regras:
- Se CPF → mao_obra; Se CNPJ → material
- Se "serralheiro"/"metalúrgica"/"grades" → serralheiro
- Se "pedreiro"/"alvenaria" → pedreiro
- Se "pintura"/"tinta" → pintor (empresa de tintas → material)
- Se "vidro"/"box"/"esquadria" → vidros`,

  folha_pagamento: `Analise esta folha de pagamento e extraia os dados de TODOS os funcionários em JSON.
Retorne APENAS array JSON:
[{"funcionario_nome":"NOME","competencia":"YYYY-MM","salario_bruto":numero,"horas_extras":numero,"comissao":numero,"outros_descontos":numero,"salario_liquido":numero,"valor_pago":numero,"saldo_a_pagar":numero,"status":"pago ou pendente","empresa":"NeuralTec","setor":"administrativo ou vendas ou assistencia","faturado":numero}]
Regras:
- competencia: inferir do título ex "FOLHA FEVEREIRO 2026" → "2026-02"
- salario_bruto: total de proventos
- outros_descontos: soma de INSS + compras + vales + outros
- salario_liquido: valor final após descontos
- saldo_a_pagar: salario_liquido - valor_pago`,

  dda_boletos: `Analise este DDA/boletos a vencer e extraia em JSON.
Retorne APENAS array JSON:
[{"beneficiario":"NOME","data_vencimento":"YYYY-MM-DD","valor":numero,"documento":"XXXXXXXXXX","conta_bancaria":"NeuralTec 36092-2 ou Liesch 37101-4 ou KLI Tecnologia"}]
Inferir conta_bancaria: "DDA NEURALTEC" → NeuralTec 36092-2, "DDA LIESCH" → Liesch 37101-4, "DDA KLI" → KLI Tecnologia`,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileData, fileType, docType } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 });

    const prompt = PROMPTS[docType];
    if (!prompt) return Response.json({ error: `Tipo de documento desconhecido: ${docType}` }, { status: 400 });

    // Build message content
    const contentParts = [];
    if (fileType === 'application/pdf') {
      contentParts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } });
    } else {
      contentParts.push({ type: 'image', source: { type: 'base64', media_type: fileType, data: fileData } });
    }
    contentParts.push({ type: 'text', text: prompt });

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: contentParts }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      return Response.json({ error: `Anthropic API error: ${err}` }, { status: 500 });
    }

    const data = await anthropicRes.json();
    const rawText = data.content[0].text.trim();

    // Try to parse JSON
    let parsed = null;
    try {
      // Remove markdown code blocks if present
      const clean = rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // Return raw text for manual review
      return Response.json({ success: true, rawText, parsed: null });
    }

    return Response.json({ success: true, rawText, parsed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});