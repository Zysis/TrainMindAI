"""
src/retriever.py
================
Retriever RAG completo: combina ricerca vettoriale + reranking.

Implementa la pipeline completa di retrieval:
1. Query → embedding
2. Ricerca nel vector DB (top-K ampio)
3. Reranking (top-K ristretto, più preciso)
4. Restituzione chunk rilevanti con score

Uso:
    from src.retriever import RAGRetriever
    retriever = RAGRetriever()
    results = retriever.retrieve("Come interpretare un ACWR di 1.6?", top_k=5)
"""

from typing import Optional

import numpy as np
from rich.console import Console

from src.embedder import KBEmbedder
from src.reranker import Reranker
from src.vectordb import VectorDBClient

console = Console()


class RAGRetriever:
    """
    Retriever RAG completo per TrainMindAI.
    
    Combina:
    - Embedding della query (sentence-transformers)
    - Ricerca vettoriale in Qdrant (top-K ampio)
    - Reranking cross-encoder (top-K ristretto)
    
    Il risultato è una lista di chunk altamente rilevanti che verranno
    passati come contesto al LLM per generare la risposta.
    """

    def __init__(
        self,
        embedder: Optional[KBEmbedder] = None,
        vectordb: Optional[VectorDBClient] = None,
        reranker: Optional[Reranker] = None,
        retrieval_top_k: int = 20,
        rerank_top_k: int = 5,
        use_reranker: bool = True
    ):
        """
        Inizializza il retriever.
        
        Args:
            embedder: Istanza KBEmbedder (creata con default se None)
            vectordb: Istanza VectorDBClient (creata con default se None)
            reranker: Istanza Reranker (creata con default se None)
            retrieval_top_k: Numero risultati dalla ricerca vettoriale iniziale
            rerank_top_k: Numero risultati dopo il reranking
            use_reranker: Se True, applica il reranker dopo il retrieval
        """
        self.embedder = embedder or KBEmbedder()
        self.vectordb = vectordb or VectorDBClient()
        self._reranker = reranker
        self._reranker_initialized = reranker is not None
        self.retrieval_top_k = retrieval_top_k
        self.rerank_top_k = rerank_top_k
        self.use_reranker = use_reranker

    @property
    def reranker(self):
        """Lazy init del reranker — fallback graceful se non disponibile."""
        if not self._reranker_initialized:
            try:
                self._reranker = Reranker()
                self._reranker_initialized = True
            except Exception as e:
                console.print(f"[yellow]⚠️  Reranker non disponibile: {e}[/yellow]")
                console.print("[yellow]   Proseguo senza reranking.[/yellow]")
                self._reranker = None
                self._reranker_initialized = True
                self.use_reranker = False
        return self._reranker

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        domain_filter: Optional[str] = None,
        level_filter: Optional[str] = None
    ) -> list[dict]:
        """
        Esegue il retrieval completo: embedding → search → rerank.
        
        Args:
            query: Testo della query di ricerca
            top_k: Numero di risultati finali (override di rerank_top_k)
            domain_filter: Filtra per dominio KB (es. "workload", "rtp")
            level_filter: Filtra per livello (es. "base", "advanced")
            
        Returns:
            Lista di dict con "text", "metadata", "score", "rerank_score"
        """
        final_top_k = top_k or self.rerank_top_k
        
        # Step 1: Genera embedding della query
        query_embedding = self.embedder.embed_query(query)
        
        # Step 2: Ricerca vettoriale (top-K ampio)
        vector_results = self.vectordb.search(
            query_embedding=query_embedding,
            top_k=self.retrieval_top_k,
            domain_filter=domain_filter,
            level_filter=level_filter,
        )
        
        if not vector_results:
            console.print("[yellow]⚠️  Nessun risultato dal vector DB[/yellow]")
            return []
        
        # Step 3: Reranking (opzionale)
        if self.use_reranker and len(vector_results) > final_top_k:
            try:
                results = self.reranker.rerank(
                    query=query,
                    documents=vector_results,
                    top_k=final_top_k,
                )
            except Exception as e:
                console.print(f"[yellow]⚠️  Reranking fallito: {e}[/yellow]")
                console.print("[yellow]   Uso risultati vector search senza reranking.[/yellow]")
                self.use_reranker = False
                results = vector_results[:final_top_k]
        else:
            results = vector_results[:final_top_k]
        
        return results

    def retrieve_with_context(
        self,
        query: str,
        top_k: Optional[int] = None,
        domain_filter: Optional[str] = None,
        max_context_tokens: int = 3000
    ) -> str:
        """
        Esegue il retrieval e formatta i risultati come contesto testuale
        pronto per essere inserito nel prompt del LLM.
        
        Args:
            query: Testo della query
            top_k: Numero massimo di chunk da includere
            domain_filter: Filtro per dominio
            max_context_tokens: Limite massimo di token nel contesto
            
        Returns:
            Stringa formattata con i chunk rilevanti come contesto
        """
        results = self.retrieve(
            query=query,
            top_k=top_k,
            domain_filter=domain_filter,
        )
        
        if not results:
            return "[Nessun documento rilevante trovato nella knowledge base.]"
        
        # Formatta come contesto per il LLM
        context_parts = []
        for i, result in enumerate(results, 1):
            source = result["metadata"].get("source", "unknown")
            heading = result["metadata"].get("heading", "")
            score = result.get("rerank_score", result.get("score", 0))
            
            header = f"[Fonte {i}: {source}"
            if heading:
                header += f" > {heading}"
            header += f" | rilevanza: {score:.2f}]"
            
            context_parts.append(f"{header}\n{result['text']}")
        
        context = "\n\n---\n\n".join(context_parts)
        return context

    def check_confidence(self, results: list[dict], threshold: float = 0.3) -> bool:
        """
        Verifica se i risultati del retrieval sono sufficientemente confidenti.
        Se la confidenza è bassa, il sistema deve dichiararlo all'utente.
        
        Args:
            results: Risultati del retrieval
            threshold: Soglia minima di score medio
            
        Returns:
            True se la confidenza è sufficiente, False se bassa
        """
        if not results:
            return False
        
        # Usa rerank_score se disponibile, altrimenti score
        scores = [
            r.get("rerank_score", r.get("score", 0))
            for r in results
        ]
        avg_score = np.mean(scores)
        
        return bool(avg_score >= threshold)
