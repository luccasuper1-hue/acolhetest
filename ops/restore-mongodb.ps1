param(
  [Parameter(Mandatory=$true)][string]$MongoUri,
  [Parameter(Mandatory=$true)][string]$Database,
  [Parameter(Mandatory=$true)][string]$TargetDatabase,
  [Parameter(Mandatory=$true)][string]$Archive,
  [switch]$ConfirmDrop
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($MongoUri) -or $MongoUri -notmatch '^mongodb(?:\+srv)?://') { throw "MongoUri inválida: use uma URI mongodb:// ou mongodb+srv://." }
if ([string]::IsNullOrWhiteSpace($Database) -or $Database -match '[\\/\s]') { throw "Database inválido: informe somente o nome do banco." }
if ([string]::IsNullOrWhiteSpace($TargetDatabase) -or $TargetDatabase -notmatch '^[A-Za-z0-9_-]+$') { throw "TargetDatabase inválido: use um nome simples de banco separado." }
if ($TargetDatabase -ieq $Database -or $TargetDatabase -in @('admin', 'config', 'local')) { throw "Restore abortado: o banco de destino deve ser separado da origem e não pode ser um banco de sistema." }
if (-not (Get-Command mongorestore -ErrorAction SilentlyContinue)) { throw "mongorestore não encontrado. Instale MongoDB Database Tools." }
if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) { throw "Arquivo de backup não encontrado: $Archive" }
$archiveItem = Get-Item -LiteralPath $Archive -ErrorAction Stop
if ($archiveItem.Length -le 0) { throw "Arquivo de backup vazio: $Archive" }
if ($archiveItem.Name -notmatch '(?i)\.archive\.gz$') { throw "Arquivo de backup inválido: use um archive .archive.gz gerado pelo backup oficial." }
if (-not $ConfirmDrop) { throw "Restore abortado: informe -ConfirmDrop somente após validar que o banco de destino é separado e aprovado." }
mongorestore --uri $MongoUri --nsInclude "${Database}.*" --nsFrom "${Database}.*" --nsTo "${TargetDatabase}.*" --archive=$Archive --gzip --drop
if ($LASTEXITCODE -ne 0) { throw "mongorestore falhou com código $LASTEXITCODE; verifique o banco separado antes de tentar novamente." }
Write-Output "Restore concluído no banco separado. Valide as contagens e índices antes de usar o ambiente."
