# Processo de resposta a incidentes de segurança

Este é um procedimento operacional de piloto e não substitui avaliação jurídica. A obrigação de comunicação à ANPD, titulares ou instituição permanece **pendente de validação jurídica** para cada caso.

## 1. Detectar e conter

- registrar horário UTC, ambiente, versão, rota/serviço e impacto resumido;
- revogar/rotacionar o segredo afetado sem copiar seu valor para chamados;
- limitar a rota, sessão ou integração somente quando necessário;
- não apagar logs ou evidências antes da avaliação.

## 2. Classificar

Classificar como indisponibilidade, acesso indevido, exposição de dados, falha de integridade, e-mail/realtime ou terceiro. Usar apenas IDs anonimizados. Conteúdo clínico não deve ser reproduzido.

## 3. Recuperar

Seguir `docs/INCIDENT-RUNBOOK.md` e `docs/RESTORE-RUNBOOK.md`. Preferir restauração em ambiente separado; validar liveness, readiness, login de teste e fluxo operacional antes de qualquer troca.

## 4. Comunicar e aprender

O responsável operacional comunica a instituição vinculada e registra decisão, escopo, contenção, recuperação e ações preventivas. Qualquer comunicação externa deve passar pela pessoa responsável por privacidade e pela revisão jurídica aplicável.
