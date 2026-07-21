#!/bin/bash
# =============================================================================
# TrainMindAI — RunPod Setup & Training Script
# =============================================================================
# Eseguire su un pod RunPod con GPU ≥ 24GB VRAM (A10, L4, RTX 4090, A100)
#
# Uso:
#   1. Connettiti al pod via SSH o Web Terminal
#   2. Clona il repo o carica i file
#   3. chmod +x scripts/runpod_setup.sh
#   4. ./scripts/runpod_setup.sh
#
# Il script:
#   - Installa tutte le dipendenze
#   - Verifica GPU e VRAM
#   - Esegue il training QLoRA
#   - Salva l'adapter LoRA
# =============================================================================

set -e  # Exit on error

echo "============================================="
echo "  TrainMindAI — RunPod Setup"
echo "============================================="

# --- 0. Verifica directory ---
if [ ! -f "config/settings.py" ]; then
    echo "❌ Errore: eseguire dalla root del progetto llm_model/"
    echo "   cd /workspace/TrainMindAI/model_production/llm_model"
    exit 1
fi

# --- 1. Installa dipendenze ---
echo ""
echo "📦 [1/5] Installazione dipendenze..."
pip install --upgrade pip -q

pip install -q \
    torch \
    transformers>=4.44.0 \
    trl>=0.9.0 \
    peft>=0.12.0 \
    bitsandbytes>=0.43.0 \
    datasets \
    accelerate \
    pydantic>=2.0 \
    pydantic-settings \
    python-dotenv \
    rich \
    pyyaml \
    numpy \
    tqdm

echo "✅ Dipendenze installate"

# --- 2. Verifica GPU ---
echo ""
echo "🔍 [2/5] Verifica GPU..."
python -c "
import torch
if not torch.cuda.is_available():
    print('❌ CUDA non disponibile! Serve una GPU.')
    exit(1)
gpu_name = torch.cuda.get_device_name(0)
vram_gb = torch.cuda.get_device_properties(0).total_mem / 1e9
print(f'✅ GPU: {gpu_name}')
print(f'   VRAM: {vram_gb:.1f} GB')
if vram_gb < 20:
    print(f'⚠️  VRAM potrebbe essere insufficiente (<24 GB). Potrebbe servire ridurre batch_size.')
"

# --- 3. Verifica Hugging Face login ---
echo ""
echo "🔑 [3/5] Verifica accesso Hugging Face..."
if [ -z "$HF_TOKEN" ]; then
    if [ -f ".env" ]; then
        export HF_TOKEN=$(grep HF_TOKEN .env | cut -d'=' -f2)
    fi
fi

if [ -z "$HF_TOKEN" ]; then
    echo "⚠️  HF_TOKEN non trovato. Se il modello è gated, fare:"
    echo "   export HF_TOKEN=hf_xxx"
    echo "   oppure aggiungerlo a .env"
else
    echo "✅ HF_TOKEN configurato"
    huggingface-cli login --token "$HF_TOKEN" 2>/dev/null || pip install -q huggingface_hub && huggingface-cli login --token "$HF_TOKEN"
fi

# --- 4. Verifica dataset ---
echo ""
echo "📂 [4/5] Verifica dataset SFT..."
if [ ! -f "data/sft/train.jsonl" ]; then
    echo "❌ Dataset non trovato: data/sft/train.jsonl"
    echo "   Generare con: python scripts/04_generate_sft_dataset.py"
    exit 1
fi

TRAIN_COUNT=$(wc -l < data/sft/train.jsonl)
EVAL_COUNT=$(wc -l < data/sft/eval.jsonl)
echo "✅ Dataset trovato: ${TRAIN_COUNT} train, ${EVAL_COUNT} eval"

# --- 5. Training ---
echo ""
echo "🚀 [5/5] Avvio training QLoRA..."
echo "============================================="
echo "  Modello: mistralai/Mistral-Small-3.1-24B-Instruct-2503"
echo "  Metodo: QLoRA (4-bit NF4)"
echo "  LoRA rank: 16, alpha: 32"
echo "  Dataset: ${TRAIN_COUNT} esempi training"
echo "============================================="
echo ""

python scripts/05_train_lora.py

echo ""
echo "============================================="
echo "  ✅ Training completato!"
echo "============================================="

# --- 6. Verifica output ---
if [ -d "outputs/lora/adapter" ]; then
    echo ""
    echo "📦 Adapter salvato in: outputs/lora/adapter/"
    ls -lh outputs/lora/adapter/
    echo ""
    echo "Per scaricare l'adapter sul tuo PC:"
    echo "  scp -P PORT -r root@POD_IP:$(pwd)/outputs/lora/adapter/ ./outputs/lora/adapter/"
    echo ""
    echo "Per avviare vLLM con l'adapter:"
    echo "  pip install vllm"
    echo "  vllm serve mistralai/Mistral-Small-3.1-24B-Instruct-2503 \\"
    echo "    --quantization awq \\"
    echo "    --max-model-len 8192 \\"
    echo "    --port 8000 \\"
    echo "    --enable-lora \\"
    echo "    --lora-modules trainmind=$(pwd)/outputs/lora/adapter \\"
    echo "    --max-lora-rank 16"
else
    echo "⚠️  Adapter non trovato in outputs/lora/adapter/"
    echo "   Verificare i log di training per errori."
fi
