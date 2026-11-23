# Estado do release

## Referência atual — 22/11/2026

- Commit/tag reproduzível: atualização do modelo Workers AI após a publicação de 22/11/2026.
- Produção: `5fb50e7f-f1e5-47cb-8ad7-b33e26b2d732` — `APP_ENV=production`.
- Staging: `9f0f7337-de12-4eeb-88eb-5871551af8cf` — `APP_ENV=staging`.
- Origens: `https://acolhetest.luccasuper1.workers.dev` e `https://acolhetest-staging.luccasuper1.workers.dev`.
- Health GET: HTTP 200 e `database: ok` nos dois ambientes.
- Gates locais: Worker 85/85; frontend 314/314; TypeScript, lint, build e bundle budget aprovados.
- O staging foi publicado a partir da mesma build local da produção; os hashes dos assets são idênticos.
- O Acolhe Insights usa `@cf/meta/llama-3.1-8b-instruct-fast`; a variante AWQ anterior estava depreciada e causava fallback seguro.
- E2E autenticado e carga não foram executados nesta promoção; permanecem validações separadas, não inventadas.

- Última publicação autorizada: ciclo 678 — preenchimento integral do card de pedido em 22/11/2026.
- Versão do Worker: `57c02561-a44a-487d-9b39-2a6eaf3b42af`.
- Origem pública: `https://acolhetest.luccasuper1.workers.dev`.
- Smoke pós-publicação: aprovado para home, liveness/readiness/health GET/HEAD, arquivos de descoberta e headers de segurança em 2026-11-22 UTC.
- Staging validado antes da promoção: `ead148a0-80ef-4a8a-86e9-2f233440d576`; smoke, E2E autenticado, restore separado e carga controlada aprovados.
- Smoke pós-promoção em produção: aprovado para home, liveness/readiness GET/HEAD, arquivos de descoberta e headers de segurança.
- Esta publicação inclui a divisão de gráficos, animações e componentes Radix em chunks de fornecedor; o chunk inicial caiu para aproximadamente 159 kB.
- O ciclo 674 inclui os refinamentos dos ciclos 672–674: launcher de mensagens com etiqueta e contagem estáveis e proteção contra overflow no mobile, com gates completos e smoke público pós-deploy aprovado.
- Próximo marco de publicação: próximo lote de três ciclos, condicionado ao gate de testes, build e smoke.

O ciclo 250 incluiu os refinamentos locais dos ciclos 201–249, build de produção, pacote verificado e smoke público aprovado. Este registro deve ser atualizado junto com cada publicação autorizada. Alterações locais posteriores não são consideradas parte desta versão até passarem pelo gate de deploy e por um novo smoke test.
- Esta publicação inclui a leitura paralelizada dos painéis autenticados, o healthcheck sem contagem da coleção de usuários, a projeção mínima na validação pública de certificados, a deduplicação de consultas compartilhadas e o pool MongoDB limitado a 4 conexões por Durable Object, com `maxIdleTimeMS` de 30 segundos.
- Esta promoção inclui a separação liveness/readiness, isolamento do Durable Object por ambiente, telemetria segura de requisições/consultas lentas e o E2E autenticado controlado validado no staging.
- Esta promoção inclui os documentos de governança/retensão/incidentes, o mapa de modularização, os módulos compartilhados de privacidade/operações e a sanitização centralizada de logs.
- Tentativa autorizada em 21/11/2026: versão `77d922f6-261c-4d08-aade-e8b5552ada0e` foi enviada, mas o smoke GET/HEAD `/api/health` retornou HTTP 503 por indisponibilidade do banco associada ao bloqueio diário de Durable Objects. Ela não substitui a versão de referência até a repetição do smoke após o reset da cota.
