# TrainMindAI — Architettura del Sistema AI

> Documento tecnico che descrive l'architettura completa del sistema AI di TrainMindAI.

---

## 1. Visione d'insieme

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WEB APP (Next.js)                              │
│                    Frontend preparatore fisico                           │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (Fastify)                            │
│              Auth JWT · Rate Limiting · Routing                          │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP interno
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI SERVICE (FastAPI/Python)                         │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐            │
│  │ Retriever│  │ Reranker │  │ LLM Client│  │ Validators │            │
│  │  (RAG)   │  │          │  │  (vLLM)   │  │ (Pydantic) │            │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └─────┬──────┘            │
│       │              │              │              │                     │
│  ┌────▼──────────────▼──────────────▼──────────────▼──────┐            │
│  │              ORCHESTRATORE (context_builder)            │            │
│  │   query → retrieve → rerank → prompt → LLM → validate │            │
│  └────────────────────────────────────────────────────────┘            │
└──────┬──────────────────────┬──────────────────────┬────────────────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   QDRANT     │    │   vLLM SERVER   │    │   LANGFUSE      │
│  Vector DB   │    │  Mistral Small  │    │  Observability  │
│  (embeddings │    │  24B + LoRA     │    │  (traces, cost) │
│   + chunks)  │    │  (GPU cloud)    │    │                 │
└──────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 2. Componenti principali

### 2.1 Vector Database (Qdrant)

**Ruolo**: Archivia la knowledge base come embeddings vettoriali per retrieval semantico.

| Parametro | Valore |
|-----------|--------|
| Engine | Qdrant (self-hosted o cloud) |
| Embedding model | `intfloat/multilingual-e5-large` (1024 dim) |
| Distanza | Cosine similarity |
| Chunk size | 400-800 token |
| Overlap | 80 token |
| Metadati per chunk | source, domain, level, lang, version, date, tags |

**Perché Qdrant**: open-source, API REST/gRPC, filtri per metadati, zero costo se self-hosted.

### 2.2 LLM Server (vLLM)

**Ruolo**: Serve il modello linguistico con API OpenAI-compatible.

| Parametro | Valore |
|-----------|--------|
| Engine | vLLM |
| Modello base | `mistralai/Mistral-Small-3.1-24B-Instruct-2503` |
| Quantizzazione | AWQ 4-bit (riduce VRAM a ~16GB) |
| LoRA adapter | Caricato dinamicamente (`--lora-modules`) |
| API | OpenAI-compatible (`/v1/chat/completions`) |
| GPU target | A10 24GB / L4 24GB (RunPod/Vast.ai) |

**Perché vLLM**: batching continuo, throughput elevato, compatibilità OpenAI, supporto LoRA nativo.

### 2.3 Reranker

**Ruolo**: Migliora la precisione del retrieval ri-ordinando i chunk per rilevanza.

| Parametro | Valore |
|-----------|--------|
| Modello | `BAAI/bge-reranker-v2-m3` |
| Input | Query + top-K chunk dal retriever |
| Output | Chunk ri-ordinati per relevance score |
| K retrieval | 10-20 |
| K dopo rerank | 3-5 |

### 2.4 Schemi Output (Pydantic)

Ogni output del sistema è validato da uno schema Pydantic **prima** di tornare al frontend.

| Output | Schema | Generazione |
|--------|--------|-------------|
| Alert workload | `AlertWorkload` | Regole Python + LLM per testo |
| Sintesi atleta | `AthleteSummary` | LLM + RAG |
| Sintesi squadra | `TeamSummary` | LLM + RAG |
| Report giornaliero | `DailyReport` | LLM + RAG + template |
| Report settimanale | `WeeklyReport` | LLM + RAG + template + storico |
| Nota tecnica | `StaffNote` | LLM + RAG |

### 2.5 Observability (Langfuse)

Ogni chiamata al modello viene tracciata con:
- Input completo (prompt + context)
- Output generato
- Chunk recuperati (retrieval)
- Latenza (p50, p95)
- Costo stimato
- Versione prompt e LoRA usati

---

## 3. Flusso di una richiesta tipica

### Esempio: "Genera report giornaliero per l'atleta A12"

```
1. Frontend invia richiesta con dati sessione JSON
   ↓
2. API Gateway autentica e inoltra a AI Service
   ↓
3. AI Service:
   a. Estrae query semantica dai dati ("workload atleta A12 oggi")
   b. Retriever cerca in Qdrant i chunk rilevanti (top-20)
   c. Reranker ri-ordina e seleziona top-5
   d. Context Builder assembla:
      - System prompt (ruolo + vincoli + formato)
      - Dati atleta strutturati (JSON)
      - Chunk RAG rilevanti (conoscenza)
      - Few-shot dinamici (esempi simili dalla KB)
   e. LLM Client invia a vLLM
   f. Risposta validata con schema Pydantic DailyReport
   g. Se validazione fallisce → retry con prompt repair → fallback template
   ↓
4. Output JSON validato torna al frontend
   ↓
5. Trace completo salvato in Langfuse
```

---

## 4. Ripartizione responsabilità: RAG vs LoRA vs Codice

### 4.1 In RAG (conoscenza aggiornabile)
- Linee guida workload management
- Definizioni operative (RPE, sRPE, ACWR, monotonia, strain)
- Formule e range di riferimento
- Protocolli return-to-play
- Best practice periodizzazione
- Template report gold-standard
- FAQ del preparatore fisico
- Casi d'uso reali anonimizzati

### 4.2 In LoRA (comportamento appreso)
- Tono tecnico-operativo dei report
- Struttura standardizzata delle risposte
- Formato JSON specifico dell'app
- Micro-copy e formulazioni ricorrenti
- Gestione rifiuti strutturati (fuori scope)
- Classificazione automatica del tipo di output

### 4.3 In codice Python (regole deterministiche)
- Soglie ACWR (> 1.5 = warning, > 2.0 = alert)
- Soglie monotonia (> 2.0 = warning)
- Soglie strain
- Calcoli derivati (acute load, chronic load, ACWR)
- Validazione output (Pydantic)
- Disclaimer obbligatori (footer fisso)
- Rate limiting per tenant
- Feature flags (LLM_PROVIDER)

---

## 5. Modello consigliato (ordine di preferenza)

| # | Modello | VRAM (4-bit) | Qualità IT | Costo | Caso d'uso |
|---|---------|-------------|-----------|-------|------------|
| 1 | **Mistral Small 3.1 24B** | ~16GB | Ottima | Medio | **Default raccomandato** |
| 2 | Llama 3.1 8B | ~6GB | Buona | Basso | Fallback se costi GPU troppo alti |
| 3 | Qwen2.5 14B | ~10GB | Ottima su JSON | Medio-basso | Alternativa se serve più structured output |
| 4 | Llama 3.3 70B | ~40GB | Eccellente | Alto | **NO per MVP** (costi eccessivi) |

---

## 6. Training: QLoRA

| Parametro | Valore |
|-----------|--------|
| Metodo | QLoRA (4-bit quantization + LoRA) |
| Rank | 16 |
| Alpha | 32 |
| Learning rate | 2e-4 |
| Epoche | 3 |
| Batch size | 4 |
| Gradient accumulation | 8 |
| Dataset | 300-800 coppie input/output |
| Framework | Hugging Face TRL / Axolotl |
| Output | Adapter LoRA (~100MB) caricabile da vLLM |

### Composizione dataset SFT

| Tipo | % | Quantità target |
|------|---|-----------------|
| Report giornalieri | 40% | 120-320 |
| Sintesi atleta | 20% | 60-160 |
| Alert workload | 15% | 45-120 |
| Sintesi squadra | 15% | 45-120 |
| Rifiuti strutturati | 10% | 30-80 |

---

## 7. Sicurezza e limiti

### Il sistema NON deve:
- Emettere diagnosi mediche
- Prescrivere terapie o trattamenti
- Sostituire il giudizio del medico sportivo
- Inventare dati non presenti nell'input
- Generare raccomandazioni non supportate dalla KB

### Il sistema DEVE:
- Dichiarare incertezza quando i dati sono insufficienti
- Aggiungere disclaimer in ogni report
- Rifiutare strutturalmente richieste fuori scope
- Validare ogni output JSON prima di restituirlo
- Tracciare ogni chiamata per audit

### Disclaimer obbligatorio (footer fisso)
> "Questo output è uno strumento di supporto. Non sostituisce il giudizio professionale
> dello staff tecnico-sanitario. Le decisioni cliniche e operative restano di
> responsabilità del professionista."

---

## 8. Costi stimati

### Scenario MVP (traffico basso: 1.000-3.000 req/giorno)

| Componente | Costo mensile stimato |
|------------|----------------------|
| GPU RunPod (A10, serverless) | €80-150/mese |
| Qdrant (self-hosted su VPS) | €20-40/mese |
| Langfuse (self-hosted) | €0 (open source) |
| Storage embeddings | €5-10/mese |
| **Totale** | **€105-200/mese** |

### vs. API OpenAI attuale (stima)
- 3.000 req/giorno × 30 giorni × ~€0.03/req = **€2.700/mese**
- **Risparmio: 90%+**

---

## 9. Quando il self-hosting NON conviene

- Traffico < 200 req/giorno → API esterna resta più economica
- Team senza competenze MLOps e nessun on-call disponibile
- Vincoli di compliance che richiedono provider certificati
- Fase di prototipazione iniziale (meglio validare con API prima)

---

*Versione: 1.0 — Maggio 2026*
