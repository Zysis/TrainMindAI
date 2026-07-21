"""
src/reranker.py
===============
Modulo reranker per migliorare la precisione del retrieval RAG.

Dopo il retrieval iniziale (top-K dal vector DB), il reranker ri-ordina i risultati
usando un modello cross-encoder che valuta la rilevanza coppia (query, documento).
Questo migliora significativamente la groundedness dei report generati.

Modello default: BAAI/bge-reranker-v2-m3 (multilingue, ottimo per italiano).

Uso:
    from src.reranker import Reranker
    reranker = Reranker()
    reranked = reranker.rerank(query="ACWR alto", documents=retrieved_chunks, top_k=5)
"""

from typing import Optional

from rich.console import Console
from sentence_transformers import CrossEncoder

console = Console()


class Reranker:
    """
    Reranker cross-encoder per il retrieval RAG.
    
    Il reranker prende in input la query originale e i documenti recuperati
    dal vector DB, e li ri-ordina in base a uno score di rilevanza più preciso.
    
    A differenza del retrieval vettoriale (bi-encoder), il cross-encoder
    processa query e documento insieme, producendo score più accurati
    ma con latenza maggiore (per questo si applica solo ai top-K).
    
    Pipeline tipica:
    1. Vector DB retrieval: top-20 (veloce, approssimato)
    2. Reranker: top-20 → top-5 (preciso, più lento)
    3. LLM context: solo i top-5 reranked
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-v2-m3",
        device: str = "cpu",
        max_length: int = 512
    ):
        """
        Inizializza il reranker.
        
        Args:
            model_name: Nome del modello cross-encoder (da HuggingFace)
            device: Dispositivo di calcolo ("cpu", "cuda", "mps")
            max_length: Lunghezza massima input in token (query + documento)
        """
        self.model_name = model_name
        self.device = device
        self.max_length = max_length
        self._model: Optional[CrossEncoder] = None

    @property
    def model(self) -> CrossEncoder:
        """Caricamento lazy del modello cross-encoder."""
        if self._model is None:
            console.print(f"[blue]📥 Caricamento reranker: {self.model_name}[/blue]")
            self._model = CrossEncoder(
                self.model_name,
                max_length=self.max_length,
                device=self.device,
            )
            console.print(f"[green]✅ Reranker caricato[/green]")
        return self._model

    def rerank(
        self,
        query: str,
        documents: list[dict],
        top_k: int = 5,
        score_threshold: Optional[float] = None
    ) -> list[dict]:
        """
        Ri-ordina i documenti per rilevanza rispetto alla query.
        
        Args:
            query: Testo della query originale
            documents: Lista di dict con campo "text" (e opzionali "metadata", "score")
            top_k: Numero di documenti da restituire dopo il reranking
            score_threshold: Soglia minima di score (opzionale, filtra risultati poco rilevanti)
            
        Returns:
            Lista dei top-K documenti ri-ordinati, con campo "rerank_score" aggiunto
        """
        if not documents:
            return []
        
        # Prepara coppie (query, documento) per il cross-encoder
        pairs = [(query, doc["text"]) for doc in documents]
        
        # Calcola score di rilevanza
        scores = self.model.predict(pairs)
        
        # Aggiungi score ai documenti
        scored_documents = []
        for doc, score in zip(documents, scores):
            doc_copy = doc.copy()
            doc_copy["rerank_score"] = float(score)
            scored_documents.append(doc_copy)
        
        # Ordina per score decrescente
        scored_documents.sort(key=lambda x: x["rerank_score"], reverse=True)
        
        # Filtra per soglia se specificata
        if score_threshold is not None:
            scored_documents = [
                d for d in scored_documents if d["rerank_score"] >= score_threshold
            ]
        
        # Restituisci top-K
        return scored_documents[:top_k]

    def get_relevance_score(self, query: str, document: str) -> float:
        """
        Calcola lo score di rilevanza per una singola coppia query-documento.
        
        Args:
            query: Testo della query
            document: Testo del documento
            
        Returns:
            Score di rilevanza (float, più alto = più rilevante)
        """
        score = self.model.predict([(query, document)])
        return float(score[0])
