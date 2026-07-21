# TrainMindAI — Roadmap Operativa 30 Giorni

> Piano esecutivo per arrivare al primo sistema funzionante.

---

## Settimana 1 — Knowledge Base + RAG Baseline

| Giorno | Task | Deliverable | Criterio chiusura |
|--------|------|-------------|-------------------|
| 1-2 | Raccolta fonti KB | `docs/kb/` con ≥30 documenti | Copertura: workload, RPE, ACWR, monotonia, RTP, periodizzazione |
| 3 | Pulizia e normalizzazione | Documenti puliti in Markdown | No header/footer spurii, terminologia uniforme |
| 4 | Chunking | `data/chunks/` generati | Chunk 400-800 token, overlap 80 |
| 5 | Embeddings + indicizzazione | Indice Qdrant `trainmind_kb_v1` | Query di test restituiscono chunk rilevanti |

### Come eseguire:
```bash
python scripts/01_chunk_kb.py
python scripts/02_embed_kb.py
python scripts/03_index_vectordb.py
```

---

## Settimana 2 — Output Strutturati + Suite Eval Baseline

| Giorno | Task | Deliverable | Criterio chiusura |
|--------|------|-------------|-------------------|
| 6-7 | Definizione schemi Pydantic | `src/schemas.py` completo | Tutti i 6 tipi output hanno schema |
| 8 | System prompts versionati | `prompts/*.yaml` | Ogni ruolo ha prompt dedicato |
| 9 | Pipeline RAG end-to-end con OpenAI | Query → retrieve → rerank → LLM → JSON | 50 query di test passano validazione |
| 10 | Suite di valutazione baseline | `scripts/06_eval_model.py` funzionante | Metriche baseline registrate |

### Come eseguire:
```bash
python scripts/08_test_integration.py  # Test pipeline RAG
python scripts/06_eval_model.py        # Baseline metrics
```

---

## Settimana 3 — Switch a vLLM Self-Hosted

| Giorno | Task | Deliverable | Criterio chiusura |
|--------|------|-------------|-------------------|
| 11-12 | Setup vLLM su RunPod | Container funzionante con Mistral Small 24B | Endpoint risponde a /v1/chat/completions |
| 13 | Switch client LLM | `LLM_PROVIDER=vllm` funzionante | Feature flag attivo, rollback a OpenAI ok |
| 14 | Smoke test | 50 query baseline su vLLM | Qualità ≥ 90% della baseline OpenAI |
| 15 | Ottimizzazione retrieval | Tuning K, reranker, chunk size | Groundedness migliorata vs baseline |

### Come eseguire:
```bash
python scripts/07_serve_model.py       # Solo per test locale
python scripts/08_test_integration.py  # Verifica end-to-end
```

---

## Settimana 4 — Dataset SFT + LoRA + Go/No-Go

| Giorno | Task | Deliverable | Criterio chiusura |
|--------|------|-------------|-------------------|
| 16-18 | Costruzione dataset SFT | `data/sft/train.jsonl` (300+ esempi) | Mix corretto, qualità revisionata |
| 19-20 | Training QLoRA | Adapter LoRA salvato | Loss in calo, no overfitting |
| 21 | Eval LoRA | Metriche comparative | LoRA ≥ baseline su tutte le metriche |
| 22 | Go/No-Go decision | Documento decisionale | Criteri: factuality, groundedness, JSON validity ≥99%, costo ≤30% baseline |

### Criteri Go/No-Go:
- ✅ Factuality ≥ baseline OpenAI
- ✅ Groundedness ≥ baseline OpenAI
- ✅ JSON validity ≥ 99%
- ✅ Costo per 1k richieste ≤ 30% del costo attuale
- ✅ Latenza p95 < 6s per report, < 2s per alert

### Come eseguire:
```bash
python scripts/04_generate_sft_dataset.py
python scripts/05_train_lora.py
python scripts/06_eval_model.py
```

---

## Post-lancio (Giorni 23-30)

| Giorno | Task |
|--------|------|
| 23-24 | Logging e monitoring (Langfuse) |
| 25-26 | Job refresh KB automatico |
| 27-28 | Documentazione operativa finale |
| 29-30 | Buffer per fix e ottimizzazioni |

---

## Checklist finale prima di andare in produzione

- [ ] Knowledge base indicizzata e verificata
- [ ] Suite eval superata con metriche ≥ baseline
- [ ] Feature flag rollback testato
- [ ] Disclaimer in ogni output
- [ ] Logging attivo su ogni chiamata
- [ ] Anonimizzazione dataset verificata
- [ ] Schema Pydantic per ogni tipo output
- [ ] System prompts versionati
- [ ] Documentazione aggiornata

---

*Versione: 1.0 — Maggio 2026*
