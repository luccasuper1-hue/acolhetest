# API do Acolhe no Cloudflare Workers

Esta pasta contém o Worker oficial de produção do Acolhe. Ela entrega o frontend e atende `/api/*` no mesmo domínio, usando Durable Object + MongoDB Atlas. A API FastAPI em `backend/` permanece apenas como legado/local e não faz parte do deploy oficial.

## Arquitetura oficial

Um único Worker entrega os arquivos estáticos do React e atende as chamadas em `/api/*`. O banco continua sendo o MongoDB Atlas. As variáveis de produção são configuradas como segredos no Cloudflare:

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `FRONTEND_URL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM` (opcional)

O Worker usa um Durable Object como ponto de integração com o MongoDB, evitando criar uma conexão nova a cada chamada. Isso segue a recomendação do Cloudflare para Atlas.

## Estado da implementação

- [x] Separar uma cópia local para o trabalho.
- [x] Mapear as rotas do FastAPI.
- [x] Criar Worker, JWT, cookies seguros, lock de login, CORS e roteamento de `/api/*`.
- [x] Migrar regras de aluno, profissional, instituição, administração e métricas.
- [x] Alterar o frontend desta cópia para usar `/api` no mesmo domínio, sem URL externa.
- [ ] Testar restauração contra um banco Atlas separado, sem reutilizar produção.
- [x] Publicar no Cloudflare e validar o envio de recuperação via Gmail API.

## Build único

No diretório `frontend`, instale as dependências e execute `npm run build`. Isso produz `frontend/build`.
No diretório desta pasta, `npm run verify` valida o Worker e seu pacote de assets, sem publicar. O comando `npm run deploy` primeiro gera o frontend e então publica a versão oficial no Cloudflare; execute-o somente após os testes e a revisão operacional.

Antes de qualquer teste contra um Atlas de desenvolvimento novo, execute `npm run indexes` nesta pasta com `MONGO_URL` e `DB_NAME` temporariamente definidos no seu terminal. Ele mantém os mesmos índices únicos que o seed Python criava; não execute esse comando contra produção sem revisar o banco.

Para CI do Cloudflare, o repositório deve ter o diretório raiz na raiz do projeto e usar uma etapa que instale dependências de `frontend` e de `cloudflare-worker`, gere `frontend/build` e execute `wrangler deploy` a partir de `cloudflare-worker`. O diretório de assets é deliberadamente `../frontend/build`.

## Variáveis de produção

Crie-as como segredos no Cloudflare, sem gravá-las em código:

- `MONGO_URL`: URI do Atlas de um banco de desenvolvimento primeiro.
- `DB_NAME`: nome do banco correspondente.
- `JWT_SECRET`: segredo aleatório com ao menos 32 caracteres.
- `FRONTEND_URL`: origem pública do próprio Worker, por exemplo `https://seu-worker.seu-subdominio.workers.dev`.
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`: credenciais OAuth com escopo `gmail.send`.
- `GMAIL_FROM`: remetente autorizado no Gmail (opcional).

`PILOT_RETURN_RESET_TOKEN` só pode existir em desenvolvimento. Para recuperação real de senha, o Worker usa o Gmail API com os três segredos OAuth acima; webhook HTTPS e Resend permanecem como fallback. O refresh token de um app Google em modo de teste expira após alguns dias; para operação contínua, renove a autorização ou publique/verifique o app. Isso substitui o SMTP do backend Python, que não é um transporte suportado no runtime Worker.
