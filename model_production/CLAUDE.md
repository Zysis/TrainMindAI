# CLAUDE.md — TrainMindAI / Model Production

> Istruzioni operative per Claude (e collaboratori AI) sul lavoro di **produzione del modello AI** di TrainMindAI.
> Questo file definisce **contesto, vincoli, decisioni architetturali e regole di lavoro**.
> Va letto prima di ogni intervento sul componente `apps/ai-service` o sulla pipeline RAG/training.

---

## 1. Contesto del prodotto

**TrainMindAI** è una web app SaaS verticale rivolta a **preparatori fisici di basket**.
L'app supporta lo staff tecnico nella gestione quotidiana del lavoro atletico.

### Funzioni principali della piattaforma

- registrazione presenze allenamenti
- gestione dati atleta (anagrafica, ruolo, storico, infortuni)
- gestione dati sessione (tipo, obiettivo, durata, fase stagione, microciclo)
- workload interno/esterno (RPE, sRPE, durata, volume, intensità, densità)
- carichi e indici derivati (acute load, chronic load, ACWR, monotonia, strain)
- dati soggettivi (sonno, fatica, dolore muscolare, stress, motivazione, readiness)
- note atleta e note staff
- alert operativi su sovraccarico, fatica, rischio infortunio
- sintesi atleta / sintesi squadra
- report tecnici giornalieri, settimanali, individuali
- suggerimenti operativi al preparatore fisico
- output JSON strutturato per il frontend
- export report scaricabili

### Cosa NON è il sistema

- **Non** è un sistema medico-diagnostico.
- **Non** sostituisce il giudizio professionale del preparatore o dello staff sanitario.
- **Non** dà prescrizioni cliniche, terapie, diagnosi.
- **Non** decide al posto del coach: produce segnalazioni e supporti operativi.

---

## 2. Stack reale del repository

Il monorepo si trova in `C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app` (pnpm + turborepo).

| Path | Ruolo | Tecnologia |
|------|-------|------------|
| `apps/web` | frontend SaaS | Next.js 14, React 18, Tailwind, Radix UI, Zustand |
| `apps/api` | API gateway business | Fastify (TS), JWT, Swagger, autoload, rate-limit |
| `apps/ai-service` | **servizio AI** (RAG + LLM) | Python, FastAPI, Pinecone, OpenAI client |
| `packages/db` | ORM e schema | Prisma |
| `packages/types`, `packages/utils`, `packages/ui` | librerie condivise | TypeScript, shadcn-style |

### Componenti già presenti in `apps/ai-service`

- routers: `chat.py`, `coach.py`, `embed.py`, `generate.py`, `reports.py`, `rtp.py`
- services: `rag.py`, `context_builder.py`, `prompts.py`, `cache.py`, `metrics.py`, `error_handler.py`
- clients: `openai_client.py`, `pinecone_client.py`, `vector_client.py`
- scripts: `embed_knowledge_base.py`, `verify_embeddings.py`, `clear_index.py`
- schemi Pydantic: `models/schemas.py`

> **Implicazione operativa**: l'infrastruttura RAG esiste già. Il task non è "costruire da zero" ma **evolvere** verso modello open-weight self-hosted, sostituendo `openai_client` con un client compatibile (vLLM / TGI), e valutando la sostituzione di Pinecone con Qdrant self-hosted per ridurre il costo per chiamata.

---

## 3. Decisione architetturale finale

> **Per TrainMindAI la soluzione corretta è: RAG ben fatto + LoRA leggera per lo stile, su modello open-weight self-hosted servito con vLLM, dietro l'attuale `apps/ai-service`.**
> Motivo: la conoscenza specialistica (workload management, ACWR, monotonia, RPE, protocolli, template di report) è **fattuale e aggiornabile**, quindi va in RAG. Lo **stile** dei report e degli alert è **comportamentale e ricorrente**, quindi va appreso con LoRA su un dataset SFT controllato.

### Ripartizione delle responsabilità

| Tipo di logica | Dove vive | Esempio |
|----------------|-----------|---------|
| Conoscenza fattuale | **RAG** (Pinecone/Qdrant) | linee guida ACWR, definizioni RPE, protocolli ritorno infortunio |
| Stile e formato output | **Fine-tuning LoRA** | tono tecnico-operativo, struttura report, micro-copy |
| Regole decisionali / soglie | **Codice (`ai-service`)** | ACWR > 1.5 → alert, monotonia > 2.0 → warning |
| Output strutturato | **Template + JSON schema (Pydantic)** | alert, sintesi atleta, report giornaliero |
| Sicurezza / disclaimer | **Codice + system prompt fisso** | "non sostituisce giudizio medico" |

### Modello consigliato (ordine di preferenza)

1. **Mistral Small 3.1 / 3.2 (24B Instruct)** — sweet spot qualità/costo, contesto lungo, buono su testo tecnico in italiano. **Default raccomandato.**
2. **Llama 3.1 8B Instruct** — fallback per ridurre costo VRAM (~16GB in 4-bit), ottimo per LoRA.
3. **Qwen2.5 7B / 14B Instruct** — ottimo su strutturato (JSON), valida alternativa.
4. Llama 3.3 70B → **NO per MVP**: costi GPU eccessivi rispetto al guadagno qualitativo per il caso d'uso.

### Stack di serving target

| Componente | Scelta | Perché |
|------------|--------|--------|
| LLM serving | **vLLM** | throughput, batching, OpenAI-compatible API |
| Embeddings | `intfloat/multilingual-e5-large` o `BAAI/bge-m3` | multilingua, qualità su IT |
| Vector DB | **Qdrant** self-hosted (target) / Pinecone (transitorio) | costo zero a regime |
| Reranker | `BAAI/bge-reranker-v2-m3` | aumenta groundedness sui report |
| Backend orchestrazione | `apps/ai-service` (FastAPI) | già esistente |
| GPU runtime | RunPod / Modal / Vast.ai on-demand | pay-per-use, no commitment |
| Observability | Langfuse o OpenTelemetry + Grafana | trace, costo, qualità |
| Caching | Redis | già usabile via `services/cache.py` |

---

## 4. Regole di lavoro per Claude

Quando lavori su questo progetto, applica **sempre** queste regole.

### 4.1 Regole di scope

1. **Non riscrivere `apps/ai-service` da zero.** Estendi l'esistente. Modifica `openai_client.py` per puntare a un endpoint OpenAI-compatible (vLLM) invece che eliminarlo.
2. **Conoscenza in RAG, comportamento in LoRA.** Se una richiesta sembra richiedere "insegnare un fatto al modello", spostala in RAG.
3. **Le soglie cliniche/tecniche stanno in codice, non nel prompt.** ACWR, monotonia, strain → funzioni Python testabili, non istruzioni in linguaggio naturale.
4. **JSON è un contratto.** Ogni output destinato al frontend passa per uno schema Pydantic e va validato prima di tornare al client. Niente JSON "creativo".

### 4.2 Regole di sicurezza dominio

1. **Disclaimer obbligatorio** in ogni report e suggerimento: il sistema è di supporto, non sostituisce il professionista.
2. **Mai diagnosi, mai prescrizioni.** Se l'utente chiede una diagnosi, restituire un rifiuto strutturato + suggerimento di consultare un medico.
3. **Anonimizzazione dataset.** Qualsiasi dato atleta usato per RAG/SFT/eval deve essere anonimizzato (ID opaco, no nomi, no foto).
4. **Segnalare incertezza.** Se la confidenza del retriever è bassa, il modello deve dichiararlo invece di inventare numeri.

### 4.3 Regole tecniche

1. **System prompt = ruolo + vincoli + formato.** Niente conoscenza nel system prompt.
2. **Few-shot dinamici dal RAG**, non hard-coded nel prompt.
3. **Tutto loggato** (input, retrieval, output, latenza, costo) in tabella `ai_traces` (DB applicativo o Langfuse). Nessuna chiamata silenziosa al modello.
4. **Eval prima di promuovere.** Nessuna LoRA va in produzione senza passare la suite di eval (vedi sezione 7).
5. **Determinismo dove serve.** Output strutturati: `temperature=0.0`, `top_p=1.0`. Output testuali: `temperature=0.3` max.
6. **Versioning esplicito.** Ogni prompt, ogni LoRA, ogni indice vector ha una versione (`prompt_v3`, `lora_report_v1`, `kb_2026_04`). Niente sovrascritture in-place.

### 4.4 Regole di stile codice

- Python: type hints + Pydantic v2 ovunque. `ruff` + `black`.
- TS: rispettare `tsconfig.json` esistente, niente `any`.
- Niente import circolari tra `routers` ↔ `services`.
- Test minimi: pytest per `services/rag.py`, `services/prompts.py`, `clients/*`.

### 4.5 Cosa evitare assolutamente

- Full fine-tuning del modello base (overkill, costoso, lock-in).
- Training da zero (irrazionale per questo dominio).
- Mock del retriever nei test E2E (devono colpire un indice reale di test).
- Inserire dati atleta non anonimizzati in dataset di training.
- "Migliorare" un prompt in produzione senza aggiornare la versione e ri-eseguire l'eval.

---

## 5. Tipologie di output del sistema

Tutti gli output passano per `ai-service`. Ogni tipo ha un trattamento specifico.

| Output | Generazione | Formato | Validazione | Note |
|--------|-------------|---------|-------------|------|
| Alert workload | regole + LLM solo per testo | JSON `{level, code, message}` | schema Pydantic | soglie hard-coded |
| Sintesi atleta | LLM + RAG | testo + JSON | schema | personalizzato per atleta |
| Sintesi squadra | LLM + RAG | testo + JSON | schema | aggregato |
| Report giornaliero | LLM + RAG + template | testo strutturato | sezioni obbligatorie | versionato |
| Report settimanale | LLM + RAG + template + indici | testo strutturato | sezioni obbligatorie | usa storico |
| Nota tecnica staff | LLM + RAG | testo libero corto | controllo lunghezza | tono tecnico |
| JSON per frontend | LLM con grammar/JSON mode | JSON validato | Pydantic | `temperature=0` |

---

## 6. Dataset

### 6.1 Knowledge base RAG (priorità 1)

Contenuti da raccogliere e indicizzare. Tutti in italiano + termini tecnici inglesi.

- linee guida e protocolli di workload management nel basket
- definizioni operative (RPE, sRPE, ACWR, monotonia, strain) con formule
- metodologie di periodizzazione
- best practice ritorno da infortunio (RTP)
- glossario tecnico bilingue
- template di report già scritti bene
- FAQ del preparatore fisico
- casi d'uso reali anonimizzati

**Formato**: Markdown o JSON per documento. Chunk 400–800 token, overlap 80. Metadati: `source`, `domain`, `level` (base/intermedio/avanzato), `lang`, `version`, `date`.

### 6.2 Dataset SFT per LoRA (priorità 2)

Coppie `input → output` per insegnare **stile** al modello. Target iniziale: **300–800 esempi** di alta qualità.

Formato JSONL:

```json
{"messages": [
  {"role": "system", "content": "<system prompt fisso>"},
  {"role": "user", "content": "<input strutturato JSON dati atleta>"},
  {"role": "assistant", "content": "<output gold-standard>"}
]}
```

Tipi di esempi necessari:

- 100+ alert workload (vari livelli di severità)
- 100+ sintesi atleta (varie tipologie, posizioni, fasi stagione)
- 50+ sintesi squadra
- 100+ report giornalieri
- 50+ report settimanali
- 50+ casi limite (dati incompleti, ambiguità, richieste fuori scope → rifiuto strutturato)

### 6.3 Dataset di valutazione (priorità 3)

Set hold-out di 80–150 esempi mai visti durante il training. Stesso formato JSONL. Etichette di qualità per giudice umano e per LLM-as-judge.

---

## 7. Suite di valutazione minima

Prima di promuovere qualsiasi modifica (prompt, LoRA, retriever, modello base) eseguire:

1. **Factuality** — il numero/protocollo citato esiste nei chunk recuperati?
2. **Groundedness** — ogni affermazione ha citazione tracciabile?
3. **JSON validity** — % di output che passa lo schema Pydantic al primo colpo (target ≥ 99%).
4. **Aderenza dati atleta** — se il dato non è nei dati di sessione, il modello non deve inventarlo.
5. **Latency p50 / p95** — target produzione: p95 < 6s per report giornaliero, < 2s per alert.
6. **Cost per 1k requests** — calcolato e tracciato.
7. **Hallucination rate** — % di affermazioni non grounded (LLM-as-judge).
8. **Coerenza ruolo** — output rimane in tono "preparatore fisico", non sconfina in linguaggio medico.
9. **Refusal rate corretto** — sui casi out-of-scope (diagnosi, terapie) deve rifiutare in modo strutturato.

Strumenti: `promptfoo`, `ragas`, oppure script custom in `apps/ai-service/tests/eval/`.

---

## 8. Roadmap operativa (riferimento al doc separato)

La roadmap completa di 30 giorni con responsabili, deliverable e criteri di chiusura è nel documento operativo:

→ `TrainMindAI_Operativo.docx` (stesso folder)

Riassunto fasi:

| Settimana | Focus |
|-----------|-------|
| 1 | KB documentale + ingestion + indice RAG funzionante con OpenAI |
| 2 | Output strutturati + Pydantic + suite eval baseline |
| 3 | Switch a vLLM self-hosted (Mistral Small) + ottimizzazione retrieval |
| 4 | Costruzione dataset SFT + LoRA training + eval finale + go/no-go produzione |

---

## 9. Convenzioni di linguaggio

- **Lingua principale**: italiano per tutti gli output destinati all'utente finale.
- **Termini tecnici**: in inglese se sono standard internazionali (RPE, ACWR, workload, strain, monotony, readiness).
- **Riferimenti a unità di misura e formule**: numeri, simboli e formule vanno **sempre** verificate contro la KB; mai inventate.
- **Tono**: tecnico-operativo, asciutto, mai motivazionale, mai paternalistico, mai medico.

---

## 10. Cosa fare al primo intervento

1. Leggere questo file integralmente.
2. Aprire `apps/ai-service/app/services/rag.py` e `app/clients/openai_client.py` per capire lo stato corrente.
3. Verificare che esista un file `.env.example` aggiornato con le variabili nuove (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `EMBED_MODEL`, `RERANKER_MODEL`, `VECTOR_DB`, `QDRANT_URL`).
4. Aprire `TrainMindAI_Operativo.docx` per la roadmap step-by-step.
5. Solo dopo questi 4 punti, proporre modifiche.

---

## 11. Riferimenti file

- `prompt_short.txt`, `prompt.txt`, `prompt_focused.txt` — prompt di partenza con i requisiti originari
- `TrainMindAI_Operativo.docx` — piano esecutivo dettagliato a 30 giorni
- `../trainmind-app/apps/ai-service/` — codice del servizio AI
- `../trainmind-app/packages/db/` — schema Prisma (per nuove tabelle `ai_traces`, `kb_documents`)

---

*Versione documento: 1.0 — 2026-04-28*
