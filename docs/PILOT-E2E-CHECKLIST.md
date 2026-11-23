# Checklist operacional ponta a ponta

Executar com instituição e contas de teste, sem dados clínicos reais.

## Pré-requisitos e segurança

- Confirmar a versão publicada em `docs/RELEASE-STATUS.md` e executar `ops/smoke-test.ps1 -BaseUrl <base-url>` antes do roteiro.
- Usar e-mails de teste, nomes fictícios e mensagens sem conteúdo clínico.
- Registrar somente IDs anonimizados, horários, status HTTP e evidências de tela; nunca registrar senha, token, texto de conversa ou dados do responsável além do necessário para provar a etapa.
- Se qualquer etapa falhar, interromper o roteiro, registrar o estado e corrigir a regressão antes de repetir.

- [ ] Criar instituição e confirmar código.
- [ ] Convidar profissional e ativar convite.
- [ ] Criar/vincular estudante com consentimento `pilot-v1`.
- [ ] Para criança de teste, bloquear o acesso, validar responsável e liberar pela instituição; para adolescente, concluir cadastro normal.
- [ ] Profissional publicar horário ou receber pedido direto.
- [ ] Estudante enviar pedido.
- [ ] Profissional propor horário.
- [ ] Estudante confirmar horário.
- [ ] Confirmar atualização dos dois painéis e notificação não lida.
- [ ] Trocar mensagem e confirmar realtime/fallback.
- [ ] Adicionar e abrir link da sala.
- [ ] Aguardar início; só então marcar realizada ou ausência.
- [ ] Registrar encaminhamento operacional.
- [ ] Enviar feedback.
- [ ] Emitir e validar certificado.
- [ ] Confirmar que a instituição vê apenas dados administrativos/agregados.
- [ ] Registrar evidência, versão e resultado.
- [ ] Em staging, tentar duas propostas parcialmente sobrepostas para o mesmo profissional e confirmar que apenas uma é aceita.
- [ ] Repetir a mesma ação após timeout/atualização e confirmar idempotência: sem dupla reserva, dupla notificação ou dupla auditoria.
