# TrainMindAI — Guida RunPod per Training e Serving

> Istruzioni step-by-step per eseguire il training QLoRA e il serving vLLM su RunPod.

---

## 1. Prerequisiti Locali

Prima di andare su RunPod, assicurati di avere completato:

```bash
# Step 1-3 (già completati)
python scripts/01_chunk_kb.py      # ✅ 199 chunk
python scripts/02_embed_kb.py      # ✅ embeddings (199, 384)
python scripts/03_index_vectordb.py # ✅ Qdrant indicizzato

# Step 4 (già completato)
python scripts/04_generate_sft_dataset.py  # ✅ 160 train + 40 eval
```

File da caricare su RunPod:
- `data/sft/train.jsonl` (dataset training)
- `data/sft/eval.jsonl` (dataset eval)
- `src/trainer.py` (modulo trainer)
- `config/settings.py` (configurazione)
- `.env` (con HF_TOKEN compilato)

---

## 2. Creare un Pod su RunPod

### Configurazione Consigliata

| Parametro | Valore | Note |
|-----------|--------|------|
| **GPU** | NVIDIA A10 (24GB) | Minimo per QLoRA su Mistral 24B |
| **Template** | RunPod PyTorch 2.x | Include CUDA 12.x |
| **Disk** | 80 GB | Per modello + adapter + cache |
| **Volume** | 50 GB (opzionale) | Per persistere i risultati |

### Alternative GPU

| GPU | VRAM | Costo ~$/h | Note |
|-----|------|-----------|------|
| A10 24GB | 24 GB | $0.44 | Sufficiente per QLoRA |
| L4 24GB | 24 GB | $0.34 | Più economica, leggermente più lenta |
| RTX 4090 | 24 GB | $0.44 | Buone prestazioni |
| A100 40GB | 40 GB | $1.64 | Consigliata per batch size maggiori |
| A100 80GB | 80 GB | $2.21 | Per serving senza quantizzazione |

### Passo-Passo

1. Vai su [runpod.io](https://www.runpod.io) e crea un account
2. Aggiungi credito (minimo $10, sufficiente per ~20h su A10)
3. Clicca **Deploy** → **GPU Pod**
4. Seleziona **A10 24GB** (o L4 24GB per risparmiare)
5. Template: **RunPod Pytorch 2.4.0** (o più recente)
6. Disk: 80 GB, Volume: 50 GB
7. Clicca **Deploy On-Demand**

---

## 3. Setup dell'Ambiente sul Pod

Una volta che il pod è attivo, connettiti via **Web Terminal** o **SSH**.

```bash
# 1. Aggiorna pip
pip install --upgrade pip

# 2. Installa dipendenze training
pip install \
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
    pyyaml

# 3. Verifica CUDA
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}, VRAM: {torch.cuda.get_device_properties(0).total_mem/1e9:.1f}GB')"

# 4. Login Hugging Face (necessario per Mistral gated model)
pip install huggingface_hub
huggingface-cli login --token YOUR_HF_TOKEN
```

---

## 4. Caricare i File

### Opzione A: Upload diretto (Web UI)

1. Nel pod RunPod, clicca su **File Manager**
2. Crea cartella `/workspace/trainmind/`
3. Carica i file necessari

### Opzione B: Git clone (consigliata)

```bash
cd /workspace
git clone https://github.com/YOUR_ORG/TrainMindAI.git
cd TrainMindAI/model_production/llm_model
```

### Opzione C: SCP/rsync

```bash
# Dal tuo PC locale:
scp -P PORT -r data/sft/ root@POD_IP:/workspace/trainmind/data/sft/
scp -P PORT src/trainer.py root@POD_IP:/workspace/trainmind/src/
scp -P PORT config/settings.py root@POD_IP:/workspace/trainmind/config/
scp -P PORT .env root@POD_IP:/workspace/trainmind/
```

---

## 5. Training QLoRA (Step 05)

### Esecuzione

```bash
cd /workspace/trainmind  # o il path del tuo progetto

# Verifica prerequisiti
python scripts/05_train_lora.py
```

### Cosa Aspettarsi

| Fase | Durata stimata (A10) | Note |
|------|---------------------|------|
| Download modello | 10-15 min | ~13 GB (4-bit) |
| Caricamento + quantizzazione | 5-10 min | |
| Training (3 epochs, 160 esempi) | 15-30 min | Dipende da seq_length |
| Salvataggio adapter | 1-2 min | ~100-200 MB |
| **Totale** | **~30-60 min** | **~$0.40 su A10** |

### Parametri Personalizzabili

Se vuoi modificare i parametri, edita `.env`:

```env
# Aumentare per dataset più grandi
TRAINING_EPOCHS=3
TRAINING_BATCH_SIZE=4
TRAINING_GRAD_ACCUM=8

# LoRA config (default va bene per iniziare)
LORA_RANK=16
LORA_ALPHA=32
```

### Output

Il training produce:
```
outputs/lora/adapter/
├── adapter_config.json
├── adapter_model.safetensors  # ~100-200 MB
├── tokenizer.json
├── tokenizer_config.json
└── special_tokens_map.json
```

### Scaricare l'Adapter

```bash
# Dal tuo PC locale:
scp -P PORT -r root@POD_IP:/workspace/trainmind/outputs/lora/adapter/ ./outputs/lora/adapter/
```

---

## 6. Serving con vLLM (Step 07)

### Opzione A: Stesso Pod del Training

```bash
# Installa vLLM
pip install vllm

# Avvia senza LoRA (modello base)
vllm serve mistralai/Mistral-Small-3.1-24B-Instruct-2503 \
    --quantization awq \
    --max-model-len 8192 \
    --port 8000

# Avvia CON LoRA adapter
vllm serve mistralai/Mistral-Small-3.1-24B-Instruct-2503 \
    --quantization awq \
    --max-model-len 8192 \
    --port 8000 \
    --enable-lora \
    --lora-modules trainmind=/workspace/trainmind/outputs/lora/adapter \
    --max-lora-rank 16
```

### Opzione B: Template vLLM Dedicato su RunPod

1. Su RunPod, crea un nuovo pod con template **vLLM**
2. Configura le variabili d'ambiente:

```
MODEL_NAME=mistralai/Mistral-Small-3.1-24B-Instruct-2503
QUANTIZATION=awq
MAX_MODEL_LEN=8192
HF_TOKEN=hf_xxx
```

3. Se hai un LoRA adapter, caricalo e aggiungi:
```
ENABLE_LORA=true
LORA_MODULES=trainmind=/workspace/lora
```

### Endpoint

Una volta avviato, l'endpoint è accessibile a:
- **Locale sul pod**: `http://localhost:8000/v1`
- **Via RunPod proxy**: `https://POD_ID-8000.proxy.runpod.net/v1`

### Test dall'Esterno

```bash
curl https://POD_ID-8000.proxy.runpod.net/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "trainmind",
    "messages": [{"role": "user", "content": "Cos'\''è l'\''ACWR?"}],
    "temperature": 0.3,
    "max_tokens": 500
  }'
```

---

## 7. Configurazione App dopo Deployment

Aggiorna il `.env` locale per puntare al vLLM su RunPod:

```env
LLM_PROVIDER=vllm
LLM_BASE_URL=https://POD_ID-8000.proxy.runpod.net/v1
LLM_API_KEY=token-placeholder
LLM_MODEL=trainmind
```

Poi esegui la eval e i test:

```bash
python scripts/06_eval_model.py         # Eval metriche
python scripts/08_test_integration.py   # Test end-to-end con vLLM
```

---

## 8. Costi Stimati

| Operazione | GPU | Durata | Costo |
|-----------|-----|--------|-------|
| Training QLoRA | A10 24GB | ~1h | ~$0.50 |
| Eval completa | A10 24GB | ~30 min | ~$0.25 |
| Serving (per ora) | A10 24GB | continuo | $0.44/h |
| Serving (per ora) | L4 24GB | continuo | $0.34/h |

**Budget consigliato per prima iterazione**: $5-10 (training + eval + qualche ora di serving per test).

---

## 9. Troubleshooting

### "CUDA out of memory"
- Riduci `TRAINING_BATCH_SIZE` a 2
- Riduci `max_seq_length` a 1024
- Usa `gradient_checkpointing=True` (già attivo di default)

### "Model requires gated access"
- Vai su https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct-2503
- Accetta la licenza
- Assicurati che `HF_TOKEN` sia configurato

### "Connection refused" su vLLM
- Il modello impiega 5-10 minuti per caricarsi. Attendi.
- Verifica con: `curl http://localhost:8000/health`

### Training troppo lento
- Verifica che stia usando la GPU: `nvidia-smi`
- Se bf16 non è supportato, cambia a fp16 in trainer.py

---

*Guida versione 1.0 — Maggio 2026*
