# Operação do piloto

Este documento é um runbook executável. Ele não substitui a configuração dos serviços externos.

## Saúde e monitoramento

- Healthcheck: `GET /api/health`.
- Homecheck: `GET /` deve retornar HTTP 200.
- Logs de erro do Worker ficam no Cloudflare Workers Logs; procure por `Unhandled API error`, `Realtime upgrade failed` e `Mongo`.
- `.github/workflows/uptime.yml` verifica home e healthcheck a cada 15 minutos. Configure notificações do repositório para receber falhas.
- Para WebSocket, validar abertura de `/api/realtime?session_id=...` com uma conta de piloto e confirmar que o fallback não perde mensagens.

## Backup MongoDB

`.github/workflows/mongodb-backup.yml` executa `mongodump` diariamente e guarda um artefato por 14 dias. Configure os secrets `MONGODB_URI` e `MONGODB_DB` no repositório antes de ativar o piloto. O artefato não deve ser público.

Scripts locais: `ops/backup-mongodb.ps1` e `ops/restore-mongodb.ps1`. Faça um restore mensal em banco separado; nunca restaure diretamente em produção sem janela aprovada.

## Recuperação

1. Registrar o incidente e pausar novas comunicações com a instituição.
2. Consultar logs e o último backup íntegro.
3. Restaurar em banco separado.
4. Validar login, vínculo, pedido, confirmação, chat e certificado.
5. Só então planejar a troca de conexão e comunicar a instituição.

## Custos e limites

Monitorar mensalmente requests do Worker, Durable Object, MongoDB, armazenamento/egress, e-mails e artefatos de backup. Configurar alertas de orçamento no Cloudflare/MongoDB antes de ampliar o volume.

## Suporte

Registrar horário, impacto, instituição, rota e versão publicada. Nunca pedir conteúdo de conversa, senha ou token em chamado operacional.
