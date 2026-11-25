# Estado do release

## Referência atual — 23/11/2026

- Commit/tag reproduzível: `4c02cc9` — remoção do Radar profissional e preservação dos fluxos operacionais.
- Produção: `d75a098a-49e4-4895-a356-a87ee14f612a` — `APP_ENV=production`.
- Staging: `5402ef6a-759a-46ca-9b5c-b81a3134db6d` — `APP_ENV=staging`.
- Origens: `https://acolhetest.luccasuper1.workers.dev` e `https://acolhetest-staging.luccasuper1.workers.dev`.
- Health GET: HTTP 200 e `database: ok` nos dois ambientes.
- Gates locais: Worker 84/84; frontend 315/315; TypeScript, lint, build e bundle budget aprovados.
- Smoke pós-publicação: home HTTP 200; health respondeu HTTP 503 com banco indisponível no momento da verificação. A divergência de cache do healthcheck (`public, max-age=5` versus `no-store` no verificador) permanece pendente.
- O staging continua na versão anterior; esta correção foi promovida somente para produção, conforme a autorização de publicação.
- As alterações históricas do antigo Insights conversacional permanecem registradas abaixo apenas para rastreabilidade; não fazem parte do estado atual e não representam recurso disponível.
- Probes anônimas de `/api/live`, `/api/ready` e `/api/health` agora usam deduplicação no isolate e cache curto no edge; o liveness não consulta o banco.
- O shell autenticado limita refresh disparado por troca de aba a uma janela de 15 segundos, evitando bursts de chamadas duplicadas.
- O dashboard profissional passou a buscar relações auxiliares no mesmo RPC agregado do `MongoGateway`, reduzindo round-trips sem alterar o contrato público.
- O dashboard estudantil passou a reutilizar profissionais e horários do plano agregado, evitando leituras duplicadas ao abrir o painel.
- As dez agregações das métricas institucionais agora atravessam o gateway em um único batch limitado e allowlisted.
- As contagens do resumo administrativo também usam um batch allowlisted, removendo a sequência de RPCs individuais.
- A lista de instituições do admin reutiliza as contagens já carregadas pelo resumo, sem nova leitura de coleção.
- Beacons de analytics repetidos no mesmo isolate agora são coalescidos por 30 segundos antes de abrir um RPC ao Durable Object.
- A manutenção do cron agora carrega pedidos expirados e retries de e-mail em um único snapshot do gateway, evitando duas invocações e varreduras independentes quando não há trabalho.
- O contexto autenticado (conta, instituição e perfil) agora é carregado em um único RPC e o perfil é reutilizado durante a requisição, reduzindo saltos repetidos sem alterar guards.
- A home pública agora é a landing principal do Acolhe: apresenta o piloto, mantém o acesso existente como ação secundária e oferece contato no CTA final e no footer.
- Os contatos “Falar com a equipe” do footer e do CTA final agora abrem diretamente `mailto:acolheiluminado@gmail.com`.
- O CTA final voltou a exibir somente “Começar agora”; o contato permanece disponível no footer.
- A IA conversacional foi removida do produto nesta revisão. Não há binding de IA, rota de Insights, provider, prompt ou envio de dados a modelo.
- O ícone flutuante com a marca e a estrela amarela permanece apenas como marcador visual de automação futura; ele não abre chat nem executa chamadas.
- As métricas institucionais e os demais fluxos operacionais permanecem determinísticos.
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
