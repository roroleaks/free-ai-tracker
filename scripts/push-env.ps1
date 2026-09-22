# Loads real values from .env.local and pushes them to Vercel, then redeploys production.
$ErrorActionPreference = "Stop"
Set-Location -Path (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path ".env.local")) { Write-Host "ERROR: .env.local not found"; exit 1 }

$fields = @{}
Get-Content ".env.local" | ForEach-Object {
  if ($_ -match "^\s*([A-Z0-9_]+)=(.*)$") {
    $fields[$Matches[1]] = $Matches[2]
  }
}

$required = @("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "BREVO_API_KEY", "EMAIL_FROM", "EMAIL_TO")
$optional = @("GITHUB_TOKEN", "REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET")
$missing = $required | Where-Object { -not $fields[$_] }
if ($missing) {
  Write-Host "ERROR: missing values in .env.local: $($missing -join ', ')"
  exit 1
}

if (-not $env:VERCEL_TOKEN) {
  Write-Host "ERROR: set VERCEL_TOKEN env var first (do not commit it in this script)"
  exit 1
}

$vc = "$env:APPDATA\npm\node_modules\vercel\dist\index.js"

foreach ($key in $required) {
  Write-Host "Adding $key ..."
  $fields[$key] | & node $vc env add $key production --project free-ai-tracker --scope raouf12 2>&1 | Select-String "Added|Error|error"
}

foreach ($key in $optional) {
  if ($fields[$key]) {
    Write-Host "Adding $key ..."
    $fields[$key] | & node $vc env add $key production --project free-ai-tracker --scope raouf12 2>&1 | Select-String "Added|Error|error"
  }
}

Write-Host "--- Redeploying production ---"
& node $vc deploy --prod --yes --project free-ai-tracker --scope raouf12 2>&1 | Select-Object -Last 4
Write-Host "DONE."