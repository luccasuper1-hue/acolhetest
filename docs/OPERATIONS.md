# Operação do piloto

Este documento é um runbook executável. Ele não substitui a configuração dos serviços externos.

## Saúde e monitoramento

### SLOs do piloto

- **Disponibilidade pública:** meta de 99,5% por mês para `GET /` e `GET /api/health`. O workflow de uptime está temporariamente pausado no agendamento automático para evitar consumo de Durable Objects; quando reativado, a medição será uma amostra operacional e não substituirá o relatório de disponibilidade do provedor.
- **Latência pública:** registrar p95 separado para home e healthcheck, sem incluir falhas de rede do monitor. Não declarar um p95 de produção antes de existir uma série suficiente de observações.
- **API autenticada:** objetivo operacional de p95 abaixo de 2 segundos para leituras de painel em massa de piloto; o valor precisa ser medido com contas de teste e massa identificadas no ambiente.
- **Recuperação:** RPO alvo de 24 horas (janela do backup diário) e RTO alvo de 4 horas para troca por banco restaurado, sujeitos à disponibilidade do Atlas, Cloudflare e operador autorizado. O primeiro restore separado deve registrar os tempos efetivos.
- **E-mail e realtime:** falhas não devem bloquear a transição primária já persistida; alertas devem acompanhar `email_delivery_failed`, falhas de upgrade WebSocket e perda de heartbeat. A taxa aceitável será calibrada durante o piloto.

Essas metas são critérios operacionais do piloto, não garantias clínicas nem compromisso contratual antes de revisão jurídica e comercial.

- O workflow `.github/workflows/quality.yml` executa testes e build do frontend, testes e TypeScript do Worker em cada push e pull request; publicação continua separada e manual.
- Healthcheck: `GET /api/health`.
- Smoke test local/publicado: `ops/smoke-test.ps1 -BaseUrl https://seu-worker.example` valida home, `GET/HEAD /api/health`, banco saudável, schema mínimo do healthcheck, `Cache-Control: no-store`, `robots.txt` (`text/plain`), `sitemap.xml` (XML), rotas públicas críticas e headers de segurança; o script não grava respostas nem dados do ambiente e falha na primeira resposta inválida para facilitar diagnóstico manual.
- Homecheck: `GET /` deve retornar HTTP 200.
- Logs de erro do Worker ficam no Cloudflare Workers Logs; procure por `Unhandled API error`, `Realtime upgrade failed` e `Mongo`.
- Assets públicos são servidos com HSTS, `X-Frame-Options: DENY`, `Referrer-Policy` restritiva, `Permissions-Policy` mínima e CSP. Se esses cabeçalhos desaparecerem, tratar como regressão de segurança antes de publicar.
- `.github/workflows/uptime.yml` mantém apenas execução manual durante a investigação de cota. Quando reativado, verifica home, healthcheck, o MIME e o apontamento de `robots.txt` (`text/plain`) e o MIME/conteúdo mínimo de `sitemap.xml` (XML); configure `ACOLHE_BASE_URL` e `ACOLHE_ENV` (`staging` ou `production`) antes de usá-lo.
- Para WebSocket, validar abertura de `/api/realtime?session_id=...` com uma conta de piloto e confirmar que o fallback não perde mensagens.
- Entrega de e-mail: notificações individuais persistem `email_delivery` com estado `pending`, `sending`, `sent` ou `failed`. A rotina automática de retry está pausada junto com o cron durante a investigação de cota; quando reativada, retoma tentativas pendentes ou claims travados, usa backoff limitado e encerra após cinco tentativas. A chave de deduplicação da notificação continua sendo a fonte de idempotência; falha de e-mail não cria uma segunda notificação no painel.
- O índice `notifications_email_delivery_retry` cobre o estado e os horários de retry. Registros históricos sem `email_delivery` são ignorados pelo worker e continuam válidos como histórico do painel.
- Cada retry agendado gera o evento agregado `email_delivery_retry_scheduled`; falhas terminais geram `email_delivery_failed`. Alertar quando `email_delivery_failed` exceder o limite operacional definido para o piloto, sem usar destinatários, conteúdo ou credenciais no alerta.
- Esses eventos técnicos permanecem disponíveis para alertas e retenção técnica, mas são excluídos do feed de auditoria operacional e da contagem agregada exibida no painel administrativo.
- Esses dois eventos técnicos têm retenção automática de 180 dias por índice parcial; eventos de auditoria e governança não são atingidos por esse TTL.
- Avisos de cadastro, convite profissional, aprovação institucional e alteração/redefinição concluída de senha usam a mesma fila quando vinculados a uma conta. E-mails de recuperação que carregam o token secreto continuam sendo enviados diretamente e não são persistidos como notificação.

## Backup MongoDB

`.github/workflows/mongodb-backup.yml` executa `mongodump` diariamente e guarda um artefato pelo número de dias definido em `BACKUP_RETENTION_DAYS` (14 por padrão). Configure os secrets `MONGODB_URI` e `MONGODB_DB` e a variável `APP_ENV` (`staging` ou `production`) no repositório antes de ativar o piloto. O artefato não deve ser público.

Verificação operacional sem abrir o conteúdo: no GitHub Actions, confirme que a última execução do workflow terminou com sucesso, que o artefato `acolhe-mongodb-<run_id>` existe e que sua retenção está em 14 dias. Não baixe o arquivo para validar a rotina; qualquer restore deve ocorrer somente em ambiente separado e seguir o procedimento abaixo.

Scripts locais: `ops/backup-mongodb.ps1` e `ops/restore-mongodb.ps1`. Faça um restore mensal em banco separado; nunca restaure diretamente em produção sem janela aprovada. O restore exige a confirmação explícita `-ConfirmDrop` porque usa `mongorestore --drop`; valide URI, banco e arquivo antes de informar essa opção.
Não copie URI, nome de banco, senhas ou argumentos completos para logs, tickets, evidências ou screenshots; registre apenas ambiente (por exemplo, `staging`), horário UTC, versão do backup e resultado.
Arquivos `.archive.gz` temporários devem ficar fora do repositório e de pastas sincronizadas, ter acesso restrito, seguir o prazo de retenção aprovado e ser removidos após a validação do restore; não os anexe a chamados ou pacotes de release.

Para gerar um pacote compartilhável, use `ops/package-release.ps1 -OutputPath <arquivo.zip>`. Se o destino já existir, a ferramenta falha por segurança; use `-Force` somente quando a sobrescrita for intencional. O empacotador inclui o template seguro `cloudflare-worker/.dev.vars.example` para reproduzir a configuração local, mas exclui perfis de navegador (`.edge-shot`), caches, dependências, builds locais, logs e segredos reais.
Consulte `docs/RELEASE-STATUS.md` para confirmar qual versão pública o smoke test e as evidências atuais representam.
Antes de compartilhar, confirme que o pacote contém `DEPLOY.md`, `docs/OPERATIONS.md`, `docs/PILOT-E2E-CHECKLIST.md`, `ops/smoke-test.ps1` e `cloudflare-worker/.dev.vars.example`; a ausência de qualquer um deles torna o pacote não reproduzível.
Para automatizar essa verificação sem abrir o conteúdo do pacote, execute `ops/verify-release.ps1 -ZipPath <arquivo.zip>`; o comando falha se faltar documentação essencial ou se encontrar perfis, caches ou segredos.
Essa verificação cobre somente a higiene e a reprodutibilidade do ZIP; ela não comprova que um backup MongoDB é íntegro nem substitui um restore controlado em ambiente separado.

## Recuperação

1. Registrar o incidente e pausar novas comunicações com a instituição.
2. Consultar logs e o último backup íntegro.
3. Restaurar em banco separado.
4. Registrar nome do ambiente separado, versão do backup, horário UTC e resultado; nunca usar URI ou banco de produção.
5. Executar `ops/smoke-test.ps1` apontando para a aplicação ligada ao banco restaurado.
6. Validar login, vínculo, pedido, confirmação, chat e certificado com contas de teste.
7. Só então planejar a troca de conexão e comunicar a instituição.

## Exclusão de conta

- A exclusão pelo titular e a exclusão administrativa usam uma única transação do MongoDB Atlas. Dados operacionais, conta e evento de auditoria são confirmados juntos; se qualquer etapa falhar, a transação é revertida e a solicitação pode ser repetida.
- Um erro HTTP na exclusão exige verificar os logs do Worker e tentar novamente. Não informe ao usuário que a conta foi removida antes de receber a resposta de sucesso.
- Certificados emitidos permanecem disponíveis para validação; eventos anteriores são desassociados da conta. Backups seguem seu próprio ciclo de retenção.
- Certificados só são emitidos para profissionais vinculados a uma instituição ativa; a camada de persistência rejeita `institution_id` ausente e o painel institucional consulta por esse vínculo. Certificados legados devem passar pelo backfill antes da operação (`npm --prefix cloudflare-worker run migrate:certificates`). O dry-run reporta vínculos divergentes, profissionais sem vínculo e certificados órfãos; qualquer saída `review_required` exige revisão manual e não deve ser sobrescrita automaticamente.
- Analytics público: cada documento diário recebe `created_at` na primeira gravação e expira automaticamente após 366 dias; o painel limita a consulta a 365 dias.
- Antes de ampliar o volume, confirme que o Atlas usado aceita transações e execute o teste de falha parcial (`npm test` em `cloudflare-worker`). Monitore falhas de transação e o tempo da exclusão nos logs; uma operação que exceda o limite de transação precisa de uma rotina de limpeza retomável.

## Custos e limites

Monitorar mensalmente requests do Worker, Durable Object, MongoDB, armazenamento/egress, e-mails e artefatos de backup. Configurar alertas de orçamento no Cloudflare/MongoDB antes de ampliar o volume.

## Suporte

Registrar horário, impacto, instituição, rota e versão publicada. Nunca pedir conteúdo de conversa, senha ou token em chamado operacional.
Em chamados, use IDs anonimizados e resumo do erro; não solicite nome completo, e-mail, IP, resposta completa da API ou screenshot com dados pessoais quando um dado agregado bastar.

## Prazo operacional de resposta

- O prazo começa em `created_at` e corresponde a 48 horas corridas.
- O relógio permanece ativo enquanto o pedido estiver com status `pending`, incluindo fins de semana e feriados.
- O prazo termina quando o profissional aceita, recusa ou propõe um horário. Pedidos cancelados ou encerrados deixam de ser contabilizados como pendentes.
- O banco registra timestamps em UTC; a interface exibe datas e horários em `America/Fortaleza`.
- Os estados apresentados são `aguardando`, `prazo próximo` e `atrasado`.
- A fila de apoio e qualquer redistribuição são manuais, dependem de consentimento e devem ser acionadas pela instituição ou por um responsável designado.
- O prazo de 48 horas é uma meta operacional do piloto, não uma garantia de atendimento clínico, disponibilidade profissional ou resultado terapêutico.

## Concorrência de agenda — evidência local

O teste `cloudflare-worker/test/direct-proposal.test.mjs` cobre duas remarcações concorrentes para o mesmo horário: uma operação vence, a outra recebe conflito, e o horário antigo só é liberado pela operação vencedora. Isso valida o lock em memória e a transação simulada no teste local.

Esse teste não substitui uma validação ponta a ponta contra o Worker publicado e o MongoDB Atlas. Antes de ampliar o piloto, execute o mesmo cenário em ambiente controlado, com backup íntegro, e registre a versão, o horário, IDs anonimizados, resultado e logs. Inclua também horários parcialmente sobrepostos e repita a execução para confirmar que o resultado é idempotente.

Para manter o registro consistente, use `docs/PILOT-E2E-CHECKLIST.md` para executar as etapas e `docs/PILOT-E2E-EVIDENCE.md` para registrar somente versão, horário UTC, status e IDs anonimizados. Não copie mensagens, credenciais ou exportações de banco para a evidência.

## Logs de erro e retenção

- Logs do Worker devem conter somente contexto operacional mínimo (rota/fluxo, status, horário UTC e nome da exceção), nunca tokens, senhas, conteúdo de conversa, payloads completos ou objetos de erro.
- Falhas operacionais do Worker são emitidas como eventos JSON com `event`, `method`, `route`, `error_name`, status e horário; o mesmo formato cobre persistência, e-mail, fan-out e realtime. Não adicionar query string, corpo, e-mail, IP ou identificadores de conta a esses campos.
- O acesso aos logs deve ficar restrito à operação autorizada e ser tratado como dado operacional, não como fonte de prontuário ou auditoria clínica.
- Antes de ampliar o piloto, configurar no provedor a retenção mínima necessária, confirmar quem pode consultar os logs e registrar a configuração no ambiente. A retenção efetiva deve ser revisada junto da política de privacidade e dos contratos aplicáveis.
- Evidências e chamados devem usar apenas resumo e IDs anonimizados; não anexar logs brutos.

## Mensagens e abuso de tráfego

O chat limita cada mensagem a 1000 caracteres e cada leitura a 200 registros. Isso reduz payloads acidentais. As mensagens REST também têm limite de 30 envios por usuário e conversa a cada 60 segundos, com resposta `429` e `Retry-After`; o limite deve ser recalibrado após medir volume real, sem bloquear o fluxo normal de cuidado.

O canal realtime rejeita frames acima de 16 KiB e limita mensagens recebidas por socket a 120 em 10 segundos. As mensagens REST agora têm limite de 30 envios por usuário e conversa a cada 60 segundos; quando excedido, a API responde `429` com `Retry-After`. Esses limites protegem o transporte e o custo, mas não substituem moderação nem acompanhamento de abuso persistente.
# Saúde do serviço

- `GET|HEAD /api/live` é liveness: confirma que o Worker está respondendo e não consulta o MongoDB.
- `GET|HEAD /api/ready` é readiness: confirma o ping pelo mesmo Durable Object usado pela aplicação e retorna HTTP 503 quando o MongoDB não está acessível.
- `GET|HEAD /api/health` permanece compatível com os monitores existentes e tem a mesma semântica de readiness.
- Não use liveness para liberar tráfego dependente de dados; use readiness. Um `503 database: unavailable` delimita dependência indisponível, não encerramento do Worker.
