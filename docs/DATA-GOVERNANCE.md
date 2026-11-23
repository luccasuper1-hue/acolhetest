# Governança de dados do Acolhe

Este documento descreve salvaguardas operacionais do piloto. Ele **não é parecer jurídico**. A definição contratual dos papéis, a base legal, regras para menores, transferência internacional, prazos definitivos e comunicação de incidentes permanecem **pendentes de validação jurídica**.

## Papéis

- **Controlador:** a instituição define a finalidade institucional, o público autorizado e as regras de acesso aos dados do seu piloto, sujeito à confirmação contratual.
- **Operador:** o Acolhe executa a plataforma, o fluxo operacional e os registros técnicos conforme instruções documentadas da instituição.
- **Suboperadores:** Cloudflare (Worker, Durable Objects e assets), MongoDB Atlas (armazenamento) e provedores de e-mail configurados. A lista contratual, localização e garantias precisam ser confirmadas antes de escala.

## Princípios operacionais

1. Coletar somente conta, vínculo institucional, agenda, status operacional, encaminhamento e feedback previsto.
2. Conteúdo de conversa não aparece em métricas, exports administrativos, logs ou painéis institucionais.
3. Toda resposta administrativa usa projeção explícita e filtro por `institution_id`.
4. Logs registram rota, método, status, duração e nome da exceção; nunca token, cookie, senha, e-mail completo, IP, mensagem ou payload.
5. Analytics público só funciona após consentimento opcional e guarda contagem agregada por dia/página.

## Consentimento

O cadastro registra `consent_version`, `consent_accepted_at`, `consent_role` e a finalidade apresentada. A versão `pilot-v1` é um identificador operacional do texto vigente, não uma aprovação jurídica. Mudanças materiais exigem novo aceite; aceite antigo não é sobrescrito.

## Crianças e adolescentes

Crianças ficam bloqueadas até validação institucional do responsável e registro de auditoria transacional. Adolescentes seguem fluxo separado, com melhor interesse, minimização e regras institucionais explícitas. A idade é calculada no fuso oficial `America/Fortaleza`. A autorização para eventual serviço psicológico é distinta do consentimento de cadastro e deve ser definida pelo profissional/instituição; validação jurídica permanece pendente.

## Direitos dos titulares

O titular pode solicitar acesso, correção, exportação minimizada ou exclusão pelo canal de privacidade da conta e pelo contato institucional indicado nos termos. Cada solicitação deve ter responsável, prazo e resultado registrados sem copiar conteúdo clínico. Backups seguem retenção própria e não são apagados fora do ciclo aprovado.

## Incidentes

Qualquer suspeita deve seguir `docs/INCIDENT-RESPONSE.md`: conter, preservar evidência mínima, avaliar escopo, comunicar o responsável institucional e buscar orientação jurídica antes de comunicação externa.
