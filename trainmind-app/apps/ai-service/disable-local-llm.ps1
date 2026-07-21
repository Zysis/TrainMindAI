# ==================================================================
# Switch da LLM locale -> OpenAI fallback
# ==================================================================
#   .\disable-local-llm.ps1
# ==================================================================

$ErrorActionPreference = 'Stop'
# Docker scrive messaggi info su stderr; non vogliamo che PowerShell li tratti come errori.
$PSNativeCommandUseErrorActionPreference = $false
$appDir = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app"
$overrideFile = "$appDir\docker-compose.override.yml"

$content = @'
# Local override - modo OPENAI fallback
# Per attivare LoRA locale: .\enable-local-llm.ps1

services:
  ai-service:
    depends_on: !override
      postgres:
        condition: service_healthy
    environment:
      LOCAL_LLM_ENABLED: 'false'

  llm-server:
    profiles:
      - llm
'@
Set-Content -Path $overrideFile -Value $content -Encoding UTF8

Push-Location $appDir
docker compose stop llm-server *> $null
docker compose rm -f llm-server *> $null
docker compose up -d ai-service
Pop-Location

Write-Host "Switched to OpenAI fallback. Test: curl.exe http://localhost:3002/health" -ForegroundColor Green
