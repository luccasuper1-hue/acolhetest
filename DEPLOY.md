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
