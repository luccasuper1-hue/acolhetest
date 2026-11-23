# Rotação de segredos

Segredos são configurados no provedor, nunca no repositório, ZIP, log ou screenshot. O procedimento abaixo é reversível e deve ser executado em staging antes de produção.

1. Inventariar o nome do segredo, ambiente, responsável e dependências; nunca registrar o valor.
2. Gerar novo valor fora do código.
3. Configurar o novo valor no ambiente de staging e executar healthcheck, login de teste, e-mail e realtime.
4. Promover somente após os gates e janela autorizada.
5. Revogar o valor anterior no provedor e registrar horário UTC, versão e resultado.

Segredos cobertos: `MONGO_URL`, `JWT_SECRET`, `RESET_EMAIL_WEBHOOK_TOKEN`, `RESEND_API_KEY`, credenciais Gmail e tokens de alerta. A rotação contratual e a lista de suboperadores permanecem pendentes de validação jurídica quando envolverem transferência internacional.
