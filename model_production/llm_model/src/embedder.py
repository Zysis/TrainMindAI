"""
src/embedder.py
===============
Modulo per la generazione di embeddings vettoriali dai chunk della KB.

Usa sentence-transformers con modelli multilingual-e5 (default: e5-small, 384 dim).
Supporta batch processing e salvataggio locale degli embeddings.

Uso:
    from src.embedder import KBEmbedder
    embedder = KBEmbedder(model_name="intfloat/multilingual-e5-small")
    embeddings = embedder.embed_chunks(chunks)
    embedder.save_embeddings(embeddings, "data/chunks/embeddings.npz")
"""

import json
from pathlib import Path
from typing import Optional

import numpy as np
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from sentence_transformers import SentenceTransformer

console = Console()


class KBEmbedder:
    """
    Generatore di embeddings per la Knowledge Base di TrainMindAI.
    
    Utilizza modelli sentence-transformers ottimizzati per il retrieval multilingue.
    Il modello di default (multilingual-e5-small) produce vettori a 384 dimensioni.
    Per produzione, passare a multilingual-e5-large (1024 dim) per qualità superiore.
    
    Nota: per e5-large, il testo va prefissato con "query: " per le query
    e "passage: " per i documenti da indicizzare.
    """

    def __init__(
        self,
        model_name: str = "intfloat/multilingual-e5-small",
        device: str = "cpu",
        batch_size: int = 32
    ):
        """
        Inizializza l'embedder.
        
        Args:
            model_name: Nome del modello sentence-transformers (da HuggingFace)
            device: Dispositivo di calcolo ("cpu", "cuda", "mps")
            batch_size: Dimensione batch per encoding (ridurre se poca RAM/VRAM)
        """
        self.model_name = model_name
        self.device = device
        self.batch_size = batch_size
        self._model: Optional[SentenceTransformer] = None

    @property
    def model(self) -> SentenceTransformer:
        """Caricamento lazy del modello (scaricato al primo uso)."""
        if self._model is None:
            console.print(f"[blue]📥 Caricamento modello embeddings: {self.model_name}[/blue]")
            console.print(f"   Device: {self.device}")
            self._model = SentenceTransformer(self.model_name, device=self.device)
            dim = self._model.get_embedding_dimension() if hasattr(self._model, 'get_embedding_dimension') else self._model.get_sentence_embedding_dimension()
            console.print(f"[green]✅ Modello caricato. Dimensione embedding: {dim}[/green]")
        return self._model

    @property
    def embedding_dim(self) -> int:
        """Dimensione del vettore embedding prodotto dal modello."""
        return self.model.get_embedding_dimension() if hasattr(self.model, 'get_embedding_dimension') else self.model.get_sentence_embedding_dimension()

    def _prepare_text_for_indexing(self, text: str) -> str:
        """
        Prepara il testo per l'indicizzazione (passage).
        Per modelli e5: aggiunge il prefisso "passage: ".
        
        Args:
            text: Testo originale del chunk
            
        Returns:
            Testo preparato per embedding
        """
        if "e5" in self.model_name.lower():
            return f"passage: {text}"
        return text

    def _prepare_text_for_query(self, text: str) -> str:
        """
        Prepara il testo per una query di ricerca.
        Per modelli e5: aggiunge il prefisso "query: ".
        
        Args:
            text: Testo della query
            
        Returns:
            Testo preparato per embedding query
        """
        if "e5" in self.model_name.lower():
            return f"query: {text}"
        return text

    def embed_chunks(self, chunks: list[dict]) -> np.ndarray:
        """
        Genera embeddings per una lista di chunk.
        
        Args:
            chunks: Lista di dict con campo "text" (output di KBChunker.load_chunks)
            
        Returns:
            Array numpy di shape (n_chunks, embedding_dim)
        """
        # Estrai e prepara i testi
        texts = [self._prepare_text_for_indexing(chunk["text"]) for chunk in chunks]
        
        console.print(f"[blue]🔢 Generazione embeddings per {len(texts)} chunk...[/blue]")
        
        # Genera embeddings in batch con progress bar
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
        ) as progress:
            task = progress.add_task("Embedding", total=len(texts))
            
            all_embeddings = []
            for i in range(0, len(texts), self.batch_size):
                batch = texts[i:i + self.batch_size]
                batch_embeddings = self.model.encode(
                    batch,
                    show_progress_bar=False,
                    normalize_embeddings=True  # Normalizza per cosine similarity
                )
                all_embeddings.append(batch_embeddings)
                progress.update(task, advance=len(batch))
        
        embeddings = np.vstack(all_embeddings)
        
        console.print(f"[green]✅ Embeddings generati: shape {embeddings.shape}[/green]")
        return embeddings

    def embed_query(self, query: str) -> np.ndarray:
        """
        Genera l'embedding per una singola query di ricerca.
        
        Args:
            query: Testo della query
            
        Returns:
            Array numpy di shape (embedding_dim,)
        """
        prepared = self._prepare_text_for_query(query)
        embedding = self.model.encode(
            [prepared],
            normalize_embeddings=True
        )
        return embedding[0]

    def embed_texts(self, texts: list[str], is_query: bool = False) -> np.ndarray:
        """
        Genera embeddings per una lista di testi generici.
        
        Args:
            texts: Lista di testi
            is_query: Se True, prepara come query; se False, come passage
            
        Returns:
            Array numpy di shape (n_texts, embedding_dim)
        """
        if is_query:
            prepared = [self._prepare_text_for_query(t) for t in texts]
        else:
            prepared = [self._prepare_text_for_indexing(t) for t in texts]
        
        embeddings = self.model.encode(
            prepared,
            batch_size=self.batch_size,
            show_progress_bar=True,
            normalize_embeddings=True
        )
        return embeddings

    def save_embeddings(
        self,
        embeddings: np.ndarray,
        chunks: list[dict],
        output_dir: Path | str
    ) -> Path:
        """
        Salva embeddings e chunk associati su disco.
        
        Salva due file:
        - embeddings.npy: array numpy con i vettori
        - chunks_with_ids.json: chunk con mapping agli indici degli embeddings
        
        Args:
            embeddings: Array embeddings (n_chunks, dim)
            chunks: Lista di chunk originali
            output_dir: Directory di output
            
        Returns:
            Path alla directory di output
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Salva embeddings come file numpy
        emb_path = output_dir / "embeddings.npy"
        np.save(emb_path, embeddings)
        
        # Salva chunks con indice corrispondente
        chunks_path = output_dir / "chunks_with_embeddings.json"
        chunks_with_idx = []
        for i, chunk in enumerate(chunks):
            chunk_copy = chunk.copy()
            chunk_copy["embedding_index"] = i
            chunks_with_idx.append(chunk_copy)
        
        with open(chunks_path, "w", encoding="utf-8") as f:
            json.dump(chunks_with_idx, f, ensure_ascii=False, indent=2)
        
        console.print(f"[green]💾 Embeddings salvati in: {output_dir}[/green]")
        console.print(f"   - {emb_path.name}: {embeddings.shape}")
        console.print(f"   - {chunks_path.name}: {len(chunks)} chunk")
        
        return output_dir

    @staticmethod
    def load_embeddings(directory: Path | str) -> tuple[np.ndarray, list[dict]]:
        """
        Carica embeddings e chunk precedentemente salvati.
        
        Args:
            directory: Directory con embeddings.npy e chunks_with_embeddings.json
            
        Returns:
            Tupla (embeddings_array, chunks_list)
        """
        directory = Path(directory)
        
        embeddings = np.load(directory / "embeddings.npy")
        
        with open(directory / "chunks_with_embeddings.json", "r", encoding="utf-8") as f:
            chunks = json.load(f)
        
        return embeddings, chunks
