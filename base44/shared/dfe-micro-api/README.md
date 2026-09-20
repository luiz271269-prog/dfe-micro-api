# Micro-API DFe NeuralTec — Railway

Serviço Node.js isolado para consultar `NFeDistribuicaoDFe` com certificado A1 e entregar os `docZip` ao Nexus Finanças360. Aceita exclusivamente a empresa e o CNPJ da NeuralTec.

## Configuração do Railway

O arquivo `railway.json` da raiz configura construção reproduzível com `npm ci`, inicialização e sonda pública `/live`. No Railway, registre explicitamente `base44/shared/dfe-micro-api` como Root Directory. O serviço exige Node.js 20 ou superior.

`/health` permanece protegido pelo token e é usado exclusivamente pelo app para conferir a configuração; usá-lo como sonda pública retorna 401 sem autenticação.

Cadastre no Railway, como variáveis secretas:

- `DFE_API_TOKEN`: token aleatório compartilhado com o segredo `DFE_MICRO_API_TOKEN` do app.
- `CNPJ_NEURALTEC`: CNPJ da NeuralTec, somente números.

O PFX e a senha permanecem exclusivamente no Base44 e são enviados em memória, por HTTPS autenticado, somente durante uma consulta fiscal. Não grave certificado, senha ou token no GitHub ou no Railway.

Depois do deploy, configure no app:

- `DFE_MICRO_API_URL`: URL HTTPS real fornecida pelo Railway, somente a origem (`https://<seu-servico>.up.railway.app`), sem `/health`, parâmetros, usuário ou senha.
- `DFE_MICRO_API_TOKEN`: o mesmo valor de `DFE_API_TOKEN`.

O serviço expõe `GET /health` e `POST /dfe/distribuicao`, limita rajadas autenticadas a 20 por minuto e rejeita respostas da SEFAZ acima de 25 MB. O cooldown fiscal durável por CNPJ e a trava concorrente ficam no Base44.