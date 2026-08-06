# TrainMindAI — Deploy su RunPod (Quick Start)

## 1. Crea Pod RunPod
- Vai su https://runpod.io → Deploy → GPU Pod
- GPU (in ordine di preferenza):
  1. **RTX 4090** 24GB ($0.69/h) — scelta consigliata
  2. **L40S** 46GB ($0.86/h) — alternativa se 4090 non disponibile
  3. **RTX PRO 6000** 96GB ($1.18/h) — overkill ma funziona
- Template: **RunPod PyTorch 2.4.0**
- Disk: **80 GB**, Volume: **50 GB**

## 2. Carica questo pacchetto
```bash
# Opzione A: SCP dal tuo PC
scp -P PORT deploy_package.zip root@POD_IP:/workspace/
ssh -p PORT root@POD_IP
cd /workspace && unzip deploy_package.zip -d trainmind && cd trainmind

# Opzione B: Upload via RunPod File Manager
# Decomprimi nella cartella /workspace/trainmind/
```

## 3. Configura .env
```bash
cp .env.example .env
# Edita .env e inserisci:
#   HF_TOKEN=hf_xxx (da https://huggingface.co/settings/tokens)
#   OPENAI_API_KEY=sk-xxx (opzionale, per eval comparativa)
nano .env
```

## 4. Lancia training
```bash
chmod +x scripts/runpod_setup.sh
./scripts/runpod_setup.sh
```

**Tempo stimato**: ~45 min su A10, costo ~$0.50

## 5. Avvia serving (opzionale, stesso pod)
```bash
pip install vllm
vllm serve mistralai/Mistral-Small-3.1-24B-Instruct-2503 \
  --quantization awq --max-model-len 8192 --port 8000 \
  --enable-lora \
  --lora-modules trainmind=./outputs/lora/adapter \
  --max-lora-rank 16
```

## 6. Scarica adapter sul tuo PC
```bash
# Dal tuo PC:
scp -P PORT -r root@POD_IP:/workspace/trainmind/outputs/lora/adapter/ ./outputs/lora/adapter/
```

## Contenuto del pacchetto
```
trainmind/
├── src/           # 9 moduli Python
├── config/        # settings.py
├── scripts/       # 04, 05, 06 + runpod_setup.sh
├── data/sft/      # 272 train + 68 eval
├── prompts/       # system prompts YAML
├── requirements.txt
└── .env.example
```
