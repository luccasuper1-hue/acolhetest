# Acolhe MVP

O Acolhe organiza o primeiro acesso de estudantes a profissionais vinculados à instituição.

## Arquitetura oficial de produção

Produção usa um único **Cloudflare Worker**: ele entrega o frontend e a API em `/api`. O realtime usa um **Durable Object** (`MongoGateway`) como gateway do **MongoDB Atlas**. Segredos ficam nas configurações do Cloudflare, nunca no repositório.

- Frontend: `frontend/` (Vite/React), publicado como assets do Worker.
- API e realtime: `cloudflare-worker/`.
- Persistência: MongoDB Atlas acessado pelo Durable Object.
- Operação: `docs/` e `ops/`.

`backend/` é a implementação FastAPI histórica/local. Ela não é o caminho de produção.

## Documentação do piloto

- [Arquitetura](docs/ARCHITECTURE.md)
- [Operação, backups e recuperação](docs/OPERATIONS.md)
- [Privacidade e governança](docs/PRIVACY-GOVERNANCE.md)
- [Governança de dados e registro de tratamento](docs/DATA-GOVERNANCE.md)
- [Retenção e exclusão](docs/RETENTION-POLICY.md)
- [Processo de incidentes](docs/INCIDENT-RESPONSE.md)
- [Registro de operações de tratamento](docs/PROCESSING-RECORD.md)
- [Mapa de modularização](docs/MODULARIZATION-MAP.md)
- [Runbooks de operação, restore, custos e segredos](docs/INCIDENT-RUNBOOK.md)
- [Onboarding institucional](docs/ONBOARDING-INSTITUTION.md)
- [Checklist ponta a ponta](docs/PILOT-E2E-CHECKLIST.md)

Instruções de deploy: [DEPLOY.md](DEPLOY.md).
Estado da versão publicada: [docs/RELEASE-STATUS.md](docs/RELEASE-STATUS.md).
