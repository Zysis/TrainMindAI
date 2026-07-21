"""
scripts/03_index_vectordb.py
============================
STEP 3: Indicizzazione nel Vector Database (Qdrant)

Carica i chunk con i loro embeddings nel vector DB Qdrant.
Crea (o ricrea) la collection e inserisce tutti i punti.

Esecuzione:
    python scripts/03_index_vectordb.py

Prerequisiti:
    - Step 2 completato (embeddings.npy esiste)
    - Qdrant in esecuzione (docker run -p 6333:6333 qdrant/qdrant)

Output:
    Collection Qdrant "trainmind_kb_v1" popolata

Ri-eseguibile: Sì. Ricrea la collection da zero.

Nota: Per avviare Qdrant locale con Docker:
    docker run -d -p 6333:6333 -p 6334:6334 --name qdrant qdrant/qdrant
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel

from config.settings import settings
from src.embedder import KBEmbedder
from src.vectordb import VectorDBClient

console = Console()


def main():
    """Entry point: indicizzazione chunk su Qdrant."""
    
    console.print(Panel.fit(
        "[bold blue]STEP 3 — Indicizzazione Vector DB[/bold blue]\n"
        f"Vector DB: {settings.VECTOR_DB}\n"
        f"URL: {settings.QDRANT_URL}\n"
        f"Collection: {settings.KB_COLLECTION_NAME}\n"
        f"Input: {settings.chunks_dir}",
        title="TrainMindAI Pipeline"
    ))
    
    # Carica embeddings e chunk
    console.print("\n[bold]📂 Caricamento embeddings...[/bold]")
    
    try:
        embeddings, chunks = KBEmbedder.load_embeddings(settings.chunks_dir)
    except FileNotFoundError:
        console.print(f"[red]❌ Embeddings non trovati in {settings.chunks_dir}[/red]")
        console.print("   Esegui prima: python scripts/02_embed_kb.py")
        sys.exit(1)
    
    console.print(f"   {len(chunks)} chunk con embeddings caricati (dim={embeddings.shape[1]})")
    
    # Connessione a Qdrant
    console.print("\n[bold]🔌 Connessione a Qdrant...[/bold]")
    
    try:
        vectordb = VectorDBClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
            collection_name=settings.KB_COLLECTION_NAME,
        )
    except Exception as e:
        console.print(f"[red]❌ Connessione a Qdrant fallita: {e}[/red]")
        console.print("\n[yellow]💡 Suggerimento: avvia Qdrant con Docker:[/yellow]")
        console.print("   docker run -d -p 6333:6333 --name qdrant qdrant/qdrant")
        sys.exit(1)
    
    # Crea collection (ricrea se esiste)
    console.print("\n[bold]🏗️  Creazione collection...[/bold]")
    vectordb.create_collection(
        vector_size=embeddings.shape[1],
        recreate=True,  # Ricrea per garantire coerenza
    )
    
    # Indicizza
    console.print("\n[bold]📤 Indicizzazione punti...[/bold]")
    count = vectordb.upsert_chunks(chunks, embeddings)
    
    # Verifica
    console.print("\n[bold]🔍 Verifica...[/bold]")
    info = vectordb.get_collection_info()
    
    console.print(Panel.fit(
        f"[green]✅ Indicizzazione completata![/green]\n\n"
        f"Punti indicizzati: {count}\n"
        f"Collection: {info.get('name', 'N/A')}\n"
        f"Punti in DB: {info.get('points_count', 'N/A')}\n"
        f"Status: {info.get('status', 'N/A')}",
        title="Risultato"
    ))
    
    # Test di ricerca rapido
    console.print("\n[bold]🧪 Test ricerca rapido...[/bold]")
    from src.embedder import KBEmbedder as Emb
    
    test_embedder = Emb(model_name=settings.EMBED_MODEL, device=settings.EMBED_DEVICE)
    test_query = "Come interpretare un ACWR elevato?"
    test_embedding = test_embedder.embed_query(test_query)
    
    results = vectordb.search(test_embedding, top_k=3)
    
    console.print(f"   Query: '{test_query}'")
    console.print(f"   Risultati: {len(results)} chunk trovati")
    for i, r in enumerate(results, 1):
        console.print(f"   {i}. [{r['metadata']['source']}] score={r['score']:.3f}")
        console.print(f"      {r['text'][:100]}...")
    
    console.print("\n[dim]Prossimo step: python scripts/04_generate_sft_dataset.py[/dim]")


if __name__ == "__main__":
    main()
