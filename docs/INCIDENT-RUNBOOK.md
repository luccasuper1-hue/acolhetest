# Runbook de incidentes

## Banco indisponível

1. Confirmar `GET /api/live` e `GET /api/ready`; não confundir liveness com prontidão.
2. Verificar logs agregados de `mongo_query_slow`, `api_unhandled_error` e falha de readiness, sem exportar payloads.
3. Pausar mutações administrativas se houver risco de inconsistência; informar a instituição.
4. Restaurar em ambiente separado conforme `docs/RESTORE-RUNBOOK.md` e executar smoke/E2E reduzido.

## Worker indisponível

Confirmar domínio, headers e limites do provedor. Não alterar produção durante um incidente sem janela autorizada. Se houver versão anterior validada, aplicar rollback documentado e repetir smoke.

## E-mail indisponível

O painel continua sendo a fonte primária. A fila usa estados, backoff e chave de deduplicação; não reenviar manualmente sem verificar `email_delivery`.

## Realtime indisponível

Usar o fallback REST/polling do painel. Confirmar `realtime_upgrade_failed`, validar escopo da sessão e não expor mensagens em logs.
