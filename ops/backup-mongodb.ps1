param(
  [Parameter(Mandatory=$true)][string]$MongoUri,
  [Parameter(Mandatory=$true)][string]$Database,
  [string]$OutputDirectory = "./backups"
)
$ErrorActionPreference = "Stop"
if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) { throw "mongodump não encontrado. Instale MongoDB Database Tools." }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path (Resolve-Path $OutputDirectory) "acolhe-$stamp.archive.gz"
mongodump --uri $MongoUri --db $Database --archive=$archive --gzip --excludeCollection=login_attempts
Write-Output "Backup criado: $archive"
