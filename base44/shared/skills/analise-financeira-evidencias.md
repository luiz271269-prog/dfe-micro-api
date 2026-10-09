# Estudo de alinhamento da skill financeira NexusFin

## 1. Entrega e fronteiras

Revisão documental preparada em 2026-10-09 UTC, referente a 2026-10-08 em America/Sao_Paulo. Documento operacional: `analise-financeira-revisada.md`.

**Realizado:** leitura estática dos arquivos abaixo, comparação com a descrição disponível da skill e com as instruções dos agentes, registro de incompatibilidades e elaboração de instruções preventivas.

**Não realizado:** consulta de registros financeiros, validação numérica de indicadores, execução de funções financeiras, teste de jornadas, auditoria integral de todos os módulos, alteração de regras, entidades, registros, agentes, permissões ou workflows. Resultados antigos de conversas não foram usados como validação atual.

**Limite da skill original:** `activate_workspace_skill` retornou “already active” para `analise-financeira` e `agente-loop`, sem disponibilizar o texto integral. Estava disponível a descrição: especialista em controles internos NeuralTec/Liesch, Loop-R v1, evidências de consultas e gates de escrita. Logo, não se afirma comparação integral linha a linha nem preservação de instruções originais não visíveis.

**Aplicação:** os documentos no projeto não substituem nem ativam a skill do workspace. A mudança ficou restrita à documentação. A revisão precisa ser comparada com o original completo no editor e salva por pessoa autorizada.

## 2. Comparação resumida

| Dimensão | Evidência disponível do existente | Revisão proposta |
|---|---|---|
| Evidências financeiras | Descrição da skill exige consultas; motor retorna evidências e status de fontes; alguns agentes tratam função como invariavelmente correta. | Contrato da consulta, identidade da fonte, timestamp, regime, corte, filtros, cobertura, limites, estimativa e zero versus indisponibilidade. |
| Proteções contra erros | Agentes inspecionados têm permissões de entidades apenas de leitura; orientações incluem regras amplas de antidupla contagem e uso obrigatório de panorama legado. | Manter somente leitura; não executar rotinas de correção; não excluir caixa pelo simples vínculo; verificar efeitos de funções e não confundir heurística com prova. |
| Alinhamento estrutural | Existem motores distintos de competência, caixa, carteira e panorama semanal; contrato e implementação apresentam divergências. | Mapear cada pergunta à fonte adequada, declarar incompatibilidades e impedir promessa de uma única totalização universal. |

Não foi corrigido nenhum dos pontos de código abaixo. “Proteção na skill” significa orientação proposta, não garantia de que o software ou os agentes já mudaram de comportamento.

## 3. Matriz de evidências verificadas no código

### E01 — Separação de operação, caixa e posição já implementada
- Fonte: `base44/shared/fluxoConsolidado/motor.ts`, linhas 29–53, `calcularConsolidado`.
- Observado: calcula operação, caixa, bridge, posição, aberto e Loop-R separadamente; devolve também `sourceStatus`.
- Regra da revisão: sempre declarar regime; comparar apenas medidas com contrato explícito.
- Limite: arquitetura inspecionada, nenhum resultado financeiro desta função consultado nesta revisão.

### E02 — Bridge não é carteira a pagar nem certificado de fechamento
- Fonte: `base44/shared/fluxoConsolidado/bridge.ts`, linhas 5–21; `loopR.ts`, linhas 38–57.
- Observado: ajustes incluem receita, compras/faturas, tributos, folha, despesas, retiradas, investimentos, financeiros, aplicações, transferências e não classificados. `fechado` no bridge depende do residual; status de conciliação considera outros bloqueadores.
- Regra: cards da imagem representam ajustes de competência versus caixa; não transportar seus sinais/fórmulas automaticamente à dívida em aberto.

### E03 — Risco em orientações antigas de antidupla contagem
- Fontes: `base44/agents/financial_controller.jsonc`, campo `instructions`, princípios 1–2; `financial_health_advisor.jsonc`, campo `instructions`, “Anti-Duplicidade”; `base44/shared/fluxoConsolidado/normalizarCaixa.ts`, linhas 67–86.
- Observado: agentes orientam ignorar lançamento bancário vinculado a compra em totalizações, sem delimitar regime. O motor de caixa mantém o movimento e usa vínculo para classificá-lo.
- Risco: aplicação literal da orientação pode subestimar caixa. Isso é risco semântico demonstrado, não ocorrência ou perda quantificada.
- Proteção: antidupla contagem deve atuar sobre representações da mesma operação por regime, sem remover o pagamento bancário real.

### E04 — Panorama semanal não é equivalente à carteira atual
- Fonte: `base44/functions/panoramaFinanceiroSemana/entry.ts`, linhas 42–57 e 94–128; comparação com `consultarCarteiraPagarPainel/entry.ts`, linhas 13–39, e `carteiraPagarFontes.ts`, linhas 43–49.
- Observado no panorama: listas com limites fixos sem paginação; despesas usam valor integral; folhas pendentes usam salário líquido integral; compras usam emissão como vencimento; não exclui compras/despesas absorvidas por cartão nesses filtros; não carrega obras nem regras recorrentes. Tributos não incluem estado `parcelado` nem somam juros/multa nessa construção.
- Observado na carteira: filtros próprios de status/data, exclusão de vínculos de cartão, saldo residual, obras e previsões fixas separadas.
- Risco: diferenças estruturais podem produzir totais não comparáveis. Nenhuma diferença monetária foi medida.
- Proteção: não chamar o panorama de “verdade geral”, não certificar ausência de dívida por retorno zero e não substituir carteira mensal por resultado semanal.

### E05 — Fontes de compras diferentes
- Fonte: `base44/functions/calcularFluxoConsolidado/entry.ts`, linhas 18–22; `base44/shared/carteiraPagarFontes.ts`, linha 44.
- Observado: o consolidado substitui os itens locais pelo retorno da Central, solicitado com `limit=500`; erro torna essa fonte indisponível e itens vazios. A carteira lê `ItemCompra` local.
- Limite: não foi inspecionada a paginação interna do serviço remoto, nem medida sincronização. O ponto de chamada não fornece prova de completude remota.
- Proteção: conferir origem, limite, atualização e baixas antes de comparar os totais; fonte indisponível não equivale a nenhuma compra.

### E06 — CMV e folha possuem definições gerenciais específicas
- Fonte: `base44/shared/fluxoConsolidado/operacao.ts`, linhas 30–45, 58–78; `src/lib/fluxoConsolidado/contratoFinanceiro.js`, decisões 2 e 3.
- Observado: CMV estimado usa compras classificadas como estoque no mês; folha utiliza salário líquido; custos fixos não são ponto de equilíbrio; margem sem faturamento retorna null.
- Proteção: não apresentar esses valores como CMV contábil definitivo, custo trabalhista integral ou ponto de equilíbrio.

### E07 — Competência de cartão: contrato e carregador não equivalem
- Fontes: `src/lib/fluxoConsolidado/contratoFinanceiro.js`, decisão 10; `base44/shared/fluxoConsolidado/carregar.ts`, linhas 5–8; `operacao.ts`, linhas 30–55.
- Observado: contrato menciona `LancamentoCartao` na operação; o carregador não inclui essa entidade diretamente e a operação usa documentos de controle. Cartões não materializados em documentos exigem verificação de cobertura.
- Limite: não prova que existam gastos ausentes hoje; requer rastreabilidade dos dados para quantificar.
- Proteção: nunca afirmar que todos os lançamentos de cartão já foram reconhecidos na operação sem essa evidência.

### E08 — Perímetro de obras de manutenção exige ressalva
- Fonte: `base44/shared/fluxoConsolidado/operacao.ts`, linhas 47–54.
- Observado: despesas operacionais filtram perímetro; a seleção de obras de manutenção filtra mês/natureza, sem `dentroPerimetro` nessa linha. O carregador observado lê a fonte sem filtro de empresa.
- Risco: usuário com acesso a várias empresas pode obter componente de manutenção sem o filtro esperado por empresa.
- Proteção: não certificar esse componente por empresa sem consulta cruzada; recomendar correção separada, não alterar motor nesta entrega.

### E09 — Classificação por primeiro vínculo não comprova rateio
- Fonte: `base44/shared/fluxoConsolidado/normalizarCaixa.ts`, linhas 49–53 e 74–78.
- Observado: agrupa todos os vínculos, mas usa `vinc[0]` para determinar a classe do movimento inteiro.
- Risco: movimento com múltiplas naturezas pode ter total de caixa correto e subtotais por natureza inadequados.
- Proteção: distinguir integridade do total de integridade do rateio. Não afirmar que todas as alocações foram consideradas apenas porque há vínculo.

### E10 — Fontes parciais e evidências amostrais
- Fontes: `base44/shared/fluxoConsolidado/carregar.ts`, linhas 2–20; `evidencia.ts`, linhas 1–13; `carteiraPagarFontes.ts`, linhas 26–29.
- Observado: carregador tem limite de vinte páginas de mil e sinaliza parcial/indisponível; IDs de evidência são limitados a 500 por linha; agregador da carteira rejeita `truncated`.
- Proteção: tratar status de cobertura como gate, não somar IDs amostrais e não presumir agregação completa.

### E11 — Carteira é posição residual atual até o corte
- Fontes: `base44/shared/carteiraPagarFontes.ts`, linhas 19–24 e 43–49; `consultarCarteiraPagarPainel/entry.ts`, linhas 25–39.
- Observado: filtros por status atual e vencimentos até o fim do mês, com alternativas e inclusão de datas ausentes; subtração de pagamentos atuais; retorno separa confirmado e previsto.
- Proteção: não afirmar saldo histórico, gasto de competência ou total pago; manter atrasados e sem data explicitamente no escopo.

### E12 — Despesa fixa: previsão separada e calendário faltante
- Fonte: `base44/shared/carteiraPagarFixas.ts`, linhas 8–45.
- Observado: relaciona cadastros ativos e documentos recorrentes, desconta ocorrências já materializadas, não soma previsões sem calendário válido e reporta `semCalendario`.
- Proteção: previsão não vira obrigação confirmada por suposição; sem calendário não vira previsão zero certificada.

### E13 — Calendário e tolerâncias não são universais
- Fontes: `base44/shared/folhaCalendario.ts`, linhas 10–30; `panoramaFinanceiroSemana/entry.ts`, linhas 104–109; `base44/shared/conciliacaoCartaoRegras.ts`, linhas 15–29.
- Observado: calendário compartilhado trabalha janela do quinto ao sétimo dia útil bancário e não inclui feriados locais; panorama usa dia cinco do mês seguinte. Cartão automático exige igualdade em centavos/até três dias/evidências; caminho manual individual de compra admite condições diferentes.
- Proteção: não generalizar janela de sessenta dias do agente para automação; calendário do app não é garantia de conformidade trabalhista.

### E14 — Classificação e empresa não devem ser inventadas
- Fontes: `base44/shared/classificacaoFinanceira.ts`, linhas 4–14, 116–148; `base44/shared/fluxoConsolidado/evidencia.ts`, linhas 19–29; `base44/entities/TituloCobranca.jsonc`, `properties`.
- Observado: cadastro ativo e perfis influenciam classificação; há conversão legada de pessoal para pró-labore; perímetro bancário deriva do prefixo da conta; título não declara campo empresa.
- Proteção: consultar cadastro e contexto, preservar dimensões e verificar relação documental antes de atribuir títulos a empresas.

### E15 — Permissões de leitura não eliminam conflitos de instrução
- Fontes: `base44/agents/financial_controller.jsonc`, `tool_configs`; `financial_health_advisor.jsonc`, `tool_configs`, `instructions`, `memory_config`.
- Observado: entidades expostas nos dois agentes permitem apenas `read`. O advisor expõe `panoramaFinanceiroSemana`, cujo corpo verifica admin e só lê dados nas operações inspecionadas. As duas funções mensais não aparecem em seus `tool_configs`. Instruções/memórias incluem recomendações mais abrangentes que as regras atuais (por exemplo obras geralmente como CAPEX e confiança universal no panorama).
- Limite: não houve conversa de teste com os agentes; não se conclui comportamento efetivo nem cobertura de todos os agentes do app. IDs de skills vinculadas não foram associados a nomes por inferência.
- Proteção: skill nova não concede ferramenta, não substitui memória/configuração e não torna todos os agentes alinhados automaticamente.

### E16 — “Fechado” possui semânticas divergentes nas referências
- Fontes: `src/lib/fluxoConsolidado/contratoFinanceiro.js`, linhas 178–184 e 205–209; `base44/shared/fluxoConsolidado/loopR.ts`, linhas 1–2 e 38–43.
- Observado: contrato menciona estado fechado para identidade aritmética; motor Loop-R só atribui não verificável, divergente, em conciliação ou conciliado. O comentário sobre certificação futura não prova que ela exista ou tenha sido executada.
- Proteção: preservar status retornado e não certificar fechamento por conta própria.

## 4. Evidência financeira versus hipótese

- **Verificado:** os comportamentos e diferenças de instruções nos trechos citados.
- **Hipóteses dependentes de dados:** existência atual de duplicidade, dívida inflada, compra omitida, rateio incorreto, cruzamento entre empresas ou perdas monetárias.
- **Não validado nesta entrega:** qualquer saldo, margem, faturamento, inadimplência ou KPI atual; conformidade fiscal/trabalhista; versão publicada em relação ao código inspecionado; ativação da skill no workspace.

Os hashes abaixo identificam o conteúdo inspecionado, não validam a correção financeira nem provam que a produção esteja nessa mesma revisão.

## 5. Critérios de revisão preventiva (cenários propostos, NÃO executados)

| Cenário | Resposta exigida da skill |
|---|---|
| Fonte indisponível retorna lista vazia | Informar não verificável; não concluir zero real. |
| Agregação truncada ou lista no limite | Declarar cobertura parcial e bloquear conclusão geral. |
| Documento de compra absorvido por cartão | Não duplicar dívida individual com fatura; manter débito bancário na análise de caixa. |
| Documento parcialmente pago | Usar saldo residual e conferir vínculos/estornos. |
| Regra recorrente já materializada | Não somar previsão com a ocorrência; preservar distinção pago/aberto. |
| Regra sem calendário | Sinalizar lacuna de projeção. |
| Dois vínculos de naturezas diferentes no mesmo débito | Não certificar rateio pelo primeiro vínculo. |
| Obra de outra empresa no período | Não certificar componente por empresa sem conferir perímetro. |
| Mês passado com pagamentos posteriores | Não chamar saldo atual de posição histórica. |
| Panorama semanal e carteira mensal divergem | Conferir filtros, corte, fontes e regras; não escolher o maior, menor ou mais conveniente. |
| Margem baseada em compras do mês | Manter “estimada”; não chamar de margem contábil definitiva. |
| Denominador zero ou cobertura insuficiente | Informar não calculável, sem fabricar percentual. |
| Solicitante sem ferramenta/permissão | Informar limitação; não contornar acesso. |
| Pedido de “corrigir automaticamente” durante análise | Não escrever; separar recomendação e execução humana autorizada. |
| Residual do bridge zero com fontes incompletas | Não promover a conciliado/fechado. |

Critérios adicionais antes de ativar: ler versão anterior integral, comparar recomendações omitidas, resolver conflitos de prioridade com instruções dos agentes e confirmar que o editor salvou a revisão. Nenhum desses cenários foi executado em dados reais nesta entrega.

## 6. Como aplicar sem alterar o financeiro

O caminho documentado é workspace → Settings → Build tools → Skills → menu da skill → Edit Skill. Consultado em: https://docs.base44.com/documentation/using-your-workspaces/adding-workspace-skills.

1. Pessoa autorizada abre `analise-financeira` e preserva uma cópia do original completo.
2. Compara as instruções operacionais propostas com o original. Mantém regras compatíveis não avaliadas neste estudo; não substitui cegamente o texto inacessível.
3. Resolve conflitos de orientação com os agentes em solicitação separada, sem ampliar permissões de escrita.
4. Salva a revisão na skill existente; registra versão/data e confirma a ativação no editor.
5. Verifica respostas de leitura pelos cenários acima antes de tratar o suporte como alinhado.

Esta revisão não corrige as funções antigas e não agenda validação periódica. A prioridade recomendada é impedir conclusões indevidas na orientação; depois, mediante autorização específica, tratar panorama legado, rateio por vínculos e perímetro de manutenção com evidências de dados e validação própria.

## 7. Manifesto SHA-256 dos arquivos inspecionados

Gerado com leitura dos arquivos do projeto; somente referências, sem dados pessoais ou segredos.

| Arquivo | SHA-256 |
|---|---|
| `base44/functions/calcularFluxoConsolidado/entry.ts` | `69da9405b21d6b173a70c2ef2fe7f88b3ec0b0ef0dc97e123eb6df674afe531e` |
| `base44/functions/consultarCarteiraPagarPainel/entry.ts` | `755a03c7c680b9fff3e7b128bb1018d71c61a5c43adf518b19b99fa9c3868218` |
| `base44/functions/panoramaFinanceiroSemana/entry.ts` | `2da43f2b38f5a8565e3fe8575d13c1eb0f3e73a21fdb2b8f0d5be3c173811e24` |
| `base44/shared/fluxoConsolidado/motor.ts` | `15fe7919c019066dfa7aedb7ef435c0c6b1e82ef5cc1b221f84faae0dff6dce7` |
| `base44/shared/fluxoConsolidado/bridge.ts` | `c000e74880f062d6a8e6c39dff5d46d12273c31db83d3fdc800203a01859bc0c` |
| `base44/shared/fluxoConsolidado/evidencia.ts` | `31dc8fda1517439266700901c616252b42e5d451cafc1576105b7509ea4b4027` |
| `base44/shared/fluxoConsolidado/carregar.ts` | `e3595ced4a21e93c9b6ffc0f9c5e98598f2ddbec037ebfa19bb95d9e9222a8f0` |
| `base44/shared/fluxoConsolidado/operacao.ts` | `9ea20a471f907a85049be824e421a118e9bf5505fd961716e0f36270568b949f` |
| `base44/shared/fluxoConsolidado/loopR.ts` | `5a4bdeb14f55b2be95761da2d390069d3851d2f527ab5aff4e8e7a2b84847fdc` |
| `base44/shared/fluxoConsolidado/normalizarCaixa.ts` | `0a9bf5074c4c2241c77ba60ffe185842aaa92c019e137ea3962092ab52fd3ba2` |
| `base44/shared/carteiraPagarFontes.ts` | `a9916628038424c19d322b55f2cb9fd41307d72a9101dcbcd72bd38e49125f3b` |
| `base44/shared/carteiraPagarFixas.ts` | `7933cb33f1d748d20a2a643c8faa8cc7b8ed59ac01d4c981d8e72df9ae01db07` |
| `base44/shared/folhaCalendario.ts` | `c86cf57ca1560e8a322e833f6efb56a32bf33bc828e9350fea7f31f5b5e0eed0` |
| `base44/shared/conciliacaoCartaoRegras.ts` | `65375d602daef8e76c1d20f297e2468d7d67d48fcadbd2c5550c7a8caf31f04f` |
| `base44/shared/classificacaoFinanceira.ts` | `80279d99eb1456f518e78d0ec967d9ea908fcb18bebf73b50c032ead85dc2e4e` |
| `src/lib/fluxoConsolidado/contratoFinanceiro.js` | `dc7285b7eda1a1924f0d1c86ab9f9f13d24ecdfc16e4d365804f1360d6fc8781` |
| `base44/agents/financial_controller.jsonc` | `8b620cb0fcdd4df857d095b3317b488f1c724441ca3b895acbfaf461bbb81a6a` |
| `base44/agents/financial_health_advisor.jsonc` | `58614943e534fd821ce77889ae6c1b3ee92653d744bb818d592c307c5655462e` |
| `base44/entities/TituloCobranca.jsonc` | `2198c77721e6d123c04896ee01872918787913781a801348b1a258349d7f2d5d` |