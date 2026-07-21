"""
src/chunker.py
==============
Modulo per il chunking intelligente dei documenti della Knowledge Base.

Funzionalità:
- Legge documenti Markdown con header YAML (metadati)
- Divide il testo in chunk di 400-800 token con overlap configurabile
- Preserva i metadati del documento originale in ogni chunk
- Split preferenziale su heading/paragrafi per mantenere coerenza semantica

Uso:
    from src.chunker import KBChunker
    chunker = KBChunker(chunk_size=600, chunk_overlap=80)
    chunks = chunker.process_directory("docs/kb/")
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import tiktoken
import yaml
from rich.console import Console

console = Console()


@dataclass
class ChunkMetadata:
    """Metadati associati a ogni chunk della Knowledge Base."""
    source: str                    # Nome file sorgente
    title: str                     # Titolo del documento
    domain: str                    # Dominio (workload, rtp, glossary, ecc.)
    level: str = "base"            # Livello (base, intermediate, advanced)
    lang: str = "it"               # Lingua
    version: int = 1               # Versione del documento
    date: str = ""                 # Data di creazione/aggiornamento
    tags: list[str] = field(default_factory=list)
    chunk_index: int = 0           # Indice del chunk nel documento
    total_chunks: int = 0          # Numero totale di chunk nel documento
    heading: str = ""              # Heading della sezione a cui appartiene il chunk


@dataclass
class Chunk:
    """Un singolo chunk di testo con i suoi metadati."""
    text: str                      # Contenuto testuale del chunk
    metadata: ChunkMetadata        # Metadati associati
    token_count: int = 0           # Numero di token nel chunk
    chunk_id: str = ""             # ID univoco del chunk (source_chunkN)


class KBChunker:
    """
    Chunker per documenti Markdown della Knowledge Base.
    
    Strategia di chunking:
    1. Parsing header YAML per estrarre metadati
    2. Split primario su heading (## e ###)
    3. Se una sezione supera chunk_size, split su paragrafi
    4. Se un paragrafo supera chunk_size, split su frasi con overlap
    5. Ogni chunk mantiene i metadati del documento + heading di appartenenza
    """

    def __init__(
        self,
        chunk_size: int = 600,
        chunk_overlap: int = 80,
        tokenizer_name: str = "cl100k_base"
    ):
        """
        Inizializza il chunker.
        
        Args:
            chunk_size: Dimensione target dei chunk in token (400-800)
            chunk_overlap: Sovrapposizione tra chunk consecutivi in token
            tokenizer_name: Nome del tokenizer tiktoken da usare per il conteggio
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.tokenizer = tiktoken.get_encoding(tokenizer_name)

    def count_tokens(self, text: str) -> int:
        """Conta il numero di token in un testo."""
        return len(self.tokenizer.encode(text))

    def parse_markdown_with_yaml(self, filepath: Path) -> tuple[dict, str]:
        """
        Legge un file Markdown e separa header YAML dal contenuto.
        
        Args:
            filepath: Path al file .md
            
        Returns:
            Tupla (metadati_dict, contenuto_markdown)
        """
        content = filepath.read_text(encoding="utf-8")
        
        # Estrai header YAML (tra --- e ---)
        yaml_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        
        if yaml_match:
            yaml_str = yaml_match.group(1)
            metadata = yaml.safe_load(yaml_str)
            body = content[yaml_match.end():]
        else:
            metadata = {}
            body = content
        
        return metadata, body

    def split_by_headings(self, text: str) -> list[tuple[str, str]]:
        """
        Divide il testo in sezioni basandosi sugli heading Markdown (##, ###).
        
        Args:
            text: Testo Markdown
            
        Returns:
            Lista di tuple (heading, contenuto_sezione)
        """
        # Pattern per heading di livello 2 e 3
        pattern = r"^(#{2,3}\s+.+)$"
        
        sections = []
        current_heading = ""
        current_content = []
        
        for line in text.split("\n"):
            if re.match(pattern, line):
                # Salva sezione precedente
                if current_content:
                    sections.append((current_heading, "\n".join(current_content).strip()))
                current_heading = line.strip("# ").strip()
                current_content = []
            else:
                current_content.append(line)
        
        # Ultima sezione
        if current_content:
            sections.append((current_heading, "\n".join(current_content).strip()))
        
        return sections

    def split_text_with_overlap(self, text: str, heading: str = "") -> list[str]:
        """
        Divide un testo lungo in chunk con overlap.
        Split su paragrafi, poi su frasi se necessario.
        
        Args:
            text: Testo da dividere
            heading: Heading della sezione (aggiunto come contesto)
            
        Returns:
            Lista di chunk di testo
        """
        # Split su paragrafi (doppio newline)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for para in paragraphs:
            para_tokens = self.count_tokens(para)
            
            # Se il singolo paragrafo è troppo lungo, split su frasi
            if para_tokens > self.chunk_size:
                # Salva chunk corrente se non vuoto
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = []
                    current_tokens = 0
                
                # Split paragrafo lungo su frasi
                sentences = re.split(r"(?<=[.!?])\s+", para)
                for sentence in sentences:
                    sent_tokens = self.count_tokens(sentence)
                    if current_tokens + sent_tokens > self.chunk_size and current_chunk:
                        chunks.append("\n\n".join(current_chunk))
                        # Overlap: mantieni l'ultima frase
                        overlap_text = current_chunk[-1] if current_chunk else ""
                        current_chunk = [overlap_text] if overlap_text else []
                        current_tokens = self.count_tokens(overlap_text)
                    current_chunk.append(sentence)
                    current_tokens += sent_tokens
            
            # Paragrafo entra nel chunk corrente
            elif current_tokens + para_tokens <= self.chunk_size:
                current_chunk.append(para)
                current_tokens += para_tokens
            
            # Paragrafo non entra: salva chunk corrente e inizia nuovo
            else:
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                # Overlap: mantieni l'ultimo paragrafo
                overlap_text = current_chunk[-1] if current_chunk else ""
                overlap_tokens = self.count_tokens(overlap_text) if overlap_text else 0
                current_chunk = [overlap_text, para] if overlap_text else [para]
                current_tokens = overlap_tokens + para_tokens
        
        # Ultimo chunk
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))
        
        return chunks

    def _merge_small_chunks(
        self,
        chunks: list[tuple[str, str]],
        min_tokens: int = 100
    ) -> list[tuple[str, str]]:
        """
        Unisce chunk troppo piccoli con il chunk adiacente.
        
        Strategia: se un chunk ha meno di min_tokens, viene fuso con il
        precedente (se stesso heading) o con il successivo. Questo evita
        chunk di 5-20 token inutili per il retrieval.
        
        Args:
            chunks: Lista di tuple (heading, text)
            min_tokens: Soglia minima in token sotto cui fare merge
            
        Returns:
            Lista di tuple (heading, text) con chunk piccoli fusi
        """
        if not chunks:
            return chunks
        
        merged = []
        
        for heading, text in chunks:
            tokens = self.count_tokens(text)
            
            # Se il chunk è abbastanza grande, aggiungilo direttamente
            if tokens >= min_tokens:
                merged.append((heading, text))
                continue
            
            # Chunk piccolo: prova a fonderlo con il precedente
            if merged:
                prev_heading, prev_text = merged[-1]
                combined_tokens = self.count_tokens(prev_text) + tokens
                
                # Fonde solo se il risultato non supera chunk_size
                if combined_tokens <= self.chunk_size:
                    merged[-1] = (prev_heading, prev_text + "\n\n" + text)
                    continue
            
            # Se non può fondersi col precedente, aggiungilo comunque
            merged.append((heading, text))
        
        return merged

    def process_file(self, filepath: Path) -> list[Chunk]:
        """
        Processa un singolo file Markdown e restituisce i chunk.
        
        Args:
            filepath: Path al file .md
            
        Returns:
            Lista di oggetti Chunk
        """
        # 1. Parsing header YAML + contenuto
        metadata_dict, body = self.parse_markdown_with_yaml(filepath)
        
        # 2. Estrai metadati
        source = filepath.name
        title = metadata_dict.get("title", filepath.stem)
        domain = metadata_dict.get("domain", "general")
        level = metadata_dict.get("level", "base")
        lang = metadata_dict.get("lang", "it")
        version = metadata_dict.get("version", 1)
        date = metadata_dict.get("date", "")
        tags = metadata_dict.get("tags", [])
        
        # 3. Split per heading
        sections = self.split_by_headings(body)
        
        # 4. Per ogni sezione, genera chunk
        all_chunks = []
        
        for heading, section_text in sections:
            if not section_text.strip():
                continue
            
            section_tokens = self.count_tokens(section_text)
            
            # Sezione entra in un singolo chunk
            if section_tokens <= self.chunk_size:
                # Aggiungi heading come contesto se presente
                chunk_text = f"## {heading}\n\n{section_text}" if heading else section_text
                all_chunks.append((heading, chunk_text))
            
            # Sezione troppo lunga: split con overlap
            else:
                sub_chunks = self.split_text_with_overlap(section_text, heading)
                for sub_chunk in sub_chunks:
                    chunk_text = f"## {heading}\n\n{sub_chunk}" if heading else sub_chunk
                    all_chunks.append((heading, chunk_text))
        
        # 5. Merge chunk piccoli (<min_chunk_tokens) con il precedente
        all_chunks = self._merge_small_chunks(all_chunks)
        
        # 6. Costruisci oggetti Chunk con metadati
        chunks = []
        total = len(all_chunks)
        
        for i, (heading, text) in enumerate(all_chunks):
            chunk_metadata = ChunkMetadata(
                source=source,
                title=title,
                domain=domain,
                level=level,
                lang=lang,
                version=version,
                date=str(date),
                tags=tags,
                chunk_index=i,
                total_chunks=total,
                heading=heading,
            )
            
            chunk = Chunk(
                text=text,
                metadata=chunk_metadata,
                token_count=self.count_tokens(text),
                chunk_id=f"{filepath.stem}_chunk{i:03d}",
            )
            chunks.append(chunk)
        
        return chunks

    def process_directory(self, directory: Path | str) -> list[Chunk]:
        """
        Processa tutti i file .md in una directory.
        
        Args:
            directory: Path alla directory con i documenti KB
            
        Returns:
            Lista di tutti i chunk generati
        """
        directory = Path(directory)
        
        if not directory.exists():
            raise FileNotFoundError(f"Directory non trovata: {directory}")
        
        md_files = sorted(directory.glob("*.md"))
        
        if not md_files:
            console.print(f"[yellow]⚠️  Nessun file .md trovato in {directory}[/yellow]")
            return []
        
        all_chunks = []
        
        for filepath in md_files:
            console.print(f"  📄 Processing: {filepath.name}")
            file_chunks = self.process_file(filepath)
            all_chunks.extend(file_chunks)
            console.print(f"     → {len(file_chunks)} chunk generati "
                         f"(avg {sum(c.token_count for c in file_chunks) // max(len(file_chunks), 1)} token)")
        
        console.print(f"\n[green]✅ Totale: {len(all_chunks)} chunk da {len(md_files)} documenti[/green]")
        
        return all_chunks

    def save_chunks(self, chunks: list[Chunk], output_dir: Path | str) -> Path:
        """
        Salva i chunk in formato JSON per uso successivo.
        
        Args:
            chunks: Lista di chunk da salvare
            output_dir: Directory di output
            
        Returns:
            Path al file JSON salvato
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_dir / "chunks.json"
        
        # Converti in formato serializzabile
        chunks_data = []
        for chunk in chunks:
            chunks_data.append({
                "chunk_id": chunk.chunk_id,
                "text": chunk.text,
                "token_count": chunk.token_count,
                "metadata": {
                    "source": chunk.metadata.source,
                    "title": chunk.metadata.title,
                    "domain": chunk.metadata.domain,
                    "level": chunk.metadata.level,
                    "lang": chunk.metadata.lang,
                    "version": chunk.metadata.version,
                    "date": chunk.metadata.date,
                    "tags": chunk.metadata.tags,
                    "chunk_index": chunk.metadata.chunk_index,
                    "total_chunks": chunk.metadata.total_chunks,
                    "heading": chunk.metadata.heading,
                }
            })
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(chunks_data, f, ensure_ascii=False, indent=2)
        
        console.print(f"[green]💾 Chunk salvati in: {output_file}[/green]")
        return output_file

    @staticmethod
    def load_chunks(filepath: Path | str) -> list[dict]:
        """
        Carica chunk precedentemente salvati da file JSON.
        
        Args:
            filepath: Path al file chunks.json
            
        Returns:
            Lista di dict con chunk e metadati
        """
        filepath = Path(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
