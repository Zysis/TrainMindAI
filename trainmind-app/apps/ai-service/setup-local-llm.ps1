# ==================================================================
# Setup LLM locale + LoRA TrainMind
# ==================================================================
# Esegui UNA VOLTA da PowerShell. Tempo totale ~20-40 min.
#
#   .\setup-local-llm.ps1
#
# Cosa fa:
#  1) Crea apps/ai-service/models/
#  2) Scarica Mistral-7B-Instruct-v0.3 Q4_K_M GGUF (~4 GB)
#  3) Lancia un container python:3.11 che esegue il convert_lora_to_gguf.py
#     di llama.cpp sul tuo LoRA → produce trainmind-lora.gguf (~30 MB)
#  4) Pulisce container temporaneo
#
# Requisiti: Docker Desktop avviato. ~6 GB liberi su disco.
# ==================================================================

$ErrorActionPreference = 'Stop'

$root      = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI"
$modelsDir = "$root\trainmind-app\apps\ai-service\models"
$loraDir   = "$root\model_production\llm_model\outputs\lora\lora\adapter"

# ─── 1. Crea cartella modelli ──────────────────────────────────────
Write-Host "[1/4] Creazione cartella models/..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

# ─── 2. Download base GGUF ─────────────────────────────────────────
$basePath = "$modelsDir\trainmind-mistral-7b-Q4_K_M.gguf"
if (Test-Path $basePath) {
    Write-Host "[2/4] Base GGUF gia' presente. Skip download." -ForegroundColor Green
} else {
    Write-Host "[2/4] Download base GGUF (Mistral-7B-Instruct-v0.3 Q4_K_M, ~4 GB)..." -ForegroundColor Cyan
    $url = "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf?download=true"
    # curl di Windows 10+ esiste come curl.exe
    # --ssl-no-revoke: aggira il bug CRYPT_E_NO_REVOCATION_CHECK su Win + corporate proxy
    curl.exe -L --ssl-no-revoke --progress-bar -o $basePath $url
    if ($LASTEXITCODE -ne 0) {
        Write-Host "curl fallito, provo con BitsTransfer (PowerShell nativo)..." -ForegroundColor Yellow
        Import-Module BitsTransfer -ErrorAction SilentlyContinue
        Start-BitsTransfer -Source $url -Destination $basePath -DisplayName "Mistral GGUF" -ErrorAction Stop
    }
    Write-Host "      OK ($(Get-Item $basePath).Length / 1MB MB)" -ForegroundColor Green
}

# ─── 3. Conversione LoRA → GGUF via container Python ───────────────
$loraOut = "$modelsDir\trainmind-lora.gguf"
if (Test-Path $loraOut) {
    Write-Host "[3/4] LoRA GGUF gia' presente. Skip conversione." -ForegroundColor Green
} else {
    Write-Host "[3/4] Conversione LoRA safetensors -> GGUF (container python:3.11)..." -ForegroundColor Cyan

    if (-not (Test-Path $loraDir)) { throw "Cartella LoRA non trovata: $loraDir" }

    # Scrivi un config.json minimo per Mistral-7B-Instruct-v0.3.
    # Cosi' convert_lora_to_gguf NON deve scaricare nulla da HF (Mistral e' gated).
    $baseCfgDir = "$env:TEMP\trainmind-base-cfg"
    New-Item -ItemType Directory -Force -Path $baseCfgDir | Out-Null
    @'
{
  "architectures": ["MistralForCausalLM"],
  "attention_dropout": 0.0,
  "bos_token_id": 1,
  "eos_token_id": 2,
  "hidden_act": "silu",
  "hidden_size": 4096,
  "initializer_range": 0.02,
  "intermediate_size": 14336,
  "max_position_embeddings": 32768,
  "model_type": "mistral",
  "num_attention_heads": 32,
  "num_hidden_layers": 32,
  "num_key_value_heads": 8,
  "rms_norm_eps": 1e-05,
  "rope_theta": 1000000.0,
  "sliding_window": null,
  "tie_word_embeddings": false,
  "torch_dtype": "bfloat16",
  "transformers_version": "4.42.0",
  "use_cache": true,
  "vocab_size": 32768
}
'@ | Set-Content -Path "$baseCfgDir\config.json" -Encoding ASCII

    # Copia tokenizer dal LoRA folder (PEFT include sempre i tokenizer files)
    Copy-Item "$loraDir\tokenizer.json"       "$baseCfgDir\" -Force
    Copy-Item "$loraDir\tokenizer_config.json" "$baseCfgDir\" -Force

    $convertScript = @'
set -eu
echo "=== installing system deps (git) ==="
apt-get update -qq && apt-get install -y -qq --no-install-recommends git ca-certificates
echo "=== installing deps (torch CPU + transformers + gguf) ==="
pip install --quiet --no-cache-dir \
  --extra-index-url https://download.pytorch.org/whl/cpu \
  torch==2.6.0 transformers safetensors gguf sentencepiece protobuf
echo "=== cloning llama.cpp scripts ==="
git clone --depth 1 https://github.com/ggerganov/llama.cpp.git /llama.cpp
cd /llama.cpp
echo "=== running convert_lora_to_gguf.py ==="
python3 convert_lora_to_gguf.py \
  --outfile /out/trainmind-lora.gguf \
  --outtype f16 \
  --base /base \
  /lora
echo "=== done ==="
ls -la /out/
'@

    # Salva script temporaneo
    $tmpScript = New-TemporaryFile
    $convertScript | Set-Content -Path $tmpScript -NoNewline -Encoding ASCII

    # Mount: /lora (input), /base (HF config), /out (output), /script.sh (conversion)
    docker run --rm `
        -v "${loraDir}:/lora:ro" `
        -v "${baseCfgDir}:/base:ro" `
        -v "${modelsDir}:/out" `
        -v "${tmpScript}:/script.sh:ro" `
        --entrypoint bash `
        python:3.11-slim `
        /script.sh

    if ($LASTEXITCODE -ne 0) { throw "Conversione LoRA fallita (exit $LASTEXITCODE)" }
    Remove-Item $tmpScript -Force
    Write-Host "      OK trainmind-lora.gguf prodotto" -ForegroundColor Green
}

# ─── 4. Riepilogo ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Verifica finale" -ForegroundColor Cyan
Get-ChildItem $modelsDir | Format-Table Name, @{Name='SizeMB';Expression={[math]::Round($_.Length / 1MB, 1)}}, LastWriteTime

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " Setup completato. Prossimi passi (eseguiti da te a mano):" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  cd $root\trainmind-app"
Write-Host "  docker compose --profile llm up -d --build llm-server"
Write-Host "  docker compose restart ai-service"
Write-Host "  curl http://localhost:3002/health"
Write-Host ""
Write-Host "Atteso: ""llm_provider"":""local"", ""local_llm"":""up""" -ForegroundColor Yellow
