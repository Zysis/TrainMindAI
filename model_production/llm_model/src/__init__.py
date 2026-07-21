"""
src/
====
Moduli riutilizzabili per la pipeline TrainMindAI LLM.

Contenuto:
- chunker.py    : Chunking intelligente dei documenti KB
- embedder.py   : Generazione embeddings con sentence-transformers
- vectordb.py   : Client Qdrant per indicizzazione e ricerca
- retriever.py  : Retriever RAG completo (search + rerank)
- reranker.py   : Reranker per migliorare precision del retrieval
- llm_client.py : Client LLM compatibile con OpenAI/vLLM
- trainer.py    : Training LoRA/QLoRA
- evaluator.py  : Suite di valutazione
- schemas.py    : Schemi Pydantic per output strutturati
"""
