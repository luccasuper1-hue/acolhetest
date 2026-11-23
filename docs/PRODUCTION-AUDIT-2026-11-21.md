# Auditoria de prontidão para produção — 21/11/2026

## Escopo

Auditoria local do checkout do Acolhe com foco no caminho oficial Cloudflare Worker + Durable Object + MongoDB Atlas. O FastAPI foi tratado somente como legado/local. Nenhum segredo, conta, registro de produção ou migração foi alterado.

## Mapeamento

- 186 arquivos de projeto fora de dependências, builds, caches e `.git`.
- 94 arquivos JS/TS/JSX/TSX.
- 19 arquivos de teste e 18 documentos Markdown.
- Frontend Vite/React em `frontend/`.
- API, cron e WebSocket em `cloudflare-worker/src/`.
- Gateway MongoDB e Durable Object em `cloudflare-worker/src/db.ts`.
- Persistência oficial: MongoDB Atlas; segredos somente no ambiente do Worker.
- Backups, restore, smoke, carga e migrações em `ops/`.
- CI em `.github/workflows/` para qualidade, uptime e backup.

## Prioridades encontradas

### Atualização v9.1 — disponibilidade e realtime

- O WebSocket usava o identificador fixo de produção, enquanto o gateway e o broadcast já separavam staging. Isso foi corrigido com `src/runtime.ts` e teste de contrato dedicado.
- O antigo `/api/health` já funcionava como readiness, mas não havia liveness explícito. `/api/live` agora responde sem consultar o Mongo; `/api/ready` e `/api/health` continuam dependentes do ping do gateway e retornam 503 quando a dependência está indisponível.
- A causa exata do 503 publicado permanece delimitada: o Cloudflare informou bloqueio por cota de Durable Objects no staging; não há evidência suficiente para afirmar que essa foi a única causa do acesso ao Mongo.

### P0 — bloqueadores

Nenhum bloqueador local evidente após a leitura de autenticação, autorização por instituição, menores, concorrência de agenda, exclusão transacional, cookies/CSRF, WebSocket e exposição pública.

### P1 — tratados nesta rodada

- O gateway agora registra apenas consultas Mongo lentas (a partir de 1 segundo), com coleção, operação, duração, limite e quantidade de resultados — sem filtros, documentos ou identificadores. Isso cria evidência para otimizar os painéis sem expor dados.
- O Worker também registra requisições API lentas (a partir de 1 segundo), com método, rota, status e duração; o próximo benchmark poderá separar latência de aplicação e de consulta.
- Mensagens REST do chat não tinham limite de negócio por usuário/conversa. Isso permitia volume excessivo mesmo com o limite de transporte do WebSocket.
- O gateway agora aplica janela de 30 mensagens por 60 segundos por usuário e conversa, com resposta `429` e `Retry-After` antes da persistência.
- Logs operacionais do Worker foram centralizados em eventos JSON com campos limitados; os runners de staging não têm senha padrão, usam timeouts de 15 segundos e falham antes de qualquer conexão sem credenciais.
- O CI agora recria e verifica o pacote distribuível em um job dedicado.

### P1 — ainda pendentes de evidência externa

- Reexecutar E2E autenticado completo contra staging com contas de teste disponíveis.
- Reexecutar restore em banco separado e registrar versão/horário/resultado.
- Executar carga atual, 10x e múltiplas instituições contra ambiente controlado.
- Medir latência real de dispositivos móveis; o navegador automatizado não estava disponível neste ambiente.

### P2 — dívida técnica

- `routes.ts` (1.583 linhas) e `db.ts` (968 linhas) concentram muitas responsabilidades; a divisão deve ser feita por fatias, após preservar contratos atuais.
- O tipo de documento schemaless ainda usa `Record<string, any>`; uma migração gradual para tipos por coleção é preferível a uma troca ampla que possa quebrar fluxos estáveis.
- O rate limit em memória é adequado ao Durable Object único atual, mas deve ser recalibrado se o particionamento do gateway mudar.
- SLOs do piloto foram formalizados no runbook; os valores observados de produção continuam pendentes de uma série real de uptime, latência e restore.

## Evidências executadas

- Frontend: 306 testes aprovados.
- Worker: 74 testes aprovados.
- FastAPI legado/local: 8 testes aprovados e 31 ignorados por dependerem de serviços locais externos, com `PYTHONPATH=backend`.
- TypeScript do Worker: aprovado.
- ESLint do frontend: aprovado.
- Build de produção Vite: aprovado.
- Orçamento do bundle inicial: aprovado (`index-DuNwWWYc.js`, 159.278 bytes; limite 250.000).
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades no frontend e no Worker.
- `wrangler deploy --dry-run`: aprovado; permanece o aviso conhecido do `unenv/whatwg-url`.
- Pacote de release temporário: 193 entradas, verificador aprovado, sem caches/perfis/segredos.
- Contratos locais: 74 testes do Worker e 306 do frontend continuam verdes após os ciclos de observabilidade e pipeline.
- Smoke público e staging: home, GET/HEAD health, arquivos de descoberta e headers de segurança aprovados.

## Decisão de publicação

Os gates locais passaram, mas o E2E autenticado, restore separado e carga real exigem credenciais/serviços externos. A publicação autorizada da versão `77d922f6-261c-4d08-aade-e8b5552ada0e` ocorreu, porém o smoke retornou HTTP 503 com banco indisponível; por isso ela não é considerada uma versão saudável nem substitui a referência anterior.

## Rollback

Se a melhoria for publicada após os gates externos, registrar a versão do Worker, executar `ops/smoke-test.ps1` e reverter pela versão saudável no painel Cloudflare. Rollback de código não desfaz alterações de dados; qualquer restauração de banco deve seguir `ops/restore-mongodb.ps1` com confirmação explícita e ambiente separado.
