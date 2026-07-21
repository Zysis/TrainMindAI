"""
Embedding pipeline script for TrainMind AI knowledge base.

Reads JSON files from the seed directory and generates embeddings to upsert into ChromaDB.
Handles exercises, periodization models, prevention protocols, RTP protocols, and reference tables.
"""

import argparse
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI
import chromadb
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables from the ai-service root .env
env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(env_path)

# Configuration
SEED_DIR = Path(__file__).parent.parent.parent.parent / "seed"
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536
BATCH_SIZE = 100
BACKOFF_FACTOR = 1.5
MAX_RETRIES = 3

# Namespaces for different document types
NAMESPACES = {
    "exercises": "exercises",
    "periodization": "periodization",
    "prevention": "protocols",
    "rtp": "protocols",
    "references": "references",
}


class EmbeddingPipeline:
    """Main embedding pipeline for TrainMind knowledge base using ChromaDB."""

    def __init__(self, dry_run: bool = False):
        """
        Initialize the embedding pipeline.

        Args:
            dry_run: If True, logs operations without actually upserting to ChromaDB.
        """
        self.dry_run = dry_run
        self.api_key_openai = os.getenv("OPENAI_API_KEY")
        self.chroma_persist_dir = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_data")
        self.collection_prefix = os.getenv("CHROMA_COLLECTION_PREFIX", "trainmind")

        if not self.api_key_openai:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        self.openai_client = OpenAI(api_key=self.api_key_openai)

        if not self.dry_run:
            # Initialize ChromaDB with persistent storage (v0.4+ API)
            os.makedirs(self.chroma_persist_dir, exist_ok=True)
            self.chroma_client = chromadb.PersistentClient(
                path=self.chroma_persist_dir,
                settings=chromadb.Settings(anonymized_telemetry=False),
            )
        else:
            self.chroma_client = None

        self.total_documents = 0
        self.total_vectors = 0

    def load_json_file(self, filepath: Path) -> Any:
        """
        Load JSON file with error handling.

        Args:
            filepath: Path to the JSON file.

        Returns:
            Parsed JSON content.

        Raises:
            FileNotFoundError: If the file doesn't exist.
            json.JSONDecodeError: If the file is not valid JSON.
        """
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"File not found: {filepath}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {filepath}: {e}")
            raise

    def generate_embedding(self, text: str, retries: int = 0) -> List[float]:
        """
        Generate embedding for text using OpenAI API with exponential backoff.

        Args:
            text: Text to embed.
            retries: Current retry attempt.

        Returns:
            Embedding vector.

        Raises:
            Exception: If all retries are exhausted.
        """
        try:
            response = self.openai_client.embeddings.create(
                input=text,
                model=EMBEDDING_MODEL,
            )
            return response.data[0].embedding
        except Exception as e:
            if retries < MAX_RETRIES:
                wait_time = (BACKOFF_FACTOR ** retries) * 2
                logger.warning(f"API error, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
                return self.generate_embedding(text, retries + 1)
            else:
                logger.error(f"Failed to generate embedding after {MAX_RETRIES} retries: {e}")
                raise

    def format_exercise_text(self, exercise: Dict[str, Any]) -> str:
        """
        Format exercise data for embedding.

        Args:
            exercise: Exercise dictionary.

        Returns:
            Formatted text for embedding.
        """
        load_params = exercise.get("loadParameters", {})
        variants = ", ".join(exercise.get("variants", []))
        contraindications = ", ".join(exercise.get("contraindications", []))
        muscle_groups = ", ".join(exercise.get("muscleGroups", []))
        equipment = ", ".join(exercise.get("equipment", []))

        text = f"""Nome: {exercise.get('name')} ({exercise.get('nameEN')})
Categoria: {exercise.get('category')}
Descrizione: {exercise.get('description')}
Muscoli target: {muscle_groups}
Attrezzatura: {equipment}
Pattern di movimento: {exercise.get('movementPattern')}
Difficoltà: {exercise.get('difficulty')}
Controindicazioni: {contraindications}
Varianti: {variants}
Parametri: {load_params.get('sets')} serie x {load_params.get('reps')} reps, riposo {load_params.get('rest')}, intensità {load_params.get('intensity')}"""
        return text

    def format_protocol_text(self, protocol: Dict[str, Any]) -> str:
        """
        Format protocol data for embedding.

        Args:
            protocol: Protocol dictionary (prevention or RTP).

        Returns:
            Formatted text for embedding.
        """
        exercises = protocol.get("exercises", [])
        exercises_text = ""
        if exercises:
            if isinstance(exercises[0], dict):
                exercises_names = [ex.get("name", "") for ex in exercises]
            else:
                exercises_names = exercises
            exercises_text = "\nEsercizi: " + ", ".join(exercises_names)

        phases = protocol.get("phases", [])
        phases_text = ""
        if phases:
            phases_list = []
            for phase in phases:
                phase_name = phase.get("name") or phase.get("phase", "")
                phase_desc = phase.get("description", "")
                phases_list.append(f"- {phase_name}: {phase_desc}")
            phases_text = "\nFasi: " + "\n".join(phases_list)

        text = f"""{protocol.get('name')}
{protocol.get('description')}{exercises_text}{phases_text}"""
        return text

    def format_periodization_text(self, model: Dict[str, Any]) -> str:
        """
        Format periodization model data for embedding.

        Args:
            model: Periodization model dictionary.

        Returns:
            Formatted text for embedding.
        """
        phases = model.get("phases", [])
        phases_text = ""
        if phases:
            phases_list = []
            for phase in phases:
                name = phase.get("name", "")
                focus = phase.get("focus", "")
                duration = phase.get("duration", "")
                phases_list.append(f"- {name} ({duration}): {focus}")
            phases_text = "\nFasi: " + "\n".join(phases_list)

        suitable_for = ", ".join(model.get("suitableFor", []))

        text = f"""{model.get('name')} ({model.get('nameEN')})
{model.get('description')}{phases_text}
Adatta a: {suitable_for}"""
        return text

    def format_reference_text(self, table_name: str, table_data: Dict[str, Any]) -> str:
        """
        Format reference table data for embedding.

        Args:
            table_name: Name of the reference table.
            table_data: Table data dictionary.

        Returns:
            Formatted text for embedding.
        """
        description = table_data.get("description", "")
        text = f"""Tabella di Riferimento: {table_name}
{description}"""
        return text

    def extract_exercises(self) -> List[Tuple[str, str, Dict[str, Any]]]:
        """
        Extract and format exercises from exercises.json.

        Returns:
            List of (id, text, metadata) tuples.
        """
        logger.info("Extracting exercises...")
        exercises_file = SEED_DIR / "exercises.json"
        exercises = self.load_json_file(exercises_file)

        documents = []
        for i, exercise in enumerate(exercises):
            doc_id = f"exercise-{i:03d}"
            text = self.format_exercise_text(exercise)
            metadata = {
                "type": "exercise",
                "category": exercise.get("category", "unknown"),
                "difficulty": exercise.get("difficulty", "unknown"),
                "name": exercise.get("name", ""),
            }
            documents.append((doc_id, text, metadata))

        logger.info(f"Extracted {len(documents)} exercises")
        return documents

    def extract_prevention_protocols(self) -> List[Tuple[str, str, Dict[str, Any]]]:
        """
        Extract and format prevention protocols.

        Returns:
            List of (id, text, metadata) tuples.
        """
        logger.info("Extracting prevention protocols...")
        protocols_file = SEED_DIR / "prevention-protocols.json"
        protocols = self.load_json_file(protocols_file)

        documents = []
        for i, protocol in enumerate(protocols):
            doc_id = f"prevention-{i:03d}"
            text = self.format_protocol_text(protocol)
            metadata = {
                "type": "protocol",
                "protocol_type": "prevention",
                "bodyArea": protocol.get("bodyArea", "unknown"),
                "name": protocol.get("name", ""),
            }
            documents.append((doc_id, text, metadata))

        logger.info(f"Extracted {len(documents)} prevention protocols")
        return documents

    def extract_rtp_protocols(self) -> List[Tuple[str, str, Dict[str, Any]]]:
        """
        Extract and format RTP protocols.

        Returns:
            List of (id, text, metadata) tuples.
        """
        logger.info("Extracting RTP protocols...")
        rtp_file = SEED_DIR / "rtp-protocols.json"
        protocols = self.load_json_file(rtp_file)

        documents = []
        for i, protocol in enumerate(protocols):
            doc_id = f"rtp-{i:03d}"
            text = self.format_protocol_text(protocol)
            metadata = {
                "type": "protocol",
                "protocol_type": "rtp",
                "injuryType": protocol.get("injuryType", "unknown"),
                "name": protocol.get("name", ""),
            }
            documents.append((doc_id, text, metadata))

        logger.info(f"Extracted {len(documents)} RTP protocols")
        return documents

    def extract_periodization_models(self) -> List[Tuple[str, str, Dict[str, Any]]]:
        """
        Extract and format periodization models.

        Returns:
            List of (id, text, metadata) tuples.
        """
        logger.info("Extracting periodization models...")
        perio_file = SEED_DIR / "periodization-models.json"
        models = self.load_json_file(perio_file)

        documents = []
        for i, model in enumerate(models):
            doc_id = f"periodization-{i:03d}"
            text = self.format_periodization_text(model)
            metadata = {
                "type": "periodization",
                "name": model.get("name", ""),
            }
            documents.append((doc_id, text, metadata))

        logger.info(f"Extracted {len(documents)} periodization models")
        return documents

    def extract_reference_tables(self) -> List[Tuple[str, str, Dict[str, Any]]]:
        """
        Extract and format reference tables.

        Returns:
            List of (id, text, metadata) tuples.
        """
        logger.info("Extracting reference tables...")
        ref_file = SEED_DIR / "reference-tables.json"
        tables = self.load_json_file(ref_file)

        documents = []
        table_idx = 0

        # Handle both dict and list formats
        if isinstance(tables, dict):
            for table_name, table_data in tables.items():
                if isinstance(table_data, dict):
                    doc_id = f"reference-{table_idx:03d}"
                    text = self.format_reference_text(table_name, table_data)
                    metadata = {
                        "type": "reference",
                        "table_name": table_name,
                    }
                    documents.append((doc_id, text, metadata))
                    table_idx += 1
        elif isinstance(tables, list):
            for table_data in tables:
                doc_id = f"reference-{table_idx:03d}"
                table_name = table_data.get("name", f"Table {table_idx}")
                text = self.format_reference_text(table_name, table_data)
                metadata = {
                    "type": "reference",
                    "table_name": table_name,
                }
                documents.append((doc_id, text, metadata))
                table_idx += 1

        logger.info(f"Extracted {len(documents)} reference tables")
        return documents

    def upsert_batch(
        self,
        vectors: List[Tuple[str, List[float], Dict[str, Any]]],
        namespace: str,
    ) -> None:
        """
        Upsert a batch of vectors to ChromaDB.

        Args:
            vectors: List of (id, embedding, metadata) tuples.
            namespace: ChromaDB collection namespace.
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would upsert {len(vectors)} vectors to collection '{namespace}'")
            for vec_id, embedding, metadata in vectors:
                logger.debug(f"  ID: {vec_id}, Metadata: {metadata}")
            return

        try:
            collection_name = f"{self.collection_prefix}_{namespace}"

            # Get or create collection
            collection = self.chroma_client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
            )

            # Prepare data for ChromaDB
            ids = []
            embeddings = []
            metadatas = []
            documents = []

            for vec_id, embedding, metadata in vectors:
                ids.append(vec_id)
                embeddings.append(embedding)
                metadatas.append(metadata)
                documents.append(metadata.get("content", metadata.get("name", metadata.get("table_name", ""))))

            # Upsert to collection
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents,
            )

            logger.info(f"Upserted {len(vectors)} vectors to collection '{namespace}'")
        except Exception as e:
            logger.error(f"Failed to upsert batch to collection '{namespace}': {e}")
            raise

    def process_documents(
        self,
        documents: List[Tuple[str, str, Dict[str, Any]]],
        namespace: str,
    ) -> int:
        """
        Process documents: generate embeddings and upsert to ChromaDB.

        Args:
            documents: List of (id, text, metadata) tuples.
            namespace: ChromaDB collection namespace.

        Returns:
            Number of vectors upserted.
        """
        vectors_upserted = 0

        # Process in batches
        for batch_start in range(0, len(documents), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(documents))
            batch = documents[batch_start:batch_end]

            logger.info(
                f"Processing batch {batch_start // BATCH_SIZE + 1} "
                f"(documents {batch_start}-{batch_end}) for collection '{namespace}'"
            )

            vectors = []
            for doc_id, text, metadata in batch:
                try:
                    embedding = self.generate_embedding(text)
                    # Store original text in metadata for ChromaDB
                    metadata_with_content = metadata.copy()
                    metadata_with_content["content"] = text
                    vectors.append((doc_id, embedding, metadata_with_content))
                except Exception as e:
                    logger.error(f"Failed to generate embedding for {doc_id}: {e}")
                    continue

            if vectors:
                self.upsert_batch(vectors, namespace)
                vectors_upserted += len(vectors)

        return vectors_upserted

    def run(self, namespace: Optional[str] = None) -> None:
        """
        Run the complete embedding pipeline.

        Args:
            namespace: If specified, only process this namespace.
                      Options: 'exercises', 'periodization', 'protocols', 'references'.
        """
        logger.info(f"Starting embedding pipeline (dry_run={self.dry_run})")
        logger.info(f"Seed directory: {SEED_DIR}")
        logger.info(f"ChromaDB persist directory: {self.chroma_persist_dir}")

        namespaces_to_process = {}

        # Extract all documents if no specific namespace is requested
        if not namespace or namespace == "exercises":
            namespaces_to_process["exercises"] = self.extract_exercises()

        if not namespace or namespace == "periodization":
            namespaces_to_process["periodization"] = self.extract_periodization_models()

        if not namespace or namespace in ["protocols", "prevention"]:
            namespaces_to_process["protocols"] = (
                self.extract_prevention_protocols() + self.extract_rtp_protocols()
            )

        if not namespace or namespace == "references":
            namespaces_to_process["references"] = self.extract_reference_tables()

        # Process each namespace
        for ns, documents in namespaces_to_process.items():
            self.total_documents += len(documents)
            vectors_count = self.process_documents(documents, ns)
            self.total_vectors += vectors_count

        logger.info(f"Pipeline complete: {self.total_documents} documents, {self.total_vectors} vectors upserted")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Embedding pipeline for TrainMind AI knowledge base (ChromaDB)"
    )
    parser.add_argument(
        "--namespace",
        type=str,
        choices=["exercises", "periodization", "protocols", "references"],
        help="Process only a specific namespace (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log operations without actually upserting to ChromaDB",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )

    args = parser.parse_args()

    logger.setLevel(args.log_level)

    try:
        pipeline = EmbeddingPipeline(dry_run=args.dry_run)
        pipeline.run(namespace=args.namespace)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        exit(1)


if __name__ == "__main__":
    main()
