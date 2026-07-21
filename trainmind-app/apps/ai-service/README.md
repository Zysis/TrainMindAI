# TrainMind AI Service

Embedding pipeline and knowledge base management for TrainMind AI.

## Overview

This directory contains Python scripts for:
1. Generating embeddings from the knowledge base
2. Verifying embeddings quality
3. Managing the Pinecone index

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Set the following environment variables in `.env`:
- `OPENAI_API_KEY`: Your OpenAI API key
- `PINECONE_API_KEY`: Your Pinecone API key
- `PINECONE_INDEX`: Pinecone index name (default: `trainmind-knowledge`)

## Scripts

### 1. `embed_knowledge_base.py`

Main embedding script that processes all seed JSON files and upserts embeddings to Pinecone.

**Usage:**
```bash
# Process all namespaces
python scripts/embed_knowledge_base.py

# Process specific namespace
python scripts/embed_knowledge_base.py --namespace exercises

# Dry run (logs operations without upserting)
python scripts/embed_knowledge_base.py --dry-run

# Set log level
python scripts/embed_knowledge_base.py --log-level DEBUG
```

**Features:**
- Reads JSON files from `seed/` directory
- Generates embeddings using OpenAI's text-embedding-3-small model
- Batch processing (100 vectors at a time)
- Exponential backoff for API rate limits
- Idempotent (safe to re-run)
- Progress logging

**Namespaces:**
- `exercises`: Exercise database (115 exercises)
- `periodization`: Training periodization models (5 models)
- `protocols`: Prevention and RTP protocols (15 total)
- `references`: Reference tables (1RM, RPE, VBT, Borg)

### 2. `verify_embeddings.py`

Verification script that tests embeddings with sample queries.

**Usage:**
```bash
python scripts/verify_embeddings.py

# With custom log level
python scripts/verify_embeddings.py --log-level DEBUG
```

**Features:**
- Prints index statistics
- Runs 5 test queries covering all document types
- Checks result relevance based on type and keywords
- Provides pass/fail summary

**Test Queries:**
1. "esercizi per forza quadricipiti" → strength exercises
2. "protocollo prevenzione caviglia" → ankle protocol
3. "periodizzazione ondulata" → undulating periodization
4. "return to play dopo distorsione" → ankle RTP protocol
5. "tabella percentuali 1RM" → 1RM reference table

### 3. `clear_index.py`

Utility to clear vectors from the index.

**Usage:**
```bash
# Clear specific namespace (with confirmation prompt)
python scripts/clear_index.py --namespace exercises

# Clear entire index (with confirmation prompt)
python scripts/clear_index.py

# Force without confirmation
python scripts/clear_index.py --force

# Force with specific namespace
python scripts/clear_index.py --namespace protocols --force
```

**Features:**
- Shows index stats before/after
- Confirmation prompt to prevent accidental deletion
- Can target specific namespace or entire index

## Document Format

### Exercises
Includes: name, nameEN, category, description, muscleGroups, equipment, movementPattern, difficulty, contraindications, variants, loadParameters

### Protocols (Prevention & RTP)
Includes: name, description, exercises, phases, progression criteria

### Periodization Models
Includes: name, description, phases (with duration, focus, volume, intensity)

### Reference Tables
Includes: 1RM percentages, RPE scale, VBT zones, Borg scale

## Metadata

Each vector in Pinecone includes metadata for filtering:
- `type`: Document type (exercise, protocol, periodization, reference)
- `category`: Exercise category (for exercises)
- `difficulty`: Exercise difficulty level (for exercises)
- `bodyArea`: Body area targeted (for protocols)
- `protocol_type`: prevention or rtp (for protocols)
- `table_name`: Reference table name (for references)

## Error Handling

- **API Rate Limits**: Automatic exponential backoff (up to 3 retries)
- **Invalid JSON**: Logged and skipped
- **Missing Fields**: Handled gracefully with empty values
- **Pinecone Errors**: Detailed error messages with context

## Development

### Running Tests
```bash
pytest tests/
```

### Code Quality
```bash
# Format
black scripts/

# Lint
flake8 scripts/

# Type check
mypy scripts/

# Sort imports
isort scripts/
```

## Troubleshooting

**"OPENAI_API_KEY not found"**
- Set the OPENAI_API_KEY environment variable
- Check that `.env` exists in the root directory

**"PINECONE_API_KEY not found"**
- Set the PINECONE_API_KEY environment variable
- Use `--dry-run` for testing without Pinecone

**"Rate limit errors"**
- Script automatically retries with exponential backoff
- Consider running during off-peak hours

**"Index not found"**
- Check PINECONE_INDEX environment variable
- Ensure index exists in Pinecone console

## Performance Notes

- Embedding generation: ~50-100 ms per document
- Batch upsert: ~1-2 seconds per batch of 100
- Total pipeline runtime: ~5-10 minutes for all documents
- API calls limited by OpenAI rate limits
