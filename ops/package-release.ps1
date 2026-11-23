param(
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$output = [System.IO.Path]::GetFullPath($OutputPath)
if ((Test-Path -LiteralPath $output) -and -not $Force) {
  throw "O pacote já existe: $output. Use -Force para sobrescrever explicitamente."
}
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("acolhe-release-" + [guid]::NewGuid().ToString("N"))
$excludedDirectories = @(
  ".git", ".edge-shot", ".browser-profile", ".playwright", ".auth", ".wrangler",
  "node_modules", "build", "dist", "coverage", ".cache", "__pycache__", ".pytest_cache"
)
$excludedExtensions = @(".zip", ".tar", ".tar.gz", ".tgz", ".pyc", ".pyo", ".log", ".sqlite", ".sqlite3", ".db")
$excludedFileNames = @(".env", ".dev.vars", "credentials.json", "token.json", "test-output.txt")

$safeVarsTemplate = Join-Path $root "cloudflare-worker/.dev.vars.example"
if (-not (Test-Path -LiteralPath $safeVarsTemplate -PathType Leaf)) {
  throw "Template seguro ausente: cloudflare-worker/.dev.vars.example"
}

try {
  New-Item -ItemType Directory -Force -Path $staging | Out-Null
  Get-ChildItem -LiteralPath $root -File -Recurse -Force | Where-Object {
    $relative = $_.FullName.Substring($root.Length).TrimStart([char[]]@('\', '/'))
    $parts = $relative -split '[\\/]'
    ($parts | Where-Object { $excludedDirectories -contains $_ }).Count -eq 0 -and
      ($excludedExtensions -notcontains $_.Extension.ToLowerInvariant()) -and
      ($_.Name -notmatch '(?i)\.(?:tar\.gz|tgz)$') -and
      ($excludedFileNames -notcontains $_.Name) -and
      ($_.Name -notmatch '^home-mobile-.*\.png$') -and
      ($_.Name -notmatch '^loop-home-.*\.png$') -and
      ($_.Name -notmatch '^mobile-check\.png$') -and
      ($_.Name -notmatch '^\.env(?:\.|$)') -and
      ($_.Name -notmatch '(?i)(^|[-_.])(credentials?|secrets?|private[-_]?key|access[-_]?token)([-_.]|$)') -and
      ($_.Extension.ToLowerInvariant() -notin @(".pem", ".key")) -and
      $_.FullName -ne $output
  } | ForEach-Object {
    $relative = $_.FullName.Substring($root.Length).TrimStart([char[]]@('\', '/'))
    $target = Join-Path $staging $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $output) | Out-Null
  $packagedTemplate = Join-Path $staging "cloudflare-worker/.dev.vars.example"
  if (-not (Test-Path -LiteralPath $packagedTemplate -PathType Leaf)) {
    throw "O pacote não contém o template seguro cloudflare-worker/.dev.vars.example"
  }
  if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $output -CompressionLevel Optimal
  Write-Output "Pacote criado sem perfis, caches ou artefatos locais: $output"
}
finally {
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}
