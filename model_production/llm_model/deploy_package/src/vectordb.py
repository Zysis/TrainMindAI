"""
src/vectordb.py
===============
Client per il vector database Qdrant.
Gestisce creazione collection, indicizzazione e ricerca vettoriale.

Supporta sia Qdrant locale (Docker) che Qdrant Cloud.

Uso:
    from src.vectordb import QdrantClient
    client = QdrantClient(url="http://localhost:6333")
    client.create_collection("trainmind_kb_v1", vector_size=1024)
    client.upsert_chunks(chunks, embeddings)
    results = client.search(query_embedding, top_k=10)
"""

from pathlib import Path
from typing import Optional

import numpy as np
from qdrant_client import QdrantClient as _QdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)
from rich.console import Console

console = Console()


class VectorDBClient:
    """
    Client wrapper per Qdrant vector database.
    
    Gestisce:
    - Creazione e configurazione della collection
    - Inserimento batch di chunk con embeddings e metadati
    - Ricerca semantica con filtri opzionali per metadati
    - Eliminazione e ricreazione dell'indice per aggiornamenti
    """

    def __init__(
        self,
        url: str = "http://localhost:6333",
        api_key: Optional[str] = None,
        collection_name: str = "trainmind_kb_v1"
    ):
        """
        Inizializza il client Qdrant.
        
        Args:
            url: URL del server Qdrant (locale o cloud)
            api_key: API key per Qdrant Cloud (opzionale per locale)
            collection_name: Nome della collection da usare
        """
        self.url = url
        self.collection_name = collection_name
        
        # Connessione al server Qdrant
        if api_key:
            self.client = _QdrantClient(url=url, api_key=api_key)
        else:
            self.client = _QdrantClient(url=url)
        
        console.print(f"[blue]🔌 Connesso a Qdrant: {url}[/blue]")

    def create_collection(
        self,
        vector_size: int = 384,
        distance: Distance = Distance.COSINE,
        recreate: bool = False
    ) -> None:
        """
        Crea la collection per la Knowledge Base.
        
        Args:
            vector_size: Dimensione dei vettori (384 per multilingual-e5-small, 1024 per e5-large)
            distance: Metrica di distanza (COSINE per embeddings normalizzati)
            recreate: Se True, elimina e ricrea la collection se esiste
        """
        # Verifica se la collection esiste già
        collections = self.client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if self.collection_name in collection_names:
            if recreate:
                console.print(f"[yellow]🗑️  Eliminazione collection esistente: {self.collection_name}[/yellow]")
                self.client.delete_collection(self.collection_name)
            else:
                console.print(f"[yellow]ℹ️  Collection '{self.collection_name}' già esistente. Usa recreate=True per sovrascrivere.[/yellow]")
                return
        
        # Crea nuova collection
        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=distance,
            ),
        )
        
        console.print(f"[green]✅ Collection creata: {self.collection_name} (dim={vector_size}, dist={distance})[/green]")

    def upsert_chunks(
        self,
        chunks: list[dict],
        embeddings: np.ndarray,
        batch_size: int = 100
    ) -> int:
        """
        Inserisce chunk con i loro embeddings nella collection.
        
        Args:
            chunks: Lista di dict con campi "chunk_id", "text", "metadata"
            embeddings: Array numpy (n_chunks, vector_size)
            batch_size: Dimensione batch per l'upload
            
        Returns:
            Numero di punti inseriti
        """
        if len(chunks) != embeddings.shape[0]:
            raise ValueError(
                f"Mismatch: {len(chunks)} chunk vs {embeddings.shape[0]} embeddings"
            )
        
        console.print(f"[blue]📤 Indicizzazione {len(chunks)} chunk in '{self.collection_name}'...[/blue]")
        
        total_uploaded = 0
        
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i + batch_size]
            batch_embeddings = embeddings[i:i + batch_size]
            
            points = []
            for j, (chunk, embedding) in enumerate(zip(batch_chunks, batch_embeddings)):
                # Costruisci payload con metadati per filtri
                payload = {
                    "chunk_id": chunk.get("chunk_id", f"chunk_{i+j}"),
                    "text": chunk["text"],
                    "source": chunk["metadata"]["source"],
                    "title": chunk["metadata"]["title"],
                    "domain": chunk["metadata"]["domain"],
                    "level": chunk["metadata"]["level"],
                    "lang": chunk["metadata"]["lang"],
                    "version": chunk["metadata"]["version"],
                    "tags": chunk["metadata"].get("tags", []),
                    "heading": chunk["metadata"].get("heading", ""),
                }
                
                point = PointStruct(
                    id=i + j,  # ID numerico incrementale
                    vector=embedding.tolist(),
                    payload=payload,
                )
                points.append(point)
            
            # Upload batch
            self.client.upsert(
                collection_name=self.collection_name,
                points=points,
            )
            total_uploaded += len(points)
        
        console.print(f"[green]✅ {total_uploaded} punti indicizzati in '{self.collection_name}'[/green]")
        return total_uploaded

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        domain_filter: Optional[str] = None,
        level_filter: Optional[str] = None,
        score_threshold: float = 0.0
    ) -> list[dict]:
        """
        Ricerca semantica nella collection.
        
        Args:
            query_embedding: Vettore embedding della query (1D array)
            top_k: Numero massimo di risultati
            domain_filter: Filtra per dominio (es. "workload", "rtp")
            level_filter: Filtra per livello (es. "base", "advanced")
            score_threshold: Soglia minima di similarità (0.0 = nessun filtro)
            
        Returns:
            Lista di dict con "text", "metadata", "score"
        """
        # Costruisci filtro opzionale
        must_conditions = []
        
        if domain_filter:
            must_conditions.append(
                FieldCondition(key="domain", match=MatchValue(value=domain_filter))
            )
        
        if level_filter:
            must_conditions.append(
                FieldCondition(key="level", match=MatchValue(value=level_filter))
            )
        
        query_filter = Filter(must=must_conditions) if must_conditions else None
        
        # Esegui ricerca (qdrant-client v2.x usa query_points)
        response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_embedding.tolist(),
            query_filter=query_filter,
            limit=top_k,
            score_threshold=score_threshold if score_threshold > 0 else None,
        )
        
        # Formatta risultati
        formatted_results = []
        for hit in response.points:
            formatted_results.append({
                "text": hit.payload.get("text", ""),
                "score": hit.score,
                "metadata": {
                    "chunk_id": hit.payload.get("chunk_id", ""),
                    "source": hit.payload.get("source", ""),
                    "title": hit.payload.get("title", ""),
                    "domain": hit.payload.get("domain", ""),
                    "level": hit.payload.get("level", ""),
                    "heading": hit.payload.get("heading", ""),
                    "tags": hit.payload.get("tags", []),
                },
            })
        
        return formatted_results

    def get_collection_info(self) -> dict:
        """Restituisce informazioni sulla collection corrente."""
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "name": self.collection_name,
                "points_count": info.points_count,
                "vectors_count": getattr(info, "vectors_count", info.points_count),
                "status": getattr(info, "status", "ok"),
            }
        except Exception as e:
            return {"error": str(e)}

    def delete_collection(self) -> None:
        """Elimina la collection corrente."""
        self.client.delete_collection(self.collection_name)
        console.print(f"[yellow]🗑️  Collection '{self.collection_name}' eliminata[/yellow]")
