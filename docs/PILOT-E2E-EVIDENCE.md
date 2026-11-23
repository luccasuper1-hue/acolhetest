# Evidências do piloto ponta a ponta

## Estado do release atual — 22/11/2026

- Produção: `531346eb-065a-46fd-bd2e-86d9aace3c54`.
- Staging: `7d8ba397-b1fb-433d-b42a-cfe24bb8e224`.
- Ambos respondem health HTTP 200 com banco saudável.
- O release é reproduzível pelo commit `8c0eb65` e pela tag `acolhe-release-2026-11-22`.
- E2E autenticado e carga não foram executados nesta rodada; qualquer evidência anterior continua histórica e não é promovida automaticamente.

Este registro deve ser preenchido durante um teste controlado com contas de teste e sem conteúdo clínico real. Nenhuma etapa abaixo é considerada concluída apenas por existir no código.

## Escopo temporal da evidência

O registro abaixo preserva as execuções históricas e as revalidações do release atual. Cada execução informa explicitamente o ambiente e a versão; uma evidência de staging não é tratada como prova de produção.

## Evidência autoritativa do release publicado

Esta é a referência corrente para o estado operacional do release publicado. As seções abaixo com versões anteriores são históricas e não substituem este registro.

- Staging validado: `ead148a0-80ef-4a8a-86e9-2f233440d576`.
- E2E autenticado: `E2E-2026-11-22-STAGING-02`, aprovado em 22/11/2026 UTC.
- Restore separado: aprovado, 2 documentos restaurados, 0 falhas; banco temporário removido após a conferência.
- Carga autenticada controlada: 32/32 leituras HTTP 200; latência P95 acima da meta de 3 segundos, mantida como risco aberto.
- Produção promovida após os gates: `57c02561-a44a-487d-9b39-2a6eaf3b42af`.
- Limite da evidência: o roteiro usa contas fixture autenticadas; cadastro e convite reais via API ainda não foram comprovados ponta a ponta.

## Execução histórica — supersedida

- ID da execução (ex.: `E2E-2026-11-21-01`): `E2E-2026-11-21-STAGING-01`
- Fonte da versão confirmada: `docs/RELEASE-STATUS.md`.
- Instituição: `Instituição E2E Acolhe` (fictícia)
- Ambiente/base URL: staging / `acolhetest-staging.luccasuper1.workers.dev`
- Data e hora (UTC): `2026-11-21`
- Versão do Worker: `cd2c1fed-eb9e-4aaa-ac27-804ff08d6212` publicada no staging.
- A versão `cd2c1fed-eb9e-4aaa-ac27-804ff08d6212` publicada no staging foi usada na execução autenticada.
- Responsável pelo teste: execução automatizada controlada
- Contas usadas (IDs, nunca senhas): instituição, profissional e estudante E2E anonimizados
- Resultado geral desta execução histórica: `aprovado` para o fluxo autenticado e restore do staging
- Resultado geral histórico: `aprovado` (registro preservado para compatibilidade documental)
- E2E autenticado da versão atual: `pendente` (status registrado antes da revalidação de 22/11/2026; supersedido pela evidência autoritativa acima)
- Smoke test técnico da versão publicada: `aprovado` (home, GET/HEAD health, banco e headers).
- Restore real do staging: `aprovado` (2 documentos restaurados, 0 falhas).
- Observação: um efeito secundário de notificação retornou 500 após persistir feedback/encaminhamento; a API foi endurecida com `Promise.allSettled` e a repetição passou sem erro.
- Próxima ação: repetir o roteiro com uma instituição piloto real antes de ampliar o uso.

## Atualização de interface — ciclo 679

- Versão pública: `d9a534ec-d1de-4491-9ffd-df24a53e5408`.
- Smoke pós-publicação: `aprovado` em produção e staging; home, GET/HEAD health, discovery files e headers de segurança responderam corretamente.
- A publicação reduziu o chunk inicial do frontend para aproximadamente 159 kB e separou o chunk de gráficos.
- Refinamentos publicados: launcher de mensagens com label/contador estáveis e largura limitada no mobile.
- Refinamentos visuais publicados: páginas longas, FAQ/comparações e rodapé público mais compactos no mobile.
- A publicação de produção referenciada pelo ciclo 600 foi `e5c5e1a4-61df-4f6e-a4ea-2828aeafc1c6`; esta execução autenticada foi realizada separadamente no staging.
- A publicação atual de produção, após a paralelização dos painéis, é `b0bd4f6b-85a2-48a1-ad1d-9f0359525245`. O E2E funcional histórico acima não deve ser interpretado como carga autenticada.
- A publicação atual de produção, após a deduplicação das varreduras e redução do pool, é `259b9764-d909-4d14-860e-f5c3e4ebb9a3`.
- A publicação atual de produção é registrada em `docs/RELEASE-STATUS.md`; ela inclui refinamentos visuais responsivos e não altera o fluxo autenticado validado na evidência anterior.

## Carga autenticada de staging — 21/11/2026

- Ambiente: `acolhetest-staging.luccasuper1.workers.dev`; contas temporárias isoladas e removidas após o teste.
- Matriz: 30 estudantes, 1 profissional, 1 instituição e 1 administrador; 4 rodadas simultâneas por conta; 132 leituras autenticadas dos quatro painéis.
- Resultado: 132/132 respostas HTTP 200, sem erro funcional.
- Latência observada após deduplicação e pool 4: estudantes média 6,3 s / p95 7,1 s; profissional média 5,8 s; instituição média 5,8 s; administração média 3,7 s.
- Comparação controlada: pool 8 teve média de 6,3 s nos estudantes; pool 4 manteve 120/120 HTTP 200 com p95 de 7,4 s; pool 2 elevou o p95 para 26,7 s. Pool 4 é o menor valor aprovado para esta carga.
- Interpretação: a redução veio principalmente da deduplicação da expiração por instituição; pool 2 foi descartado por fila excessiva. A carga não derrubou o Worker.
- Massa populada: 30 estudantes com solicitações, sessões, notificações e 120 disponibilidades; pool 4 manteve 132/132 HTTP 200, com média de 15,7 s e p95 de 17,2 s nos estudantes. Pool 6 ficou em 16,4 s/17,9 s, portanto não trouxe ganho para essa massa.
- Evidência mínima por execução: versão do Worker, data/hora UTC, status HTTP, IDs anonimizados e resultado de cada etapa; não anexar exportações de banco, senhas, tokens, e-mails completos ou conteúdo de conversa.
- Cada nova execução deve receber um novo ID e ser adicionada como registro separado; não sobrescreva uma execução anterior.
- Não cole logs brutos, respostas completas de API, e-mails, nomes reais, endereços IP ou identificadores de conta; resuma o resultado e anonimize qualquer ID necessário.
- O campo `Evidência/link` aceita apenas uma referência interna sanitizada (por exemplo, captura sem dados pessoais ou ID anonimizado); nunca cole URL de convite, token, link de sala, link assinado ou anexo com dados pessoais.

## Regra de resposta do piloto

O prazo começa em `created_at` e corresponde a 48 horas corridas, inclusive fins de semana e feriados. O relógio fica ativo enquanto o pedido está `pending` e termina quando há aceite, recusa ou proposta de horário. O prazo é uma meta operacional do piloto, não uma garantia de atendimento clínico, disponibilidade profissional ou resultado terapêutico.

## Evidências por etapa do registro histórico

| Etapa | Resultado | Evidência/link | Observação |
| --- | --- | --- | --- |
| Cadastro e código da instituição | aprovado | `E2E-2026-11-21-STAGING-01` | Código E2E criado no staging |
| Convite e ativação do profissional | aprovado | `E2E-2026-11-21-STAGING-01` | Conta profissional fictícia ativada |
| Cadastro do estudante, consentimento `pilot-v1` e regra de idade | aprovado | `E2E-2026-11-21-STAGING-01` | Estudante adulto de teste; sem dados clínicos |
| Pedido, proposta e confirmação | aprovado | `E2E-2026-11-21-STAGING-01` | HTTP 201/200/201 |
| Atualização dos dois painéis/notificações | aprovado | `E2E-2026-11-21-STAGING-01` | Atualização persistida; notificações sem conteúdo clínico |
| Mensagem realtime ou fallback | aprovado | `E2E-2026-11-21-STAGING-01` | Mensagens aceitas nos dois papéis |
| Link da sala | aprovado | `E2E-2026-11-21-STAGING-01` | Link HTTPS de teste |
| Encerramento/ausência no horário correto | aprovado | `E2E-2026-11-21-STAGING-01` | Encerramento bloqueado antes do horário e aprovado depois |
| Encaminhamento operacional | aprovado | `E2E-2026-11-21-STAGING-01` | Repetição idempotente validada |
| Feedback | aprovado | `E2E-2026-11-21-STAGING-01` | HTTP 201 após correção de efeitos secundários |
| Certificado emitido e validado | aprovado | `E2E-2026-11-21-STAGING-01` | Certificado válido consultado publicamente |
| Visibilidade institucional agregada | aprovado | `E2E-2026-11-21-STAGING-01` | Métricas sem conteúdo de conversa |

## Exercício de incidentes

| Cenário | Resultado | Evidência |
| --- | --- | --- |
| Banco indisponível | validado por contrato; falta teste controlado em staging | `docs/INCIDENT-DRILL-RESULTS.md` |
| Worker indisponível | parcialmente validado; alerta ainda precisa ser observado | `docs/INCIDENT-DRILL-RESULTS.md` |
| E-mail indisponível | validado por contrato | `docs/INCIDENT-DRILL-RESULTS.md` |
| Menor sem consentimento | bloqueio implementado; staging e revisão jurídica pendentes | `docs/INCIDENT-DRILL-RESULTS.md` |
| Restore em banco separado | aprovado no banco de staging de teste | `docs/INCIDENT-DRILL-RESULTS.md` |

Não registrar texto de conversa, senha, token, link de acesso ou dado clínico neste documento.

## Revalidação v9.1 — 22/11/2026

## E2E autenticado e restore — release candidato `ead148a0-80ef-4a8a-86e9-2f233440d576`

- Ambiente: staging / `acolhetest-staging.luccasuper1.workers.dev`.
- Execução: `E2E-2026-11-22-STAGING-02`, concluída em 22/11/2026 UTC.
- Fluxo aprovado: login de estudante e profissional → pedido direto → proposta → confirmação → mensagem → link HTTPS de sala → encerramento → encaminhamento operacional → feedback → certificado validado publicamente.
- Resultado: `aprovado` em repetição controlada; contas e massa temporárias foram removidas ao final.
- Restore: archive de staging restaurado no banco separado `acolhe_restore_e2e_20261122`; 2 documentos restaurados, 0 falhas, contagem independente confirmada e banco temporário removido.
- Carga: 32/32 leituras autenticadas HTTP 200 (5 estudantes, profissional, instituição e administração; 4 rodadas). P95 observado: estudantes 6,448 s; profissional 6,860 s; instituição 5,939 s; administração 4,654 s.
- Observação: ocorreram respostas transitórias 500 em etapas secundárias durante tentativas anteriores; o roteiro usa espera curta e retry limitado apenas no harness e concluiu sem erro. O gargalo de latência permanece aberto e não é tratado como resolvido.
- Nenhuma credencial, token, URL de banco, conteúdo de conversa ou identificador de conta é registrado aqui.

Produção foi promovida depois dos gates para `f2f4426d-6d46-47f5-9f83-3d6f4cc483e5`; esta linha não transforma a execução de staging em evidência de produção.

## Publicação de refinamento visual — 22/11/2026

- Worker publicado: `bb31826a-6dfe-444a-b502-2f93004e0b06`.
- Alteração: formulário de pedido do estudante passou a ocupar a largura útil do card no desktop e voltou a uma coluna no mobile.
- Smoke pós-publicação: aprovado para home, health GET/HEAD, discovery files e headers de segurança.

## Histórico — promoção da rodada de profissionalização — 22/11/2026

- Staging smoke aprovado na versão `8900fc5b-b200-4561-9011-99f506461cc0`.
- Produção promovida na versão `ae1f4100-6d3b-46b2-8506-f444f44b3b44`.
- Smoke de produção aprovado para home, liveness/readiness/health GET/HEAD, discovery files e headers de segurança.
- E2E autenticado e restore específicos desta promoção: pendentes nesta sessão por falta de URI e contas de teste disponíveis; não foram simulados.
- Tentativa autorizada adicional em 22/11/2026: a conexão ao Atlas de staging alcançou o servidor, mas a credencial local foi rejeitada (`authentication failed`). Nenhuma credencial foi alterada ou exposta.

- Staging atualizado para `0cc2ef3b-5157-4eb1-bf02-0639c411a007` com `APP_ENV=staging`.
- Smoke público aprovado: home, liveness, readiness GET/HEAD, discovery files e headers de segurança.
- Tentativa de cadastro autenticado com conta fictícia sem dados clínicos: bloqueada porque o banco de staging não continha o código institucional de teste `PILOTO-3F765ED1`.
- Esta tentativa foi supersedida pela execução autenticada controlada registrada abaixo; não houve alteração de produção nessa tentativa.

## Histórico — E2E autenticado controlado — execução `E2E-2026-11-22-STAGING-01`

- Ambiente: staging / `acolhetest-staging.luccasuper1.workers.dev`.
- Versão do Worker: `0cc2ef3b-5157-4eb1-bf02-0639c411a007`.
- Promoção correspondente para produção: `b69eb7f6-a346-4977-a1e1-84e9e6d87df8`, publicada após os gates e smoke público.
- Massa: fixture temporária isolada por `load_tag`; removida integralmente após a execução.
- Fluxo aprovado: login de estudante e profissional → pedido direto → proposta → confirmação → mensagem → link HTTPS de sala → encerramento após o horário → encaminhamento operacional → feedback → certificado válido consultado publicamente.
- Resultado: `aprovado`.
- Certificado: validação HTTP 200; código omitido deste documento para evitar transformar evidência em identificador público.
- Instabilidade observada: duas respostas HTTP 500 transitórias em efeitos secundários/retry; a repetição controlada concluiu todas as etapas. Isso permanece como ponto de observabilidade a investigar antes de escalar o piloto.
- Limpeza: 4 usuários, 1 perfil de estudante, 1 profissional, 1 instituição, 121 disponibilidades, 1 pedido legado, 1 pedido direto, 7 sessões, notificações, encaminhamento, feedback, eventos e certificado temporários removidos.

## Preenchimento integral do card publicado — 22/11/2026

- Produção publicada: `57c02561-a44a-487d-9b39-2a6eaf3b42af`.
- Smoke pós-publicação: aprovado; o formulário mantém a reorganização em duas colunas e ocupa toda a largura interna do card.
