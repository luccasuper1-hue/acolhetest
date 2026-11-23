# Carga autenticada do staging

Execução de 21/11/2026, somente no ambiente de staging.

- Contas temporárias: 30 estudantes, 1 profissional, 1 instituição e 1 administrador.
- Leituras: `/api/students/me/dashboard`, `/api/professionals/me/dashboard`, `/api/institutions/me/dashboard` e `/api/admin/dashboard`.
- Concorrência: 33 sessões autenticadas × 4 rodadas = 132 requisições.
- Resultado: 132/132 HTTP 200.
- Após deduplicação e pool 4, latência média/p95: estudante 6,3 s/7,1 s; profissional 5,8 s/6,5 s; instituição 5,8 s/6,3 s; administração 3,7 s/4,5 s.

O pool 2 foi testado e elevou o p95 dos estudantes para 26,7 s; por isso foi descartado. O pool 4 foi publicado como menor configuração aprovada para esta carga, sem indisponibilidade. O resultado não autoriza extrapolar para produção ou para uma quantidade específica de usuários sem repetir a medição com o mesmo volume de dados e a mesma região.

## Repetição segura

Os utilitários `ops/seed-authenticated-staging.mjs` e `ops/load-authenticated-staging.mjs` exigem `MONGO_URI` (seed), `LOAD_PREFIX` e `LOAD_PASSWORD` por variável de ambiente. Não há senha padrão no repositório; use uma credencial temporária e remova a massa de teste ao terminar (`CLEANUP=1`). O seed limita seleção/conexão/socket do MongoDB a 15 segundos, e cada login/leitura também tem timeout de 15 segundos. O runner reduz falhas de rede a nomes de erro e não imprime cookies, tokens ou a senha.

### Medição do candidato de lembretes assíncronos — 22/11/2026

O staging `87b3af00-81f8-4d80-af96-4a2a6a27dbe9` executou 40 leituras autenticadas (5 estudantes, 5 rodadas, mais instituição, profissional e administração) após mover lembretes de sessão para `waitUntil`. Houve 40/40 respostas HTTP 200, mas as leituras de estudante ficaram em média 5,5 s e p95 de 6,4 s; profissional p95 7,1 s; instituição p95 6,2 s; administração p95 5,7 s. A alteração reduz trabalho bloqueante e eliminou os erros transitórios desta execução, mas não demonstrou ganho de latência. Ela permanece apenas no staging até uma otimização de consultas/round-trips mais efetiva.

### Medição da leitura paralela de notificações — 22/11/2026

O staging `85ad2524-9b82-4908-80dd-b5a9e52616d0` executou a mesma massa de 40 leituras autenticadas após paralelizar a listagem e a contagem de notificações. Todas as respostas foram HTTP 200, porém os p95 ficaram em 6,6 s (estudante), 7,5 s (profissional), 6,6 s (instituição) e 4,5 s (administração). Não houve melhoria mensurável; a alteração não foi promovida.

## Revalidação de carga — 22/11/2026

- A autenticação do runner passou a ser sequencial e espaçada (`LOGIN_DELAY_MS`, padrão 250 ms), separando rate limit de login da concorrência real dos painéis.
- Com 5 estudantes, 1 profissional, 1 instituição e 1 administrador, após login controlado, houve 8/8 leituras HTTP 200.
- Latência observada: estudantes média 5,8–6,2 s (P95 6,2–6,5 s), profissional 6,0–6,8 s, instituição 4,7–4,9 s, administração 3,4–3,5 s.
- A meta de P95 abaixo de 3 s não foi atingida. O resultado é evidência de gargalo de desempenho ainda aberto, não um critério manipulado para aprovação.
- Uma tentativa com 30 logins simultâneos gerou erros de autenticação por rate limit; ela foi descartada como medição de painel e o runner foi corrigido para não misturar os dois fenômenos.
- A massa `bench-20261122-001`/`bench-20261122-002` foi removida do staging após as medições.
- A tentativa de retirar a expiração do caminho crítico foi publicada apenas no staging (`a2fd166e-e4fe-44fd-9169-b33f70b3250c`) e medida com 5 estudantes: 5/5 respostas 200, mas P95 de 6,8 s. Não houve ganho mensurável nesta massa; a alteração permanece não promovida para produção até uma análise de consultas MongoDB mais detalhada.
- O `explain("executionStats")` inicial revelou ausência total de índices operacionais no staging (`totalKeysExamined: 0`). Após executar `cloudflare-worker/scripts/create-indexes.mjs`, as consultas de solicitações, sessões, disponibilidade e notificações passaram a usar índices, examinando 1–120 documentos conforme o resultado (`totalKeysExamined` igual ao conjunto retornado). A criação foi corrigida para ser idempotente quando `analytics_daily` ainda não existe.
- A aplicação desses índices em produção permanece pendente de autorização e janela operacional; nenhum dado de produção foi alterado nesta rodada.
- Em leitura isolada após os índices, o painel estudantil respondeu HTTP 200 em 3,18 s no staging. Isso melhora a seleção no banco, mas ainda não comprova a meta de P95 sob concorrência; o benchmark concorrente continua acima de 3 s e precisa de nova rodada após estabilizar o rate limit do ambiente.

Com massa populada (30 estudantes com solicitações, sessões, notificações e 120 disponibilidades), o pool 4 manteve 132/132 HTTP 200; estudantes média 15,7 s/p95 17,2 s. Pool 6 ficou em 16,4 s/p95 17,9 s e foi descartado como custo sem ganho.
