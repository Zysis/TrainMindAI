"""
tests/test_retriever.py
=======================
Test unitari per il modulo retriever.
Nota: alcuni test richiedono Qdrant in esecuzione.

Esecuzione:
    pytest tests/test_retriever.py -v

    # Solo test che non richiedono servizi esterni:
    pytest tests/test_retriever.py -v -k "not integration"
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Il modulo retriever dipende da sentence_transformers (pesante).
# Se non installato, skip tutti i test in questo file.
try:
    from src.retriever import RAGRetriever
except ImportError:
    pytest.skip(
        "sentence_transformers non installato (pip install sentence-transformers)",
        allow_module_level=True,
    )


class TestRAGRetriever:
    """Test per la classe RAGRetriever."""

    def test_init_defaults(self):
        """Verifica inizializzazione con parametri default."""
        # Mock dei componenti per evitare caricamento modelli
        with patch("src.retriever.KBEmbedder") as mock_emb, \
             patch("src.retriever.VectorDBClient") as mock_vdb, \
             patch("src.retriever.Reranker") as mock_rr:
            
            retriever = RAGRetriever(
                embedder=mock_emb(),
                vectordb=mock_vdb(),
                reranker=mock_rr(),
            )
            
            assert retriever.retrieval_top_k == 20
            assert retriever.rerank_top_k == 5
            assert retriever.use_reranker is True

    def test_check_confidence_empty(self):
        """Verifica che confidence sia False su risultati vuoti."""
        with patch("src.retriever.KBEmbedder") as mock_emb, \
             patch("src.retriever.VectorDBClient") as mock_vdb, \
             patch("src.retriever.Reranker") as mock_rr:
            
            retriever = RAGRetriever(
                embedder=mock_emb(),
                vectordb=mock_vdb(),
                reranker=mock_rr(),
            )
            
            assert retriever.check_confidence([]) is False

    def test_check_confidence_high(self):
        """Verifica confidence alta con score buoni."""
        with patch("src.retriever.KBEmbedder") as mock_emb, \
             patch("src.retriever.VectorDBClient") as mock_vdb, \
             patch("src.retriever.Reranker") as mock_rr:
            
            retriever = RAGRetriever(
                embedder=mock_emb(),
                vectordb=mock_vdb(),
                reranker=mock_rr(),
            )
            
            results = [
                {"text": "chunk1", "score": 0.8},
                {"text": "chunk2", "score": 0.7},
                {"text": "chunk3", "score": 0.6},
            ]
            
            assert retriever.check_confidence(results, threshold=0.3) is True

    def test_check_confidence_low(self):
        """Verifica confidence bassa con score scarsi."""
        with patch("src.retriever.KBEmbedder") as mock_emb, \
             patch("src.retriever.VectorDBClient") as mock_vdb, \
             patch("src.retriever.Reranker") as mock_rr:
            
            retriever = RAGRetriever(
                embedder=mock_emb(),
                vectordb=mock_vdb(),
                reranker=mock_rr(),
            )
            
            results = [
                {"text": "chunk1", "score": 0.1},
                {"text": "chunk2", "score": 0.15},
            ]
            
            assert retriever.check_confidence(results, threshold=0.3) is False

    def test_retrieve_with_context_empty(self):
        """Verifica formato contesto quando non ci sono risultati."""
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = np.zeros(1024)
        
        mock_vectordb = MagicMock()
        mock_vectordb.search.return_value = []
        
        mock_reranker = MagicMock()
        
        retriever = RAGRetriever(
            embedder=mock_embedder,
            vectordb=mock_vectordb,
            reranker=mock_reranker,
            use_reranker=False,
        )
        
        context = retriever.retrieve_with_context("test query")
        assert "Nessun documento" in context

    def test_retrieve_with_context_formatted(self):
        """Verifica formattazione corretta del contesto."""
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = np.zeros(1024)
        
        mock_vectordb = MagicMock()
        mock_vectordb.search.return_value = [
            {
                "text": "L'ACWR è il rapporto tra carico acuto e cronico.",
                "score": 0.85,
                "metadata": {"source": "acwr.md", "heading": "Definizione", "tags": []},
            }
        ]
        
        mock_reranker = MagicMock()
        
        retriever = RAGRetriever(
            embedder=mock_embedder,
            vectordb=mock_vectordb,
            reranker=mock_reranker,
            use_reranker=False,
        )
        
        context = retriever.retrieve_with_context("Cos'è l'ACWR?")
        
        assert "acwr.md" in context
        assert "Definizione" in context
        assert "ACWR" in context
        assert "0.85" in context
