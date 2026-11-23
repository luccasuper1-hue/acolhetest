param(
  [Parameter(Mandatory = $true)][string]$ZipPath
)

$ErrorActionPreference = "Stop"
$archivePath = (Resolve-Path -LiteralPath $ZipPath).Path
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = $null
try {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
} catch {
  throw "Pacote inválido: não foi possível abrir um ZIP em '$archivePath'."
}
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
} finally {
  $archive.Dispose()
}

$required = @(
  "DEPLOY.md",
  "docs/OPERATIONS.md",
  "docs/PILOT-E2E-CHECKLIST.md",
  "ops/smoke-test.ps1",
  "cloudflare-worker/.dev.vars.example"
)
$forbiddenPattern = '(?i)(^|/)(\.edge-shot|\.browser-profile|\.playwright|\.auth|\.wrangler|node_modules|__pycache__|\.pytest_cache)(/|$)|(^|/)(credentials?|secrets?|private[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|id_rsa|oauth)([-_.]|/)|(^|/)\.env(?:\.|$)|\.(?:pem|key|zip|tar|tgz|log|sqlite|sqlite3|db)$'
$missing = @($required | Where-Object { $_ -notin $entries })
$forbidden = @($entries | Where-Object { $_ -match $forbiddenPattern -or $_ -match '^(?:[A-Za-z]:|/|\\)' -or $_ -match '(^|/)\.\.(?:/|$)' })
if ($missing.Count -gt 0 -or $forbidden.Count -gt 0) {
  if ($missing.Count -gt 0) { Write-Error ("Arquivos obrigatórios ausentes: " + ($missing -join ', ')) }
  if ($forbidden.Count -gt 0) { Write-Error ("Entradas proibidas no pacote: " + ($forbidden -join ', ')) }
  exit 1
}
Write-Output ("Pacote verificado: {0} entradas; arquivos obrigatórios presentes; nenhum artefato proibido." -f $entries.Count)
