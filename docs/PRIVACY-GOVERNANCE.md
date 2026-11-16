# Privacidade e governança do piloto

Este texto é uma especificação operacional e precisa de revisão jurídica antes de uso amplo.

## Papéis e responsabilidade

A instituição define a finalidade e as regras de acesso dos estudantes; deve ser tratada como controladora dos dados institucionais. O Acolhe opera a plataforma e a infraestrutura em nome da instituição. A definição contratual final de controlador, operador e suboperadores deve ser confirmada por escrito.

## Consentimento versionado

O cadastro registra `consent_version: pilot-v1` e `consent_accepted_at`. Mudanças materiais exigem novo aceite; a versão exibida nunca deve ser sobrescrita silenciosamente.

## Dados e limites

Coletar apenas conta, vínculo, agenda, status operacional, encaminhamento e feedback previsto no piloto. O chat não é prontuário clínico. A instituição não acessa conteúdo de conversa nem motivo detalhado.

## Menores

Antes de aceitar menores em produção, definir responsável, idade mínima, canal de consentimento e revogação. Até lá, operar somente com o público aprovado pela instituição.

## Retenção e exclusão

Definir prazos para contas inativas, mensagens, logs, feedback e backups. Solicitações de acesso, correção e exclusão devem ter responsável e prazo registrados. Exclusão de produção não elimina automaticamente cópias de backup antes do vencimento da retenção.

## Revisão jurídica

Validar LGPD, base legal, menores, contratos, transferência internacional, segurança do MongoDB/Cloudflare e comunicação de incidentes antes de escalar.
