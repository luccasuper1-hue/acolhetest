param(
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$output = [System.IO.Path]::GetFullPath($OutputPath)
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("acolhe-release-" + [guid]::NewGuid().ToString("N"))
$excludedDirectories = @(
  ".git", ".edge-shot", ".browser-profile", ".playwright", ".auth", ".wrangler",
  "node_modules", "build", "dist", "coverage", ".cache", "__pycache__"
)
$excludedExtensions = @(".zip", ".tar", ".tar.gz", ".tgz", ".pyc", ".pyo", ".log")
$excludedFileNames = @(".env", ".dev.vars", ".dev.vars.example", "credentials.json", "token.json")

try {
  New-Item -ItemType Directory -Force -Path $staging | Out-Null
  Get-ChildItem -LiteralPath $root -File -Recurse -Force | Where-Object {
    $relative = $_.FullName.Substring($root.Length).TrimStart([char[]]@('\', '/'))
    $parts = $relative -split '[\\/]'
    ($parts | Where-Object { $excludedDirectories -contains $_ }).Count -eq 0 -and
      ($excludedExtensions -notcontains $_.Extension.ToLowerInvariant()) -and
      ($excludedFileNames -notcontains $_.Name) -and
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
  if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $output -CompressionLevel Optimal
  Write-Output "Pacote criado sem perfis, caches ou artefatos locais: $output"
}
finally {
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}
