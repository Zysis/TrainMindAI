# Integration Guide - Embedding Pipeline Scripts

## Quick Start

### 1. Environment Setup
```bash
# Ensure you have Python 3.9+
python3 --version

# Navigate to ai-service directory
cd apps/ai-service

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Update `.env` file in the root directory with:
```
OPENAI_API_KEY=sk-your-openai-api-key
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX=trainmind-knowledge
```

### 3. Dry Run (Recommended First Step)
Test without making actual API calls:
```bash
python scripts/embed_knowledge_base.py --dry-run --log-level INFO
```

Expected output:
- Lists all documents found from seed/
- Shows metadata for each document
- Reports total documents and would-be vectors

### 4. Generate Embeddings
Run the full pipeline:
```bash
python scripts/embed_knowledge_base.py --log-level INFO
```

Expected runtime: 5-10 minutes (depends on API response times)

### 5. Verify Results
Test embeddings with sample queries:
```bash
python scripts/verify_embeddings.py --log-level INFO
```

Expected output:
- Index statistics (total vectors per namespace)
- Results for 5 test queries
- Pass/fail summary (should see 5/5 passed)

## Detailed Workflows

### Process Specific Namespaces

**Exercises only:**
```bash
python scripts/embed_knowledge_base.py --namespace exercises --log-level INFO
```

**Protocols (prevention + RTP):**
```bash
python scripts/embed_knowledge_base.py --namespace protocols --log-level INFO
```

**Periodization models:**
```bash
python scripts/embed_knowledge_base.py --namespace periodization --log-level INFO
```

**Reference tables:**
```bash
python scripts/embed_knowledge_base.py --namespace references --log-level INFO
```

### Index Management

**View current index stats:**
```bash
python scripts/verify_embeddings.py --log-level INFO | head -20
```

**Clear exercises namespace:**
```bash
python scripts/clear_index.py --namespace exercises
# You'll be prompted: "Are you sure? (yes/no):"
# Type: yes
```

**Clear entire index:**
```bash
python scripts/clear_index.py
# You'll be prompted: "Are you sure you want to clear the ENTIRE index? (yes/no):"
# Type: yes
```

**Force clear without prompt:**
```bash
python scripts/clear_index.py --namespace exercises --force
```

## Document Processing Pipeline

### Input Files (from `seed/` directory)

| File | Documents | Fields |
|------|-----------|--------|
| exercises.json | 115 | name, category, description, muscleGroups, equipment, movementPattern, difficulty, contraindications, variants, loadParameters |
| periodization-models.json | 5 | name, description, phases (with duration, focus, intensity), suitableFor |
| prevention-protocols.json | 10 | name, bodyArea, description, exercises, phases, progression |
| rtp-protocols.json | 5 | name, injuryType, description, phases, clearanceCriteria |
| reference-tables.json | Multiple | 1RM percentages, RPE scale, VBT zones, Borg scale |

**Total: ~135+ documents**

### Processing Steps

1. **Load JSON**: Read all seed files
2. **Format**: Convert to rich text representation
3. **Embed**: Generate OpenAI embeddings (1536 dimensions)
4. **Batch**: Group into 100-vector batches
5. **Upsert**: Send to Pinecone with metadata
6. **Log**: Report progress and errors

### Namespace Organization

```
exercises          → 115 exercise documents
periodization      → 5 periodization model documents
protocols          → 15 protocol documents (prevention + RTP)
references         → Multiple reference table documents
```

## Search Capabilities After Embedding

### Query Examples

**Find strength exercises:**
```
"esercizi per forza e massima potenza"
"quadricipiti strengthening"
"leg strength exercises"
```

**Find prevention protocols:**
```
"protocollo prevenzione caviglia"
"ACL injury prevention"
"knee injury protocol"
```

**Find periodization models:**
```
"periodizzazione ondulata"
"linear periodization for basketball"
"block periodization"
```

**Find RTP protocols:**
```
"return to play dopo distorsione"
"recovery from ankle injury"
"RTP clearance criteria"
```

**Find reference data:**
```
"1RM percentages and reps"
"RPE scale"
"rate of perceived exertion"
```

## Troubleshooting

### Error: "OPENAI_API_KEY not found"
**Solution:** 
1. Check `.env` file exists in root directory
2. Verify OPENAI_API_KEY is set and valid
3. Try: `echo $OPENAI_API_KEY`

### Error: "PINECONE_API_KEY not found"
**Solution:** 
1. Set PINECONE_API_KEY in `.env`
2. For testing without Pinecone: Use `--dry-run` flag

### Error: "Rate limit error from OpenAI"
**Solution:** 
1. Script will automatically retry with exponential backoff
2. If persistent, reduce batch size or wait before running again
3. Check OpenAI API usage: https://platform.openai.com/account/billing/usage

### Error: "Index not found in Pinecone"
**Solution:** 
1. Verify PINECONE_INDEX value matches your index name
2. Check Pinecone console for index status
3. Ensure index is created with proper dimensions (1536)

### Error: "File not found: seed/exercises.json"
**Solution:** 
1. Verify seed files exist in project root
2. Run from correct directory: `cd apps/ai-service`
3. Check file paths: `ls -la ../../seed/`

## Monitoring and Logs

### Enable Debug Logging
```bash
python scripts/embed_knowledge_base.py --log-level DEBUG
```

### Check Specific Errors
```bash
python scripts/embed_knowledge_base.py 2>&1 | grep ERROR
```

### Monitor Progress
```bash
python scripts/embed_knowledge_base.py | grep "Processing batch"
```

## Performance Optimization

### For Large-Scale Runs

**Adjust batch size in code:**
Edit `embed_knowledge_base.py` line ~38:
```python
BATCH_SIZE = 100  # Change to 50 for slower connection, 200 for faster
```

**Monitor API usage:**
- OpenAI: https://platform.openai.com/account/billing/usage
- Pinecone: https://console.pinecone.io/

### Concurrent Processing
Scripts are single-threaded for API safety. For parallel processing:
1. Process namespaces in separate terminals:
   ```bash
   # Terminal 1
   python scripts/embed_knowledge_base.py --namespace exercises
   
   # Terminal 2
   python scripts/embed_knowledge_base.py --namespace periodization
   ```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Embedding Pipeline
on: [workflow_dispatch]
jobs:
  embed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          cd apps/ai-service
          pip install -r requirements.txt
      - name: Run embedding pipeline
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}
        run: |
          cd apps/ai-service
          python scripts/embed_knowledge_base.py
      - name: Verify embeddings
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}
        run: |
          cd apps/ai-service
          python scripts/verify_embeddings.py
```

## Next Steps

1. Configure `.env` with API keys
2. Run `python scripts/embed_knowledge_base.py --dry-run` to preview
3. Run full pipeline when ready
4. Run `python scripts/verify_embeddings.py` to test
5. Integrate into CI/CD pipeline
6. Monitor Pinecone index for updates

## Support

For issues:
1. Check logs with `--log-level DEBUG`
2. Verify API keys are correct
3. Check file paths are accessible
4. Review seed files are valid JSON
5. Check Pinecone index exists and is active

## Files Reference

```
apps/ai-service/
├── scripts/
│   ├── embed_knowledge_base.py    → Main embedding pipeline
│   ├── verify_embeddings.py       → Quality verification
│   ├── clear_index.py             → Index management
│   └── __init__.py               → Package init
├── requirements.txt              → Python dependencies
├── README.md                     → Full documentation
├── SCRIPTS_SUMMARY.md            → Technical details
└── INTEGRATION_GUIDE.md          → This file
```

