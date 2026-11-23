# Exercício de recuperação e incidentes

Data da verificação: 21/11/2026 (UTC)

Promoção da rodada de profissionalização: produção `ae1f4100-6d3b-46b2-8506-f444f44b3b44`; smoke pós-publicação aprovado em 22/11/2026. O E2E autenticado e o restore específicos desta versão permanecem pendentes por falta de credenciais de teste nesta sessão.

Interface pública atualizada até o ciclo 679, versão `d9a534ec-d1de-4491-9ffd-df24a53e5408`; smoke pós-publicação aprovado.

Suítes locais revalidadas nesta auditoria: frontend com 308 testes aprovados; Worker com 80 testes aprovados; TypeScript, lint e build também aprovados. Os números históricos dos ciclos anteriores permanecem apenas no log de melhoria contínua.

Este registro separa o que foi simulado no código do que ainda depende de um ambiente externo. Nenhum teste usa dados clínicos reais.

Os resultados de restore e E2E abaixo que mencionam staging são históricos e não comprovam a versão atual. Nesta auditoria, o restore separado do release atual permanece `pendente` por falta de credenciais e ambiente autorizado.

## Resultado resumido

| Cenário | Resultado | Evidência | Próximo passo |
| --- | --- | --- | --- |
| Banco indisponível | validado por contrato | Timeout de seleção do Mongo em 5s; erros de API são convertidos em resposta 500; transições já persistidas não dependem do broadcast realtime | Fazer uma indisponibilidade controlada em staging |
| Worker indisponível | parcialmente validado | Workflow verifica home e `/api/health` a cada 15 min | Confirmar notificações do GitHub e executar um teste controlado de alerta |
| E-mail indisponível | validado por contrato | Integração tem timeout de 8s; falha secundária não desfaz o registro persistido | Confirmar com um endpoint de e-mail de teste |
| Menor sem consentimento | bloqueado por regra de idade e revisão institucional | Menores de 12 anos ficam inativos até aprovação da instituição; a aprovação e o evento de auditoria são uma transação; adolescentes a partir de 12 anos seguem o fluxo próprio de consentimento | Executar o procedimento institucional em staging e validar juridicamente o protocolo |
| Restauração MongoDB | aprovado em restore controlado separado | Archive de staging restaurado em banco separado: 2 documentos, 0 falhas; coleção conferida e banco temporário removido depois da validação; sem uso de produção | Repetir mensalmente com `ops/restore-mongodb.ps1 -ConfirmDrop` somente após validar URI, banco e arquivo de staging; registrar apenas resumo sanitizado |
| Horários parcialmente sobrepostos | coberto por teste local; E2E pendente | `cloudflare-worker/test/direct-proposal.test.mjs` e checklist do piloto | Repetir com duas contas de teste em staging |
| Repetição/idempotência após timeout | coberto por contratos locais; E2E pendente | locks, claims e checklist do piloto | Confirmar sem dupla reserva, notificação ou auditoria |

## Evidências técnicas

- Suíte frontend: 308 testes aprovados na revalidação local atual.
- Suíte Worker: 80 testes aprovados na revalidação local atual.
- Publicação: a versão candidata `77d922f6-261c-4d08-aade-e8b5552ada0e` foi enviada, mas falhou no smoke por `database: unavailable`; a versão pública de referência continua sendo a registrada em `docs/RELEASE-STATUS.md`.
- Smoke test público: home, GET/HEAD health, banco saudável e headers de segurança aprovados.
- Smoke test público reexecutado no ciclo 150: GET/HEAD `/api/health`, home e asset versionado responderam corretamente, com `no-store`, `nosniff` e cache imutável.
- Smoke test público reexecutado no ciclo 200: home, GET/HEAD `/api/health`, banco saudável e headers de segurança responderam corretamente.
- Smoke test público reexecutado no ciclo 250: home, GET/HEAD `/api/health`, banco saudável e headers de segurança responderam corretamente.
- Smoke test público reexecutado no ciclo 300: home, GET/HEAD `/api/health`, banco saudável e headers de segurança responderam corretamente.
- Smoke test público reexecutado no ciclo 350: home, GET/HEAD `/api/health`, banco saudável e headers de segurança responderam corretamente.
- Smoke test público reexecutado no ciclo 500: home, GET/HEAD `/api/health`, robots, sitemap, banco saudável e headers de segurança responderam corretamente.
- Smoke test público reexecutado no ciclo 600: home, GET/HEAD `/api/health`, robots, sitemap, banco saudável e headers de segurança responderam corretamente.
- Checagem TypeScript do Worker: aprovada.
- Build de produção: aprovado.
- Healthcheck público: HTTP 200.
- O fallback realtime não desfaz uma alteração persistida quando o gateway de broadcast falha.
- O cliente pausa polling de fallback quando a aba está oculta e retoma com backoff.
- O envio de e-mail possui timeout limitado e não transforma falha de notificação secundária em perda do registro principal.
- Este documento não registra URL de banco, credenciais, tokens, e-mails completos ou conteúdo de conversa.
Também não anexar logs brutos, respostas completas de API, IPs, nomes reais ou identificadores de conta; registrar apenas resumo, versão, horário UTC, ambiente e resultado.

## Limites do exercício

Não desligamos produção, não alteramos o banco real e não usamos dados pessoais para provocar falhas. Para concluir a validação operacional, repetir os cenários em staging com uma conta de teste, registrar horário, versão e resposta observada, e anexar os logs sem tokens ou conteúdo de conversa.

## Publicação autorizada com gate externo bloqueado — 21/11/2026

Por autorização explícita do operador, a versão `77d922f6-261c-4d08-aade-e8b5552ada0e` foi publicada após os gates locais (Worker 74/74, frontend 306/306, TypeScript, lint e build). O smoke pós-publicação não foi aprovado: GET e HEAD `/api/health` responderam HTTP 503 com `database: unavailable`.

O staging também estava bloqueado pelo limite diário gratuito de duração do Durable Objects, com reset informado pelo Cloudflare para 22/11/2026 00:00 UTC. Portanto, esta publicação não é evidência de E2E ou carga autenticada aprovados; repetir o smoke, restore e carga após o reset antes de considerar o release saudável.

Rechecagem posterior em 21/11/2026 22:28 UTC: produção e staging continuaram retornando HTTP 503 em `/api/health` com `database: unavailable`; não houve evidência suficiente para atribuir o erro exclusivamente ao MongoDB ou exclusivamente à cota do Durable Objects. O bloqueio externo permanece aberto.

Revalidação em 22/11/2026 00:12 UTC: staging voltou a responder e foi atualizado para `0cc2ef3b-5157-4eb1-bf02-0639c411a007`; smoke público passou incluindo liveness e readiness.

Promoção v9.1 em 22/11/2026: a versão `b69eb7f6-a346-4977-a1e1-84e9e6d87df8` foi publicada em produção após os gates locais. Smoke de produção aprovou home, liveness, readiness, health, discovery files e headers de segurança; `/api/ready` confirmou `database: ok`.

## Restore controlado do release atual — 22/11/2026

O archive de staging foi restaurado em um banco separado, sem alterar o banco de staging de origem nem qualquer banco de produção. O `mongorestore` terminou com 2 documentos restaurados e 0 falhas; uma consulta independente confirmou a coleção esperada e a contagem de 2 documentos. Após a validação, o banco temporário foi removido para respeitar minimização e retenção. Nenhuma URI, credencial ou identificador pessoal é registrado nesta evidência.

## Revalidação do candidato de staging — 22/11/2026

- Worker: `ead148a0-80ef-4a8a-86e9-2f233440d576`.
- E2E autenticado: aprovado após limpeza/reexecução controlada; o harness completou todas as etapas sem dados reais.
- Smoke staging e produção: aprovados para home, liveness/readiness GET/HEAD, discovery files e headers de segurança.
- Carga autenticada: 32/32 HTTP 200; latência acima da meta de 3 s permanece como risco de performance, sem extrapolação para escala.
- Pendência operacional: investigar os 500 transitórios observados em encaminhamento/feedback/certificado antes de declarar SLO de produção; o retry do harness não substitui essa investigação.

## Promoção após gates — 22/11/2026

- Produção publicada: `f2f4426d-6d46-47f5-9f83-3d6f4cc483e5`.
- Smoke pós-publicação: aprovado em produção e staging; nenhuma indisponibilidade observada.
- A promoção não transforma a carga medida em SLO: latência e os 500 transitórios continuam registrados como riscos de acompanhamento.

## Refinamento visual publicado — 22/11/2026

- Produção publicada: `bb31826a-6dfe-444a-b502-2f93004e0b06`.
- Smoke pós-publicação: aprovado; alteração limitada ao layout responsivo do formulário de pedido do estudante.

## Preenchimento integral do card publicado — 22/11/2026

- Produção publicada: `57c02561-a44a-487d-9b39-2a6eaf3b42af`.
- Smoke pós-publicação: aprovado; removido o limite antigo de 760px do formulário, preservando a divisão em duas colunas.
