# Auditoria local de latência

Data da rodada: 2026-11-22  
Ambiente: local; nenhum deploy, smoke remoto, E2E remoto, carga ou WebSocket real foi executado nesta rodada.

## Baseline disponível

Não há P50/P95/P99 remoto honesto nesta janela: a conta Cloudflare está sob restrição de cota e os painéis autenticados não foram reabertos repetidamente. Os valores históricos de 5–17 s são sinais de gargalo, não uma medição reproduzida nesta máquina.

Validações locais antes/depois:

- Frontend: 311 testes aprovados (baseline anterior: 308).
- Worker: 80 testes aprovados.
- TypeScript do Worker: aprovado.
- Lint do frontend: aprovado.
- Build Vite: aprovado.
- Bundle budget: aprovado para o chunk principal (`index-CUTFIkQ8.js`, 159.278 bytes).

## Alterações desta rodada

- Métricas institucionais passaram a usar agregações MongoDB bounded, em vez de materializar milhares de documentos no Worker.
- Contagens de estudantes e profissionais do painel administrativo passaram a ser agregadas no banco.
- O gateway ganhou `aggregate()` somente leitura, com `maxTimeMS` padrão de 3 segundos e log operacional apenas para agregações lentas.
- Foram adicionados índices compostos para solicitações diretas, eventos e feedback, preservando criação idempotente.
- O período das métricas continua baseado na primeira solicitação observada, e tempos de resposta negativos são descartados.
- Logs de requisições lentas passaram a incluir ambiente e tamanho de resposta quando fornecido pelo runtime; nenhum dado pessoal é registrado.
- O gateway passou a expor planos de leitura reversíveis para `getStudentDashboard()`, `getProfessionalDashboard()`, `getInstitutionDashboard()` e `getAdminSummary()`. As rotas autenticadas já usam esses planos para reduzir chamadas Worker → Durable Object.
- O primeiro carregamento foi estreitado: históricos, listas administrativas, certificados e horários agora têm limites menores e projeções explícitas; as rotas dedicadas continuam disponíveis para carregamento posterior.
- A paginação por cursor foi adicionada de forma opt-in (`?paged=1`) para requests do estudante, usuários administrativos e requests administrativos. O contrato antigo continua retornando arrays.
- O roteiro [explain-mongodb.mjs](../ops/explain-mongodb.mjs) executa `explain("executionStats")` diretamente no Atlas e imprime somente estágio, chaves, documentos, retorno e duração; URI, filtros e documentos nunca são exibidos.
- O estudante abre o histórico sob demanda; o carregamento usa `AbortController` e o dashboard inicial consulta apenas o resumo.
- Certificado do profissional e analytics/auditoria do administrador deixaram de bloquear a primeira tela útil; falhas dessas seções são isoladas e recuperáveis.

## O que ainda não foi comprovado

- P50/P95/P99 real dos quatro painéis.
- `IXSCAN`/`executionStats` no Atlas de produção.
- Consumo de Durable Objects.
- Efeito de cache no tráfego real.

Esses itens só devem ser medidos depois do reset da cota, em rodadas pequenas: healthcheck único, smoke mínimo, uma execução E2E, carga de 5 usuários e parada imediata ao atingir 70–80% do orçamento, qualquer 429/503/timeout ou P95 acima de 3 s.

## Riscos restantes

- As agregações pressupõem timestamps ISO válidos, como os gravados pelos fluxos atuais.
- O painel ainda possui seções históricas que podem ser carregadas em chamadas separadas; a próxima etapa é medir o ganho de carregamento progressivo sem alterar contratos.
- Nenhuma meta de 1–1,5 s deve ser declarada atingida sem uma medição pós-reset.
