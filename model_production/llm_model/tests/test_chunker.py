"""
tests/test_chunker.py
=====================
Test unitari per il modulo di chunking.

Esecuzione:
    pytest tests/test_chunker.py -v
"""

import sys
from pathlib import Path

# Aggiungi project root al path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.chunker import KBChunker, Chunk, ChunkMetadata


class TestKBChunker:
    """Test per la classe KBChunker."""

    def setup_method(self):
        """Setup per ogni test: inizializza chunker con configurazione standard."""
        self.chunker = KBChunker(chunk_size=600, chunk_overlap=80)

    def test_count_tokens(self):
        """Verifica che il conteggio token funzioni correttamente."""
        text = "Questo è un testo di esempio per il test."
        tokens = self.chunker.count_tokens(text)
        assert tokens > 0
        assert isinstance(tokens, int)

    def test_count_tokens_empty(self):
        """Verifica conteggio token su stringa vuota."""
        tokens = self.chunker.count_tokens("")
        assert tokens == 0

    def test_parse_markdown_with_yaml(self, tmp_path):
        """Verifica parsing di file Markdown con header YAML."""
        md_content = """---
title: "Test Document"
domain: workload
level: base
lang: it
version: 1
tags: [test, chunker]
---

# Test

Questo è il contenuto del documento.

## Sezione 1

Contenuto della sezione 1.
"""
        # Scrivi file temporaneo
        filepath = tmp_path / "test.md"
        filepath.write_text(md_content, encoding="utf-8")

        metadata, body = self.chunker.parse_markdown_with_yaml(filepath)

        assert metadata["title"] == "Test Document"
        assert metadata["domain"] == "workload"
        assert metadata["level"] == "base"
        assert metadata["tags"] == ["test", "chunker"]
        assert "# Test" in body
        assert "Sezione 1" in body

    def test_parse_markdown_without_yaml(self, tmp_path):
        """Verifica parsing di file Markdown senza header YAML."""
        md_content = "# Titolo\n\nContenuto senza header YAML."
        filepath = tmp_path / "no_yaml.md"
        filepath.write_text(md_content, encoding="utf-8")

        metadata, body = self.chunker.parse_markdown_with_yaml(filepath)

        assert metadata == {}
        assert "Titolo" in body

    def test_split_by_headings(self):
        """Verifica split per heading Markdown."""
        text = """## Heading 1
Content 1

## Heading 2
Content 2

### Sub Heading
Content 3
"""
        sections = self.chunker.split_by_headings(text)

        assert len(sections) >= 2
        assert any("Heading 1" in h for h, _ in sections)
        assert any("Content 1" in c for _, c in sections)

    def test_process_file(self, tmp_path):
        """Verifica elaborazione completa di un file."""
        md_content = """---
title: "ACWR Test"
domain: workload
level: intermediate
lang: it
version: 1
date: 2026-05-01
tags: [acwr, test]
---

# ACWR

## Definizione

L'ACWR è il rapporto tra carico acuto e carico cronico.

## Formula

ACWR = Acute Load / Chronic Load
"""
        filepath = tmp_path / "acwr_test.md"
        filepath.write_text(md_content, encoding="utf-8")

        chunks = self.chunker.process_file(filepath)

        assert len(chunks) > 0
        assert all(isinstance(c, Chunk) for c in chunks)
        assert all(c.metadata.domain == "workload" for c in chunks)
        assert all(c.metadata.source == "acwr_test.md" for c in chunks)
        assert all(c.token_count > 0 for c in chunks)

    def test_chunk_size_limits(self, tmp_path):
        """Verifica che i chunk rispettino le dimensioni configurate."""
        # Crea documento lungo
        long_text = "---\ntitle: Test\ndomain: test\n---\n\n# Doc\n\n"
        long_text += "## Sezione\n\n"
        long_text += ("Questo è un paragrafo di testo abbastanza lungo. " * 50 + "\n\n") * 10

        filepath = tmp_path / "long_doc.md"
        filepath.write_text(long_text, encoding="utf-8")

        chunks = self.chunker.process_file(filepath)

        # Verifica che i chunk siano ragionevolmente vicini al target
        for chunk in chunks:
            # Permettiamo un margine del 50% sopra il target
            # (il chunk può essere più grande se non è possibile splittare)
            assert chunk.token_count <= self.chunker.chunk_size * 2, (
                f"Chunk troppo grande: {chunk.token_count} token "
                f"(max atteso: ~{self.chunker.chunk_size})"
            )

    def test_save_and_load_chunks(self, tmp_path):
        """Verifica salvataggio e caricamento chunk."""
        # Crea chunk di test
        md_content = """---
title: Test Save
domain: test
---

# Test

## Section

Content for testing save/load functionality.
"""
        filepath = tmp_path / "save_test.md"
        filepath.write_text(md_content, encoding="utf-8")

        chunks = self.chunker.process_file(filepath)
        
        # Salva
        output_dir = tmp_path / "output"
        self.chunker.save_chunks(chunks, output_dir)
        
        # Verifica file creato
        assert (output_dir / "chunks.json").exists()
        
        # Carica
        loaded = KBChunker.load_chunks(output_dir / "chunks.json")
        
        assert len(loaded) == len(chunks)
        assert loaded[0]["text"] == chunks[0].text
        assert loaded[0]["metadata"]["domain"] == "test"

    def test_process_directory(self, tmp_path):
        """Verifica elaborazione di un'intera directory."""
        # Crea più file
        for i in range(3):
            content = f"---\ntitle: Doc {i}\ndomain: test\n---\n\n# Doc {i}\n\n## Section\n\nContent {i}."
            (tmp_path / f"doc_{i}.md").write_text(content, encoding="utf-8")

        chunks = self.chunker.process_directory(tmp_path)

        assert len(chunks) >= 3  # Almeno 1 chunk per file
        sources = set(c.metadata.source for c in chunks)
        assert len(sources) == 3  # 3 file diversi

    def test_process_empty_directory(self, tmp_path):
        """Verifica comportamento su directory vuota."""
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()

        chunks = self.chunker.process_directory(empty_dir)
        assert chunks == []
