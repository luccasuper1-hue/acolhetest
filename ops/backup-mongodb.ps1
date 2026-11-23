param(
  [Parameter(Mandatory=$true)][string]$MongoUri,
  [Parameter(Mandatory=$true)][string]$Database,
  [string]$OutputDirectory = "./backups"
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($MongoUri) -or $MongoUri -notmatch '^mongodb(?:\+srv)?://') { throw "MongoUri inválida: use uma URI mongodb:// ou mongodb+srv://." }
if ([string]::IsNullOrWhiteSpace($Database) -or $Database -match '[\\/\s]') { throw "Database inválido: informe somente o nome do banco." }
if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) { throw "mongodump não encontrado. Instale MongoDB Database Tools." }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path "acolhe-$stamp.archive.gz"
if (Test-Path -LiteralPath $archive) { throw "Arquivo de backup já existe: $archive. Aguarde o próximo segundo para evitar sobrescrita." }
mongodump --uri $MongoUri --db $Database --archive=$archive --gzip --excludeCollection=login_attempts
if ($LASTEXITCODE -ne 0) { throw "mongodump falhou com código $LASTEXITCODE; o archive não deve ser tratado como backup válido." }
Write-Output "Backup criado: $archive"
