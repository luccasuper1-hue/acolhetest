# Runbook de restauração

1. Selecionar backup íntegro e registrar apenas versão, ambiente e horário UTC.
2. Criar banco separado de restauração; nunca usar URI de produção em teste.
3. Executar `ops/restore-mongodb.ps1 -MongoUri <URI do ambiente de teste> -Database <banco do archive> -TargetDatabase <banco novo e separado> -Archive <arquivo.archive.gz> -ConfirmDrop`. O script rejeita destino igual à origem e limita o restore ao banco do archive.
4. Conferir coleções, contagens agregadas e índices mínimos sem abrir dados pessoais.
5. Executar smoke público, login de teste e E2E autenticado reduzido.
6. Registrar resultado, tempo de restauração, falhas e decisão de rollback.
7. Remover banco temporário e arquivo de dump conforme o ciclo de retenção aprovado.

O restore já comprovado no staging deve permanecer em `docs/INCIDENT-DRILL-RESULTS.md`; nenhum restore de produção é considerado concluído sem autorização e evidência separada.
