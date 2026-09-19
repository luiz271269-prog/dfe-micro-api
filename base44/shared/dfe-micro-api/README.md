# Micro-API DFe NeuralTec — Render

Serviço Node.js isolado para consultar `NFeDistribuicaoDFe` com certificado A1 e entregar os `docZip` ao Nexus Finanças360. Aceita exclusivamente a empresa e o CNPJ da NeuralTec.

## Configuração do Render

Crie um **Web Service** usando este mesmo repositório:

- Root Directory: `base44/shared/dfe-micro-api`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/live` (sonda pública, sem credenciais ou dados fiscais)

`/health` permanece protegido pelo token e é usado exclusivamente pelo app para conferir a configuração; usá-lo como sonda do Render retorna 401 sem autenticação.

Cadastre no Render, como variáveis secretas:

- `DFE_API_TOKEN`: token aleatório compartilhado com o segredo `DFE_MICRO_API_TOKEN` do app.
- `CNPJ_NEURALTEC`: CNPJ da NeuralTec, somente números.
- `CERT_PFX_BASE64`: conteúdo completo do certificado A1 convertido para Base64.
- `CERT_PFX_PASSWORD`: senha do certificado A1.

Não grave certificado, senha ou token no GitHub.

Depois do deploy, configure no app:

- `DFE_MICRO_API_URL`: URL HTTPS real fornecida pelo Render, somente a origem (`https://<seu-servico>.onrender.com`), sem `/health`, parâmetros, usuário ou senha. Nunca use uma senha ou token neste campo.
- `DFE_MICRO_API_TOKEN`: o mesmo valor de `DFE_API_TOKEN`.

O serviço expõe `GET /health` e `POST /dfe/distribuicao`, exatamente no contrato já consumido pelas funções fiscais do app.