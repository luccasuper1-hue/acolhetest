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

Não crie `PILOT_RETURN_RESET_TOKEN` em produção. Para recuperação de senha por e-mail, adicione também `RESET_EMAIL_WEBHOOK_URL` e `RESET_EMAIL_WEBHOOK_TOKEN` quando um provedor de e-mail HTTPS estiver pronto.

O primeiro deploy executa automaticamente a migração do Durable Object `MongoGateway`. Antes de publicar, confirme que o Atlas aceita conexões do Worker e use um banco de desenvolvimento se ainda estiver validando dados.
