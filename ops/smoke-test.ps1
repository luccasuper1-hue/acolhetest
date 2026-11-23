param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl
)

$ErrorActionPreference = "Stop"
$baseUri = $null
if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$baseUri) -or $baseUri.Scheme -notin @("http", "https") -or [string]::IsNullOrWhiteSpace($baseUri.Host) -or $baseUri.UserInfo -or $baseUri.Query -or $baseUri.Fragment) {
  throw "Smoke test failed: BaseUrl must be an absolute http(s) origin without credentials, query or fragment."
}
$normalized = $baseUri.AbsoluteUri.TrimEnd("/")
$live = Invoke-WebRequest -Uri "$normalized/api/live" -UseBasicParsing -TimeoutSec 20
$health = Invoke-WebRequest -Uri "$normalized/api/health" -UseBasicParsing -TimeoutSec 20
$head = Invoke-WebRequest -Uri "$normalized/api/health" -Method Head -UseBasicParsing -TimeoutSec 20
$page = Invoke-WebRequest -Uri "$normalized/" -UseBasicParsing -TimeoutSec 20
$robots = Invoke-WebRequest -Uri "$normalized/robots.txt" -UseBasicParsing -TimeoutSec 20
$sitemap = Invoke-WebRequest -Uri "$normalized/sitemap.xml" -UseBasicParsing -TimeoutSec 20

if ($live.StatusCode -ne 200 -or $health.StatusCode -ne 200 -or $head.StatusCode -ne 200 -or $page.StatusCode -ne 200 -or $robots.StatusCode -ne 200 -or $sitemap.StatusCode -ne 200) {
  throw "Smoke test failed: expected HTTP 200 on liveness, readiness, home and discovery endpoints."
}

$payload = $health.Content | ConvertFrom-Json
if ($payload.ok -ne $true -or $payload.service -ne "acolhe" -or $payload.database -ne "ok") {
  throw "Smoke test failed: healthcheck is not healthy."
}
$allowedHealthFields = @("ok", "service", "environment", "database", "checked_at")
$unexpectedHealthFields = @($payload.PSObject.Properties.Name | Where-Object { $_ -notin $allowedHealthFields })
if ($unexpectedHealthFields.Count -gt 0) { throw "Smoke test failed: healthcheck exposes unexpected fields." }
$checkedAt = [DateTime]::MinValue
if (-not [DateTime]::TryParse($payload.checked_at, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$checkedAt)) {
  throw "Smoke test failed: healthcheck checked_at is not a valid timestamp."
}

if ($health.Headers["Content-Type"] -notmatch "^application/json(?:;|$)" -or $head.Headers["Content-Type"] -notmatch "^application/json(?:;|$)") {
  throw "Smoke test failed: healthcheck must return application/json."
}

if ($health.Headers["Cache-Control"] -notcontains "no-store" -or $head.Headers["Cache-Control"] -notcontains "no-store") {
  throw "Smoke test failed: healthcheck must not be cached."
}
if ($health.Headers["X-Content-Type-Options"] -ne "nosniff" -or $head.Headers["X-Content-Type-Options"] -ne "nosniff") {
  throw "Smoke test failed: healthcheck must send nosniff."
}

foreach ($header in @("Strict-Transport-Security", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy")) {
  if (-not $page.Headers[$header]) { throw "Smoke test failed: missing security header $header." }
}
if ($page.Headers["X-Content-Type-Options"] -ne "nosniff") { throw "Smoke test failed: X-Content-Type-Options must be nosniff." }
if ($page.Headers["Permissions-Policy"] -notmatch "camera=\(\).*microphone=\(\).*geolocation=\(\)") { throw "Smoke test failed: permissions policy is not restrictive." }
if ($robots.Content -notmatch "(?i)Sitemap:\s*https?://[^\s]+/sitemap\.xml") { throw "Smoke test failed: robots.txt must advertise a sitemap." }
if ($sitemap.Content -notmatch "(?is)<urlset[\s>].*?<loc>https?://[^<]+</loc>.*?</urlset>") { throw "Smoke test failed: sitemap.xml must contain at least one URL." }
if ($sitemap.Content -notmatch [regex]::Escape("$normalized/")) { throw "Smoke test failed: sitemap.xml points to another origin." }
if ($robots.Headers["Content-Type"] -notmatch "^text/plain(?:;|$)") { throw "Smoke test failed: robots.txt must be text/plain." }
if ($sitemap.Headers["Content-Type"] -notmatch "^(?:application|text)/xml(?:;|$)") { throw "Smoke test failed: sitemap.xml must be XML." }
foreach ($route in @("/politica-de-cookies", "/ajuda/instituicoes", "/preciso-ajuda", "/termos/estudante", "/termos/profissional", "/termos/instituicao")) {
  if ($sitemap.Content -notmatch [regex]::Escape("$normalized$route")) { throw "Smoke test failed: sitemap.xml is missing $route." }
}

$assetMatch = [regex]::Match($page.Content, '/assets/[^"''\s>]+')
if (-not $assetMatch.Success) { throw "Smoke test failed: home did not reference a build asset." }
$asset = Invoke-WebRequest -Uri "$normalized$($assetMatch.Value)" -UseBasicParsing -TimeoutSec 20
if ($asset.StatusCode -ne 200 -or $asset.Headers["X-Content-Type-Options"] -ne "nosniff" -or $asset.Headers["Cache-Control"] -notmatch "immutable") { throw "Smoke test failed: referenced build asset is unavailable or missing immutable cache/nosniff." }

Write-Output "Smoke test passed: home, GET/HEAD health, discovery files and security headers."
