# Mapa de modularização

Status: mapa inicial da rodada de profissionalização. A arquitetura oficial continua sendo Cloudflare Worker + Durable Objects + MongoDB Atlas; FastAPI permanece legado/local.

## Estado atual

| Área | Arquivo atual | Tamanho aproximado | Responsabilidades observadas | Risco |
|---|---|---:|---|---|
| API | `cloudflare-worker/src/routes.ts` | 1.540 linhas | autenticação, perfis, agenda, solicitações, SLA, chat, notificações, métricas, certificados, administração | alto acoplamento e regressões difíceis de localizar |
| Persistência | `cloudflare-worker/src/db.ts` | 916 linhas | gateway Durable Object, pool MongoDB, locks, queries, transações, exclusão e índices | alto acoplamento entre domínio e armazenamento |
| Núcleo compartilhado | `cloudflare-worker/src/core.ts` | 161 linhas | respostas HTTP, autenticação, projeções públicas, notificações e helpers | dependência transversal; deve continuar pequeno |
| Interface principal | `frontend/src/mvp/MvpShell.jsx` | 521 linhas | shell autenticado, navegação de papéis, privacidade e áreas comuns | mistura composição e regras de apresentação |
| Administração | `frontend/src/mvp/AdminArea.jsx` | 339 linhas | métricas, instituições, pendências, certificados e histórico | vários cards e consultas no mesmo componente |

## Dependências principais

```text
index.ts
  -> routes.ts -> core.ts -> db.ts -> MongoGateway (Durable Object) -> MongoDB Atlas
  -> runtime.ts (particionamento por APP_ENV)
  -> observability.ts (logs operacionais sem payload)

MvpShell.jsx
  -> api.js / realtime.js
  -> StudentArea, ProfessionalArea, InstitutionArea, AdminArea
  -> componentes de privacidade, cookies e navegação
```

## Divisão proposta, sem alteração de contratos

1. `src/domains/privacy.ts`: versões de consentimento, classificação etária, retenção declarativa e projeções de exportação. Funções puras, sem acesso a banco.
2. `src/domains/operations.ts`: nomes de eventos operacionais, limites e normalização de campos de log. Sem dados de usuário.
3. `src/domains/notifications.ts`: fan-out, retries e paginação de notificações, extraído de `core.ts`/`routes.ts` após cobertura de contrato.
4. `src/domains/scheduling.ts`: regras de capacidade, sobreposição e SLA, extraídas de `routes.ts`/`db.ts` em uma etapa posterior.
5. `src/domains/admin.ts`: projeções administrativas e agregações, mantendo `institution_id` e as allowlists atuais.
6. Frontend: extrair cards puros de `AdminArea.jsx` e seções de privacidade do `MvpShell.jsx`; os componentes continuam recebendo os mesmos dados e callbacks.

## Ordem segura

As duas primeiras extrações são puras e reversíveis. Cada extração deve manter as rotas, status HTTP, payloads, guards e filtros por instituição. A divisão de agenda, notificações e administração só deve ocorrer depois de testes de contrato dedicados.

## Não fazer nesta rodada

- não reescrever `routes.ts` ou `db.ts` inteiro;
- não alterar nomes de coleções, índices ou bindings;
- não mover consultas sem preservar projeções e limites;
- não publicar alterações sem todos os gates do relatório final.
