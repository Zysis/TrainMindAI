# TrainMindAI — LLM Model Pipeline

> Pipeline completa per creare, addestrare e servire il modello AI di TrainMindAI.
> Architettura: **RAG + LoRA leggera su modello open-weight (Mistral Small 24B) servito con vLLM**.

---

## Indice

1. [Panoramica](#panoramica)
2. [Struttura del progetto](#struttura-del-progetto)
3. [Prerequisiti](#prerequisiti)
4. [Setup rapido](#setup-rapido)
5. [Pipeline step-by-step](#pipeline-step-by-step)
6. [Aggiornamento futuro](#aggiornamento-futuro)
7. [Documentazione correlata](#documentazione-correlata)

---

## Panoramica

TrainMindAI è una web app SaaS per preparatori fisici di basket. Questo modulo contiene
la pipeline completa per:

- **Preparare la knowledge base** (documenti → chunk → embeddings → vector DB)
- **Creare il dataset SFT** (coppie input/output per insegnare lo stile al modello)
- **Addestrare una LoRA/QLoRA** sul modello base (Mistral Small 24B)
- **Servire il modello** con vLLM (endpoint OpenAI-compatible)
- **Valutare la qualità** prima di andare in produzione
- **Integrare** il tutto con l'app esistente (`apps/ai-service`)

### Decisione architetturale

| Tipo di logica | Dove vive | Esempio |
|----------------|-----------|---------|
| Conoscenza fattuale | **RAG** (Qdrant) | linee guida ACWR, definizioni RPE, protocolli RTP |
| Stile e formato output | **LoRA** | tono tecnico, struttura report, formato JSON |
| Regole decisionali / soglie | **Codice Python** | ACWR > 1.5 → alert |
| Output strutturato | **Pydantic schemas** | alert, sintesi atleta, report giornaliero |
| Sicurezza / disclaimer | **System prompt fisso** | "non sostituisce giudizio medico" |

---

## Struttura del progetto

```
llm_model/
├── README.md                    # Questa guida
├── ARCHITECTURE.md              # Architettura dettagliata del sistema
├── ROADMAP.md                   # Piano operativo 30 giorni
├── requirements.txt             # Dipendenze Python
├── .env.example                 # Template variabili d'ambiente
│
├── config/
│   ├── __init__.py
│   └── settings.py              # Configurazione centralizzata
│
├── docs/
│   ├── kb/                      # Knowledge base (24 documenti, 13 domini)
│   │   ├── acwr.md, rpe_srpe.md, workload_management.md, ...
│   │   ├── prevenzione_infortuni.md, gps_metrics.md, wellness_monitoring.md
│   │   ├── forza_resistenza.md, idratazione_nutrizione.md, pliometria_salto.md
│   │   └── ... (24 file .md totali)
│   └── RUNPOD_GUIDE.md          # Guida deployment RunPod
│
├── data/
│   ├── sft/                     # Dataset per fine-tuning
│   │   ├── train.jsonl          # Training set (272 esempi)
│   │   └── eval.jsonl           # Validation set (68 esempi)
│   ├── chunks/                  # Chunk e embeddings (199 chunk, 384 dim)
│   └── raw/                     # Dati grezzi (placeholder)
│
├── scripts/                     # Pipeline eseguibile in ordine
│   ├── 01_chunk_kb.py           # Step 1: Chunking documenti KB
│   ├── 02_embed_kb.py           # Step 2: Generazione embeddings
│   ├── 03_index_vectordb.py     # Step 3: Indicizzazione Qdrant
│   ├── 04_generate_sft_dataset.py  # Step 4: Creazione dataset SFT
│   ├── 05_train_lora.py         # Step 5: Training QLoRA
│   ├── 06_eval_model.py         # Step 6: Valutazione modello
│   ├── 07_serve_model.py        # Step 7: Avvio serving vLLM
│   └── 08_test_integration.py   # Step 8: Test integrazione end-to-end
│
├── src/                         # Moduli riutilizzabili
│   ├── __init__.py
│   ├── chunker.py               # Chunking intelligente dei documenti
│   ├── embedder.py              # Generazione embeddings
│   ├── vectordb.py              # Client Qdrant
│   ├── retriever.py             # Retriever RAG completo
│   ├── reranker.py              # Reranker per migliorare precision
│   ├── llm_client.py            # Client LLM (vLLM / OpenAI compatible)
│   ├── trainer.py               # Training LoRA/QLoRA
│   ├── evaluator.py             # Suite di valutazione
│   └── schemas.py               # Schemi Pydantic per output strutturati
│
├── prompts/                     # System prompts versionati
│   ├── system_coach.yaml        # Prompt per assistente coach
│   ├── system_reporter.yaml     # Prompt per generazione report
│   └── system_alert.yaml        # Prompt per generazione alert
│
└── tests/                       # Test unitari
    ├── test_chunker.py
    ├── test_retriever.py
    └── test_schemas.py
```

---

## Prerequisiti

### Software richiesto
- **Python 3.10+** (consigliato 3.11)
- **CUDA 12.1+** (per training e inferenza locale con GPU)
- **Docker** (opzionale, per Qdrant locale)

### Hardware minimo per esecuzione completa
- **RAG pipeline** (steps 1-3): CPU sufficiente, 16GB RAM
- **Training LoRA** (step 5): GPU con almeno 24GB VRAM (es. RTX 4090, A10, L4)
- **Serving vLLM** (step 7): GPU con almeno 24GB VRAM

### Account/servizi necessari
- **Hugging Face** (download modello base)
- **RunPod / Vast.ai** (GPU cloud on-demand, se non hai GPU locale)
- **Qdrant Cloud** (opzionale, altrimenti Docker locale)

---

## Setup rapido

```bash
# 1. Clona e entra nella cartella
cd model_production/llm_model

# 2. Crea virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# 3. Installa dipendenze
pip install -r requirements.txt

# 4. Copia e configura variabili d'ambiente
copy .env.example .env
# Modifica .env con i tuoi valori

# 5. (Opzionale) Avvia Qdrant locale con Docker
docker run -p 6333:6333 qdrant/qdrant
```

---

## Pipeline step-by-step

Esegui gli script **in ordine numerico**. Ogni script è indipendente e ri-eseguibile.

### Step 1 — Chunking Knowledge Base
```bash
python scripts/01_chunk_kb.py
```
Legge i documenti da `docs/kb/`, li divide in chunk da 400-800 token con overlap 80,
e salva i risultati in `data/chunks/`.

### Step 2 — Generazione Embeddings
```bash
python scripts/02_embed_kb.py
```
Genera embeddings con `multilingual-e5-small` (384 dim) per ogni chunk e li salva localmente.

### Step 3 — Indicizzazione Vector DB
```bash
python scripts/03_index_vectordb.py
```
Carica i chunk con embeddings su Qdrant (locale o cloud).

### Step 4 — Generazione Dataset SFT
```bash
python scripts/04_generate_sft_dataset.py
```
Genera coppie input/output per il fine-tuning. Produce `data/sft/train.jsonl` e `data/sft/eval.jsonl`.

### Step 5 — Training LoRA/QLoRA
```bash
python scripts/05_train_lora.py
```
Addestra un adapter LoRA su Mistral Small 24B usando QLoRA (4-bit).
Richiede GPU con almeno 24GB VRAM.

### Step 6 — Valutazione
```bash
python scripts/06_eval_model.py
```
Esegue la suite di valutazione: factuality, groundedness, JSON validity, latenza.

### Step 7 — Serving con vLLM
```bash
python scripts/07_serve_model.py
```
Avvia il modello con vLLM (endpoint OpenAI-compatible su localhost:8000).

### Step 8 — Test integrazione
```bash
python scripts/08_test_integration.py
```
Testa la pipeline end-to-end: query → retrieval → reranker → LLM → output validato.

---

## Aggiornamento futuro

### Aggiornare la Knowledge Base (senza retraining)
```bash
# 1. Aggiungi/modifica documenti in docs/kb/
# 2. Ri-esegui la pipeline RAG
python scripts/01_chunk_kb.py
python scripts/02_embed_kb.py
python scripts/03_index_vectordb.py
```

### Aggiornare lo stile dei report (retraining LoRA)
```bash
# 1. Aggiungi nuovi esempi in data/sft/train.jsonl
# 2. Ri-esegui il training
python scripts/05_train_lora.py
# 3. Valuta
python scripts/06_eval_model.py
```

### Cambiare modello base
Modifica `LLM_MODEL` in `.env` e ri-esegui steps 5-7.

---

## Documentazione correlata

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Architettura completa del sistema
- [ROADMAP.md](./ROADMAP.md) — Piano operativo 30 giorni
- [docs/RUNPOD_GUIDE.md](./docs/RUNPOD_GUIDE.md) — Guida deployment RunPod (training + serving)
- [../CLAUDE.md](../CLAUDE.md) — Regole operative per AI collaborators
- [../TrainMindAI_Operativo.docx](../TrainMindAI_Operativo.docx) — Documento operativo originale

---

## Stato attuale della pipeline

| Step | Stato | Dettagli |
|------|-------|----------|
| 01 Chunking | ✅ | 24 documenti → 199 chunk |
| 02 Embedding | ✅ | e5-small, 384 dim |
| 03 Indicizzazione | ✅ | Qdrant, 199 punti |
| 04 Dataset SFT | ✅ | 340 esempi (272 train + 68 eval) |
| 05 Training LoRA | ⏳ | Pronto per RunPod |
| 06 Eval baseline | ✅ | Groundedness 0.76, Hallucination 0% |
| 07 Serving | ⏳ | Post-training |
| 08 Test E2E | ✅ | RAG 5/5, Pipeline 4/5 (OpenAI) |

---

*Versione: 1.1 — Maggio 2026*
