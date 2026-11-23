# Deploy no Cloudflare

Este repositório publica o Acolhe como **um único Cloudflare Worker**: o mesmo serviço entrega o frontend e atende a API em `/api`.

## Configuração do Git integration

No Cloudflare Workers, conecte o repositório `luccasuper1-hue/AcolheMVP2` e configure:

| Campo | Valor |
| --- | --- |
| Branch de produção | `main` |
| Diretório raiz | `cloudflare-worker` |
| Comando de build | `npm run build:frontend` |
| Comando de deploy | `npx wrangler deploy` |

O comando de build instala exatamente as dependências travadas em `frontend/package-lock.json` e gera `frontend/build`; o Worker usa essa pasta como assets estáticos.

## Variáveis e segredos de produção

Crie no Cloudflare, sem gravar valores no Git:

| Nome | Tipo | Finalidade |
| --- | --- | --- |
| `MONGO_URL` | Secret | URI do MongoDB Atlas. |
| `DB_NAME` | Variável | Nome do banco, por exemplo `acolhe`. |
| `JWT_SECRET` | Secret | Chave aleatória forte (mínimo 32 caracteres). |
| `FRONTEND_URL` | Variável | Origem pública exata do Worker. |
| `APP_ENV` | Variável | `production`. |
| `GMAIL_CLIENT_ID` | Secret | Client ID OAuth do projeto Google usado para enviar e-mails. |
| `GMAIL_CLIENT_SECRET` | Secret | Client secret OAuth correspondente. |
| `GMAIL_REFRESH_TOKEN` | Secret | Refresh token do Gmail autorizado com o escopo `gmail.send`. |
| `GMAIL_FROM` | Variável | Remetente autorizado (opcional; padrão `acolheiluminado@gmail.com`). |

Não crie `PILOT_RETURN_RESET_TOKEN` em produção. A recuperação de senha tenta o Gmail API primeiro; webhook HTTPS e Resend permanecem como fallback. O OAuth em modo de teste do Google expira refresh tokens após alguns dias, então será necessário renovar a autorização ou publicar/verificar o app antes de uso contínuo.

O primeiro deploy executa automaticamente a migração do Durable Object `MongoGateway`. Antes de publicar, confirme que o Atlas aceita conexões do Worker e use um banco de desenvolvimento se ainda estiver validando dados.

## Rollback seguro

Antes de comparar versões, consulte `docs/RELEASE-STATUS.md`; ele identifica a versão pública coberta pelo último smoke aprovado.

Se o smoke test pós-publicação encontrar regressão, não altere o banco nem publique uma correção às pressas:

1. Registre a versão publicada, o horário, o endpoint afetado e o resultado do `/api/health`.
2. No painel do Cloudflare Workers, abra **Deployments/Versions**, selecione a última versão comprovadamente saudável e use **Rollback**.
3. Confirme `GET /api/health` (e `HEAD /api/health`) com HTTP 200 antes de liberar o uso novamente.
4. Execute `ops/smoke-test.ps1 -BaseUrl <base-url>` e, em seguida, o smoke test de login, carregamento de painel e leitura de notificações; registre o resultado em `docs/INCIDENT-DRILL-RESULTS.md`.
5. Só depois investigue a causa e planeje uma nova publicação. Rollback de código não desfaz migrações ou dados já gravados; restauração do Atlas exige o runbook de recuperação e aprovação separada.

## Smoke test pós-publicação

No diretório raiz, execute `ops/smoke-test.ps1 -BaseUrl <base-url>` para validar automaticamente home, healthcheck GET/HEAD, banco saudável e headers de segurança. O comando não exige secrets nem grava respostas.

Após um deploy e smoke aprovados, atualize juntos `docs/RELEASE-STATUS.md`, `docs/INCIDENT-DRILL-RESULTS.md` e `docs/PILOT-E2E-EVIDENCE.md` com a versão retornada pelo Wrangler; até essa atualização, a versão anterior continua sendo a referência oficial.

Execute contra a origem publicada, sem incluir credenciais em comandos ou logs:

- `GET /api/health` deve responder HTTP 200 e `ok: true`.
- `HEAD /api/health` deve responder HTTP 200.
- `GET /` deve entregar o shell público sem redirecionar para uma área autenticada.
- `GET /assets/<arquivo-do-build>` deve responder com cache imutável e `x-content-type-options: nosniff`.
- Em uma sessão de teste, abrir login, painel e notificações; em seguida, confirmar que logout retorna à entrada.

Registre data, versão do Worker, origem, resultado e qualquer aviso em `docs/INCIDENT-DRILL-RESULTS.md`.
