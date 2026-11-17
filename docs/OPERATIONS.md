# Operação do piloto

Este documento é um runbook executável. Ele não substitui a configuração dos serviços externos.

## Saúde e monitoramento

- Healthcheck: `GET /api/health`.
- Homecheck: `GET /` deve retornar HTTP 200.
- Logs de erro do Worker ficam no Cloudflare Workers Logs; procure por `Unhandled API error`, `Realtime upgrade failed` e `Mongo`.
- Assets públicos são servidos com HSTS, `X-Frame-Options: DENY`, `Referrer-Policy` restritiva, `Permissions-Policy` mínima e CSP. Se esses cabeçalhos desaparecerem, tratar como regressão de segurança antes de publicar.
- `.github/workflows/uptime.yml` verifica home e healthcheck a cada 15 minutos. Configure a variável de repositório `ACOLHE_BASE_URL` antes de ativar o monitoramento; se ela estiver ausente, o workflow falha explicitamente para não monitorar um ambiente errado. Configure notificações do repositório para receber falhas.
- Para WebSocket, validar abertura de `/api/realtime?session_id=...` com uma conta de piloto e confirmar que o fallback não perde mensagens.

## Backup MongoDB

`.github/workflows/mongodb-backup.yml` executa `mongodump` diariamente e guarda um artefato por 14 dias. Configure os secrets `MONGODB_URI` e `MONGODB_DB` no repositório antes de ativar o piloto. O artefato não deve ser público.

Scripts locais: `ops/backup-mongodb.ps1` e `ops/restore-mongodb.ps1`. Faça um restore mensal em banco separado; nunca restaure diretamente em produção sem janela aprovada.

Para gerar um pacote compartilhável, use `ops/package-release.ps1 -OutputPath <arquivo.zip>`. O empacotador exclui perfis de navegador (`.edge-shot`), caches, dependências, builds locais, logs e outros artefatos de ambiente.

## Recuperação

1. Registrar o incidente e pausar novas comunicações com a instituição.
2. Consultar logs e o último backup íntegro.
3. Restaurar em banco separado.
4. Validar login, vínculo, pedido, confirmação, chat e certificado.
5. Só então planejar a troca de conexão e comunicar a instituição.

## Exclusão de conta

- A exclusão pelo titular e a exclusão administrativa usam uma única transação do MongoDB Atlas. Dados operacionais, conta e evento de auditoria são confirmados juntos; se qualquer etapa falhar, a transação é revertida e a solicitação pode ser repetida.
- Um erro HTTP na exclusão exige verificar os logs do Worker e tentar novamente. Não informe ao usuário que a conta foi removida antes de receber a resposta de sucesso.
- Certificados emitidos permanecem disponíveis para validação; eventos anteriores são desassociados da conta. Backups seguem seu próprio ciclo de retenção.
- Antes de ampliar o volume, confirme que o Atlas usado aceita transações e execute o teste de falha parcial (`npm test` em `cloudflare-worker`). Monitore falhas de transação e o tempo da exclusão nos logs; uma operação que exceda o limite de transação precisa de uma rotina de limpeza retomável.

## Custos e limites

Monitorar mensalmente requests do Worker, Durable Object, MongoDB, armazenamento/egress, e-mails e artefatos de backup. Configurar alertas de orçamento no Cloudflare/MongoDB antes de ampliar o volume.

## Suporte

Registrar horário, impacto, instituição, rota e versão publicada. Nunca pedir conteúdo de conversa, senha ou token em chamado operacional.

## Prazo operacional de resposta

- O prazo começa em `created_at` e corresponde a 48 horas corridas.
- O relógio permanece ativo enquanto o pedido estiver com status `pending`, incluindo fins de semana e feriados.
- O prazo termina quando o profissional aceita, recusa ou propõe um horário. Pedidos cancelados ou encerrados deixam de ser contabilizados como pendentes.
- O banco registra timestamps em UTC; a interface exibe datas e horários em `America/Fortaleza`.
- Os estados apresentados são `aguardando`, `prazo próximo` e `atrasado`.
- A fila de apoio e qualquer redistribuição são manuais, dependem de consentimento e devem ser acionadas pela instituição ou por um responsável designado.
- O prazo de 48 horas é uma meta operacional do piloto, não uma garantia de atendimento clínico, disponibilidade profissional ou resultado terapêutico.
