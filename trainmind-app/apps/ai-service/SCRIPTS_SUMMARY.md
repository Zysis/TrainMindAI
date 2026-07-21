# TrainMind AI - Embedding Pipeline Scripts Summary

## Created Files

### 1. `scripts/__init__.py`
Empty Python package init file for the scripts module.

### 2. `scripts/embed_knowledge_base.py`
Main embedding pipeline script (570 lines)

**Key Features:**
- Loads all 5 seed JSON files:
  - `exercises.json` (115 exercises)
  - `periodization-models.json` (5 models)
  - `prevention-protocols.json` (10 protocols)
  - `rtp-protocols.json` (5 protocols)
  - `reference-tables.json` (reference data)

- Document formatting:
  - Exercises: Name, category, description, muscles, equipment, movement pattern, difficulty, contraindications, variants, load parameters
  - Protocols: Name, description, exercises list, phases/progression
  - Periodization: Name, description, phases with duration/focus/intensity
  - References: Table name and description

- Embedding generation:
  - Uses OpenAI's text-embedding-3-small (1536 dimensions)
  - Batch processing (100 vectors at a time)
  - Exponential backoff for API rate limits (max 3 retries)
  - ~50-100ms per embedding, ~1-2s per batch

- Pinecone upsert:
  - 4 namespaces: `exercises`, `periodization`, `protocols`, `references`
  - Rich metadata: type, category, difficulty, bodyArea, protocol_type, table_name
  - Idempotent (safe to re-run)

- CLI Options:
  - `--namespace`: Process specific namespace (exercises, periodization, protocols, references)
  - `--dry-run`: Log operations without upserting
  - `--log-level`: DEBUG, INFO, WARNING, ERROR

### 3. `scripts/verify_embeddings.py`
Verification and testing script (380 lines)

**Key Features:**
- Index statistics reporting
- 5 test queries covering all document types:
  1. "esercizi per forza quadricipiti" → strength exercises
  2. "protocollo prevenzione caviglia" → ankle prevention
  3. "periodizzazione ondulata" → undulating periodization
  4. "return to play dopo distorsione" → ankle RTP
  5. "tabella percentuali 1RM" → 1RM reference table

- Result validation:
  - Checks embedding quality (score > 0.7)
  - Verifies document type matches
  - Checks for expected keywords
  - Reports detailed pass/fail reasons

- Output:
  - Per-query results with scores and metadata
  - Summary with pass rate
  - Detailed breakdown of each test

- CLI Options:
  - `--log-level`: DEBUG, INFO, WARNING, ERROR

### 4. `scripts/clear_index.py`
Utility script for index management (240 lines)

**Key Features:**
- Clear specific namespace or entire index
- Safety confirmation prompts
- Index stats before/after clearing
- Batch deletion using Pinecone delete_all

- CLI Options:
  - `--namespace`: Target specific namespace (optional)
  - `--force`: Skip confirmation prompt
  - `--log-level`: DEBUG, INFO, WARNING, ERROR

## Configuration

All scripts load `.env` from the root directory:
```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=trainmind-knowledge (default)
```

## Dependencies

Added to `requirements.txt`:
- openai==1.3.5
- pinecone-client==3.0.0
- python-dotenv==1.0.0
- requests==2.31.0
- tqdm==4.66.1
- pytest==7.4.3 (dev)
- black==23.12.0 (dev)
- flake8==6.1.0 (dev)
- mypy==1.7.1 (dev)

## Usage Examples

### Install dependencies
```bash
pip install -r requirements.txt
```

### Generate all embeddings
```bash
python scripts/embed_knowledge_base.py
```

### Generate embeddings for exercises only
```bash
python scripts/embed_knowledge_base.py --namespace exercises
```

### Dry run (preview without upserting)
```bash
python scripts/embed_knowledge_base.py --dry-run --log-level DEBUG
```

### Verify embeddings quality
```bash
python scripts/verify_embeddings.py
```

### Clear protocols namespace
```bash
python scripts/clear_index.py --namespace protocols
```

### Clear entire index with force
```bash
python scripts/clear_index.py --force
```

## Document Structure

### Exercises (115 total)
- Fields: name, nameEN, category, description, muscleGroups, equipment, movementPattern, difficulty, contraindications, variants, loadParameters
- Metadata: type=exercise, category, difficulty, name

### Prevention Protocols (10 total)
- Fields: name, bodyArea, description, exercises, frequency, duration, progression
- Metadata: type=protocol, protocol_type=prevention, bodyArea, name

### RTP Protocols (5 total)
- Fields: name, injuryType, description, phases, clearanceCriteria
- Metadata: type=protocol, protocol_type=rtp, injuryType, name

### Periodization Models (5 total)
- Fields: name, nameEN, description, phases (with duration/focus/intensity), suitableFor
- Metadata: type=periodization, name

### Reference Tables
- 1RM percentages: 100% → 1 rep, 95% → 2 reps, etc.
- RPE scale
- VBT zones
- Borg scale
- Metadata: type=reference, table_name

## Error Handling

- **API Rate Limits**: Automatic exponential backoff with jitter
- **Invalid JSON**: Logged and skipped gracefully
- **Missing Fields**: Handled with empty string defaults
- **Network Errors**: Detailed error logging with context
- **File Not Found**: Clear error messages with paths

## Performance Notes

- Single embedding: ~50-100ms
- Batch upsert: ~1-2 seconds per batch of 100
- Total runtime: ~5-10 minutes for all documents
- Recommended batch size: 100 (default)
- API rate limits: Follow OpenAI guidelines (3500 RPM)

## Logging

All scripts use Python logging with timestamps:
- DEBUG: Detailed operation info
- INFO: Progress and important events
- WARNING: Recoverable errors
- ERROR: Fatal errors

Log format: `%(asctime)s - %(name)s - %(levelname)s - %(message)s`

## Next Steps

1. Install dependencies: `pip install -r requirements.txt`
2. Configure `.env` with API keys
3. Run dry-run: `python scripts/embed_knowledge_base.py --dry-run`
4. Verify Pinecone index and namespace
5. Run full pipeline: `python scripts/embed_knowledge_base.py`
6. Verify results: `python scripts/verify_embeddings.py`
7. Monitor logs for errors or warnings

## Files Created

```
/sessions/upbeat-vigilant-lovelace/mnt/TrainMindAI/trainmind-app/apps/ai-service/
├── __init__.py
├── README.md (existing, enhanced)
├── SCRIPTS_SUMMARY.md (this file)
├── requirements.txt (created/updated)
├── scripts/
│   ├── __init__.py
│   ├── embed_knowledge_base.py (570 lines)
│   ├── verify_embeddings.py (380 lines)
│   └── clear_index.py (240 lines)
└── (existing app/ directory structure)
```

Total new code: ~1,190 lines of production Python
