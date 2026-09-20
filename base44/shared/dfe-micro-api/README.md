# Micro-API DFe NeuralTec — Railway

Serviço Node.js isolado para consultar `NFeDistribuicaoDFe` com certificado A1 e entregar os `docZip` ao Nexus Finanças360. Aceita exclusivamente a empresa e o CNPJ da NeuralTec.

## Configuração do Railway

O arquivo `railway.json` da raiz configura automaticamente a construção, a inicialização e a sonda pública `/live`. O serviço executa a aplicação localizada em `base44/shared/dfe-micro-api` com Node.js 20 ou superior.

`/health` permanece protegido pelo token e é usado exclusivamente pelo app para conferir a configuração; usá-lo como sonda pública retorna 401 sem autenticação.

Cadastre no Railway, como variáveis secretas:

- `DFE_API_TOKEN`: token aleatório compartilhado com o segredo `DFE_MICRO_API_TOKEN` do app.
- `CNPJ_NEURALTEC`: CNPJ da NeuralTec, somente números.
- `CERT_PFX_BASE64`: conteúdo completo do certificado A1 convertido para Base64.
- `CERT_PFX_PASSWORD`: senha do certificado A1.

Não grave certificado, senha ou token no GitHub.

Depois do deploy, configure no app:

- `DFE_MICRO_API_URL`: URL HTTPS real fornecida pelo Railway, somente a origem (`https://<seu-servico>.up.railway.app`), sem `/health`, parâmetros, usuário ou senha.
- `DFE_MICRO_API_TOKEN`: o mesmo valor de `DFE_API_TOKEN`.

O serviço expõe `GET /health` e `POST /dfe/distribuicao`, limita consultas autenticadas a 20 por minuto e rejeita respostas da SEFAZ acima de 25 MB.