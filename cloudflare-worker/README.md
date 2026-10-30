# API do Acolhe no Cloudflare Workers

Esta pasta é uma migração **local e isolada** da API FastAPI. Ela não é publicada, não tem acesso às credenciais de produção e não altera o repositório remoto.

## Arquitetura alvo

Um único Worker entrega os arquivos estáticos do React e atende as chamadas em `/api/*`. O banco continua sendo o MongoDB Atlas. As variáveis de produção serão configuradas apenas na etapa de publicação:

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `FRONTEND_URL`

O Worker usa um Durable Object como ponto de integração com o MongoDB, evitando criar uma conexão nova a cada chamada. Isso segue a recomendação do Cloudflare para Atlas.

## Estado da migração

- [x] Separar uma cópia local para o trabalho.
- [x] Mapear as rotas do FastAPI.
- [x] Criar Worker, JWT, cookies seguros, lock de login, CORS e roteamento de `/api/*`.
- [x] Migrar regras de aluno, profissional, instituição, administração e métricas.
- [x] Alterar o frontend desta cópia para usar `/api` no mesmo domínio, sem URL externa.
- [ ] Testar contra um banco Atlas de desenvolvimento, sem reutilizar produção.
- [ ] Fazer publicação manual, somente após revisar as variáveis e criar um Atlas de desenvolvimento.

## Build único

No diretório `frontend`, instale as dependências e execute `npm run build`. Isso produz `frontend/build`.
No diretório desta pasta, `npm run verify` valida o Worker e seu pacote de assets, sem publicar. O comando `npm run deploy` primeiro gera o frontend e só então faz a publicação — ele existe apenas para uma futura revisão manual, não deve ser rodado nesta cópia.

Antes de qualquer teste contra um Atlas de desenvolvimento novo, execute `npm run indexes` nesta pasta com `MONGO_URL` e `DB_NAME` temporariamente definidos no seu terminal. Ele mantém os mesmos índices únicos que o seed Python criava; não execute esse comando contra produção sem revisar o banco.

Para CI do Cloudflare, o repositório deve ter o diretório raiz na raiz do projeto e usar uma etapa que instale dependências de `frontend` e de `cloudflare-worker`, gere `frontend/build` e execute `wrangler deploy` a partir de `cloudflare-worker`. O diretório de assets é deliberadamente `../frontend/build`.

## Variáveis da futura publicação

Crie-as como segredos no Cloudflare, sem gravá-las em código:

- `MONGO_URL`: URI do Atlas de um banco de desenvolvimento primeiro.
- `DB_NAME`: nome do banco correspondente.
- `JWT_SECRET`: segredo aleatório com ao menos 32 caracteres.
- `FRONTEND_URL`: origem pública do próprio Worker, por exemplo `https://seu-worker.seu-subdominio.workers.dev`.

`PILOT_RETURN_RESET_TOKEN` só pode existir em desenvolvimento. Para recuperação real de senha, configure `RESET_EMAIL_WEBHOOK_URL` e `RESET_EMAIL_WEBHOOK_TOKEN` para um adaptador HTTPS do provedor de e-mail: ele recebe `POST` autenticado por Bearer com `to`, `subject` e `text`. Isso substitui o SMTP do backend Python, que não é um transporte suportado no runtime Worker. Não use este diretório para publicar em produção enquanto as etapas pendentes existirem.
