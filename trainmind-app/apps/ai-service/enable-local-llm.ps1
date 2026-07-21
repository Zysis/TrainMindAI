# ==================================================================
# Switch da OpenAI fallback -> LLM locale TrainMind (LoRA)
# ==================================================================
# Esegui DOPO che setup-local-llm.ps1 ha prodotto i due file:
#   - apps/ai-service/models/trainmind-mistral-7b-Q4_K_M.gguf
#   - apps/ai-service/models/trainmind-lora.gguf
#
#   .\enable-local-llm.ps1
# ==================================================================

$ErrorActionPreference = 'Stop'
# Docker scrive messaggi info su stderr; non vogliamo che PowerShell li tratti come errori.
$PSNativeCommandUseErrorActionPreference = $false

$root      = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI"
$appDir    = "$root\trainmind-app"
$modelsDir = "$appDir\apps\ai-service\models"
$overrideFile = "$appDir\docker-compose.override.yml"

# 1. Verifica file modello
Write-Host "[1/5] Verifica file modello..." -ForegroundColor Cyan
$base = "$modelsDir\trainmind-mistral-7b-Q4_K_M.gguf"
$lora = "$modelsDir\trainmind-lora.gguf"
if (-not (Test-Path $base)) { throw "MANCA: $base. Esegui prima setup-local-llm.ps1" }
if (-not (Test-Path $lora)) { throw "MANCA: $lora. Esegui prima setup-local-llm.ps1" }
$baseSizeMB = [math]::Round((Get-Item $base).Length / 1MB, 1)
$loraSizeMB = [math]::Round((Get-Item $lora).Length / 1MB, 1)
Write-Host "      base  $baseSizeMB MB  OK" -ForegroundColor Green
Write-Host "      lora  $loraSizeMB MB  OK" -ForegroundColor Green

# 2. Rewrite override.yml
Write-Host "[2/5] Aggiorno docker-compose.override.yml -> modo LOCAL..." -ForegroundColor Cyan

$content = @'
# Local override - modo LOCAL LLM (LoRA TrainMind)
# Generato da enable-local-llm.ps1. Per tornare a OpenAI: .\disable-local-llm.ps1

services:
  ai-service:
    depends_on: !override
      postgres:
        condition: service_healthy
      llm-server:
        condition: service_healthy
    environment:
      LOCAL_LLM_ENABLED: 'true'
      LOCAL_LLM_BASE_URL: http://llm-server:8000/v1
      LOCAL_LLM_MODEL: trainmind
      # Timeout esteso: generazione CPU 7B Q4_K_M ~1-2 tok/s,
      # una risposta 500 token puo' impiegare 5-10 min.
      LOCAL_LLM_TIMEOUT: '600'

  llm-server:
    # Caricamento Mistral-7B Q4_K_M su CPU richiede 1-3 min al primo boot.
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 360s
    # Limite CPU per non saturare il PC. OMP_NUM_THREADS cappa anche il pool OpenMP.
    # Mistral-7B Q4_K_M su 6 core gira ~1-2 tok/s con CPU usage ~600% invece di 1200%.
    deploy:
      resources:
        limits:
          cpus: '6.0'
          memory: 8G
    environment:
      N_THREADS: '6'
      # N_CTX 8192: serve spazio per system prompt + 5 RAG sources + history + output.
      # 4096 era troppo stretto, il modello finiva il budget e tornava vuoto.
      N_CTX: '8192'
      OMP_NUM_THREADS: '6'
      MKL_NUM_THREADS: '6'
      OPENBLAS_NUM_THREADS: '6'
'@
Set-Content -Path $overrideFile -Value $content -Encoding UTF8
Write-Host "      override.yml aggiornato" -ForegroundColor Green

# 3. Build llm-server
Write-Host "[3/5] Build llm-server (puo richiedere 2-5 min)..." -ForegroundColor Cyan
Push-Location $appDir
docker compose build llm-server
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Build llm-server fallita" }

# 4. Up llm-server + ai-service
Write-Host "[4/5] Avvio llm-server + ai-service..." -ForegroundColor Cyan
docker compose up -d llm-server
Write-Host "      attendo che llm-server diventi healthy (caricamento modello, 60-180s)..." -ForegroundColor Yellow

$max = 480
$elapsed = 0
$status = ''
# Grace period esteso: caricamento Mistral-7B Q4_K_M su CPU = 1-3 min.
$grace = 360
while ($elapsed -lt $max) {
    Start-Sleep -Seconds 5
    $elapsed += 5
    $running = (docker inspect -f '{{.State.Running}}' trainmind-llm-server 2>$null)
    $status  = (docker inspect -f '{{.State.Health.Status}}' trainmind-llm-server 2>$null)
    Write-Host "      ($elapsed s) running:$running status:$status"
    if ($running -ne 'true') {
        Pop-Location
        throw "llm-server container exited. Esegui: docker compose logs llm-server"
    }
    if ($status -eq 'healthy') { break }
    if ($status -eq 'unhealthy' -and $elapsed -gt $grace) {
        Pop-Location
        throw "llm-server unhealthy dopo $elapsed s. Esegui: docker compose logs llm-server"
    }
}
if ($status -ne 'healthy') {
    Pop-Location
    throw "Timeout dopo $max s su llm-server. Logs: docker compose logs llm-server"
}

docker compose up -d ai-service
Pop-Location

# 5. Verifica /health
Write-Host "[5/5] Verifica /health di ai-service..." -ForegroundColor Cyan
Start-Sleep -Seconds 8
$resp = curl.exe -s http://localhost:3002/health
Write-Host $resp -ForegroundColor White

if ($resp -match '"llm_provider":"local"' -and $resp -match '"local_llm":"(up|operational)"') {
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host " SUCCESS - chat ora usa il LoRA TrainMind in locale." -ForegroundColor Green
    Write-Host " Zero costi API per ogni risposta." -ForegroundColor Green
    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test: vai su http://localhost:3003/dashboard/chat e chiedi qualcosa." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "AVVISO: /health non mostra 'llm_provider':'local'. Verifica:" -ForegroundColor Red
    Write-Host "  docker compose logs llm-server --tail 30" -ForegroundColor Yellow
    Write-Host "  docker compose logs ai-service --tail 30" -ForegroundColor Yellow
}
