# Migrações controladas

## Backfill de certificados

`backfill-certificate-institution.mjs` preenche `institution_id` em certificados antigos usando o vínculo atual do profissional.

O modo padrão é somente leitura. `MONGODB_URI` e `MONGODB_DB` são obrigatórios; sem o nome do banco a migração aborta para evitar operar no database padrão do driver. Execute primeiro:

```powershell
$env:MONGODB_URI = "<uri>"
$env:MONGODB_DB = "<database>"
node ops/migrations/backfill-certificate-institution.mjs
```

Quando estiver na pasta `cloudflare-worker`, prefira o comando equivalente `npm run migrate:certificates`.

Revise `status`, `candidates`, `repairs`, `unresolved`, `unresolved_certificate_ids`, `mismatched` e `orphaned_certificate_ids`. `status: review_required` exige revisão manual antes de considerar o backfill concluído; certificados sem profissional institucional resolvido, órfãos (sem profissional ou apontando para profissional inexistente) e certificados com vínculo existente divergente não são sobrescritos automaticamente. Antes de aplicar:

1. confirme que existe um backup recente do MongoDB;
2. valide os certificados sem vínculo listados no relatório;
3. execute em janela operacional controlada.

Para aplicar, são necessárias duas confirmações explícitas:

```powershell
$env:CONFIRM_MIGRATION = "yes"
$env:APPLY_MIGRATION = "yes"
node ops/migrations/backfill-certificate-institution.mjs
```

A migração só atualiza documentos que não possuem `institution_id` ou o possuem vazio/nulo, grava um evento `data_repair` por alteração e usa uma transação com `majority` write concern. Ela não sobrescreve vínculos existentes.
Na aplicação, o vínculo do profissional é relido dentro da transação para evitar reparar um certificado com uma associação que mudou durante o dry-run.

O painel institucional consulta certificados com escopo explícito por `institution_id`; execute este backfill antes de depender da listagem institucional de certificados legados.

## Rollback

O campo adicionado não altera o conteúdo público do certificado. Se a validação pós-execução identificar associação incorreta, interrompa novas emissões e restaure o backup aprovado conforme o runbook de recuperação. Não remova o campo manualmente sem preservar os eventos de auditoria.

## Reparação de vínculo institucional

`repair-institution-link.mjs` segue o mesmo padrão e exige `MONGODB_URI`, `MONGODB_DB`, `PROFESSIONAL_USER_ID` e `TARGET_INSTITUTION_ID`. Sem `APPLY_MIGRATION=yes`, ele apenas mostra o vínculo atual e o destino; para aplicar, use também `CONFIRM_MIGRATION=yes`. O nome do banco é obrigatório para impedir que a ferramenta opere no database padrão do driver.
