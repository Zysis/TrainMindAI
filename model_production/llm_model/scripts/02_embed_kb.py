"""
scripts/02_embed_kb.py
======================
STEP 2: Generazione Embeddings per la Knowledge Base

Legge i chunk da data/chunks/chunks.json, genera gli embeddings
con il modello multilingual-e5-large, e salva il risultato in
data/chunks/embeddings.npy + chunks_with_embeddings.json.

Esecuzione:
    python scripts/02_embed_kb.py

Prerequisiti:
    - Step 1 completato (data/chunks/chunks.json esiste)
    - ~2GB RAM libera per il modello embedding

Output:
    data/chunks/embeddings.npy — Array numpy degli embeddings
    data/chunks/chunks_with_embeddings.json — Chunk con indice embedding

Ri-eseguibile: Sì. Sovrascrive embeddings precedenti.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel

from config.settings import settings
from src.chunker import KBChunker
from src.embedder import KBEmbedder

console = Console()


def main():
    """Entry point: generazione embeddings per tutti i chunk."""
    
    console.print(Panel.fit(
        "[bold blue]STEP 2 — Generazione Embeddings[/bold blue]\n"
        f"Modello: {settings.EMBED_MODEL}\n"
        f"Device: {settings.EMBED_DEVICE}\n"
        f"Input: {settings.chunks_dir / 'chunks.json'}",
        title="TrainMindAI Pipeline"
    ))
    
    # Verifica che i chunk esistano
    chunks_file = settings.chunks_dir / "chunks.json"
    if not chunks_file.exists():
        console.print(f"[red]❌ File chunk non trovato: {chunks_file}[/red]")
        console.print("   Esegui prima: python scripts/01_chunk_kb.py")
        sys.exit(1)
    
    # Carica chunk
    console.print("\n[bold]📂 Caricamento chunk...[/bold]")
    chunks = KBChunker.load_chunks(chunks_file)
    console.print(f"   {len(chunks)} chunk caricati")
    
    # Inizializza embedder
    console.print("\n[bold]🔢 Inizializzazione embedder...[/bold]")
    embedder = KBEmbedder(
        model_name=settings.EMBED_MODEL,
        device=settings.EMBED_DEVICE,
        batch_size=32,
    )
    
    # Genera embeddings
    console.print("\n[bold]⚡ Generazione embeddings...[/bold]")
    embeddings = embedder.embed_chunks(chunks)
    
    # Salva
    console.print("\n[bold]💾 Salvataggio...[/bold]")
    embedder.save_embeddings(embeddings, chunks, settings.chunks_dir)
    
    # Risultato
    console.print(Panel.fit(
        f"[green]✅ Embeddings generati![/green]\n\n"
        f"Chunk processati: {len(chunks)}\n"
        f"Dimensione embedding: {embeddings.shape[1]}\n"
        f"Shape totale: {embeddings.shape}\n"
        f"Output: {settings.chunks_dir}",
        title="Risultato"
    ))
    
    console.print("\n[dim]Prossimo step: python scripts/03_index_vectordb.py[/dim]")


if __name__ == "__main__":
    main()
