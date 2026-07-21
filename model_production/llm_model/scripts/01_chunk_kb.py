"""
scripts/01_chunk_kb.py
======================
STEP 1: Chunking della Knowledge Base

Legge tutti i documenti Markdown dalla cartella docs/kb/,
li divide in chunk di 400-800 token con overlap 80,
e salva i risultati in data/chunks/chunks.json.

Esecuzione:
    python scripts/01_chunk_kb.py

Output:
    data/chunks/chunks.json — Tutti i chunk con metadati

Ri-eseguibile: Sì. Sovrascrive i chunk precedenti.
"""

import sys
from pathlib import Path

# Aggiungi la root del progetto al path per gli import
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel

from config.settings import settings
from src.chunker import KBChunker

console = Console()


def main():
    """Entry point: chunking di tutti i documenti KB."""
    
    console.print(Panel.fit(
        "[bold blue]STEP 1 — Chunking Knowledge Base[/bold blue]\n"
        f"Input: {settings.kb_docs_dir}\n"
        f"Output: {settings.chunks_dir}\n"
        f"Chunk size: {settings.KB_CHUNK_SIZE} token\n"
        f"Overlap: {settings.KB_CHUNK_OVERLAP} token",
        title="TrainMindAI Pipeline"
    ))
    
    # Verifica che la directory KB esista
    if not settings.kb_docs_dir.exists():
        console.print(f"[red]❌ Directory KB non trovata: {settings.kb_docs_dir}[/red]")
        console.print("   Assicurati che docs/kb/ contenga i file .md della Knowledge Base.")
        sys.exit(1)
    
    # Inizializza il chunker
    chunker = KBChunker(
        chunk_size=settings.KB_CHUNK_SIZE,
        chunk_overlap=settings.KB_CHUNK_OVERLAP,
    )
    
    # Processa tutti i file
    console.print("\n[bold]📚 Elaborazione documenti:[/bold]")
    chunks = chunker.process_directory(settings.kb_docs_dir)
    
    if not chunks:
        console.print("[red]❌ Nessun chunk generato. Verifica i documenti in docs/kb/[/red]")
        sys.exit(1)
    
    # Salva chunks
    console.print("\n[bold]💾 Salvataggio:[/bold]")
    chunker.save_chunks(chunks, settings.chunks_dir)
    
    # Statistiche finali
    total_tokens = sum(c.token_count for c in chunks)
    avg_tokens = total_tokens // len(chunks)
    
    console.print(Panel.fit(
        f"[green]✅ Chunking completato![/green]\n\n"
        f"Documenti elaborati: {len(set(c.metadata.source for c in chunks))}\n"
        f"Chunk generati: {len(chunks)}\n"
        f"Token totali: {total_tokens:,}\n"
        f"Token medi per chunk: {avg_tokens}\n"
        f"Output: {settings.chunks_dir / 'chunks.json'}",
        title="Risultato"
    ))
    
    console.print("\n[dim]Prossimo step: python scripts/02_embed_kb.py[/dim]")


if __name__ == "__main__":
    main()
