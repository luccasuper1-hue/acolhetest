param(
  [Parameter(Mandatory=$true)][string]$MongoUri,
  [Parameter(Mandatory=$true)][string]$Database,
  [Parameter(Mandatory=$true)][string]$Archive
)
$ErrorActionPreference = "Stop"
if (-not (Get-Command mongorestore -ErrorAction SilentlyContinue)) { throw "mongorestore não encontrado. Instale MongoDB Database Tools." }
if (-not (Test-Path -LiteralPath $Archive)) { throw "Arquivo de backup não encontrado: $Archive" }
mongorestore --uri $MongoUri --nsFrom "${Database}.*" --nsTo "${Database}.*" --archive=$Archive --gzip --drop
Write-Output "Restore concluído no banco informado. Valide o checklist antes de usar o ambiente."
