# Micro-API DFe NeuralTec — Railway

Serviço Node.js isolado para consultar `NFeDistribuicaoDFe`, manifestar Ciência da Operação, gerar XML + DANFE HTML + dados estruturados e notificar o Nexus Finanças360 por webhook. Aceita exclusivamente a empresa e o CNPJ da NeuralTec.

## Configuração do Railway

O `railway.json` da raiz configura a inicialização e a sonda pública `/live`. No Railway, registre `base44/shared/dfe-micro-api` como Root Directory. O serviço exige Node.js 20+, OpenSSL disponível no ambiente e instalação normal das dependências do pacote.

`/health` permanece protegido pelo token e é usado pelo app para conferir a configuração; usá-lo como sonda pública retorna 401 sem autenticação.

Cadastre no Railway, como variáveis secretas:

- `DFE_API_TOKEN`: mesmo token do segredo `DFE_MICRO_API_TOKEN` do app.
- `CNPJ_NEURALTEC`: CNPJ da NeuralTec, somente números.
- `NEXUS_HUB_TOKEN`: mesmo token já configurado no app; autentica o webhook enviado ao Base44.

O PFX e a senha permanecem no Base44. Eles são enviados por HTTPS autenticado e mantidos somente na memória transitória do processo para o agendamento horário; nunca são gravados em disco persistente ou em variável do Railway. Após reinício do serviço, uma chamada autenticada de distribuição reativa a sessão agendada.

Depois do deploy, mantenha no app:

- `DFE_MICRO_API_URL`: origem HTTPS fornecida pelo Railway, sem caminhos ou parâmetros.
- `DFE_MICRO_API_TOKEN`: o mesmo valor de `DFE_API_TOKEN`.
- `NEXUS_HUB_TOKEN`: o mesmo valor cadastrado no Railway.

## Endpoints

- `GET /live`: sonda pública sem dados fiscais.
- `GET /health`: diagnóstico autenticado, incluindo webhook, agendamento e cache.
- `POST /dfe/distribuicao`: consulta paginada (até 50 notas e 24 MB), manifestação 210210, XML, DANFE HTML e JSON estruturado.
- `GET /dfe/nota/:chave`: detalhe autenticado de nota presente no cache transitório.

O serviço limita rajadas autenticadas a 20 por minuto, rejeita respostas da SEFAZ acima de 25 MB, executa no máximo uma página fiscal por hora e envia as chaves novas para `https://financeiro-nexus.base44.app/functions/receberWebhookNFe`. O cursor durável, a trava concorrente e a auditoria permanecem no Base44.