"""
Verification script for TrainMind AI embeddings in ChromaDB.

Tests the generated embeddings with sample queries and verifies relevance.
"""

import argparse
import logging
import os
from pathlib import Path
from typing import List, Optional, Tuple

from openai import OpenAI
import chromadb
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(env_path)

# Configuration
EMBEDDING_MODEL = "text-embedding-3-small"
MAX_RETRIES = 3
BACKOFF_FACTOR = 1.5

# Test queries with expected result types
TEST_QUERIES = [
    {
        "query": "esercizi per forza quadricipiti",
        "expected_type": "exercise",
        "expected_keywords": ["Quadriceps", "Forza", "strength"],
        "description": "Strength exercises for quadriceps",
    },
    {
        "query": "protocollo prevenzione caviglia",
        "expected_type": "protocol",
        "expected_keywords": ["Caviglia", "ankle", "prevention"],
        "description": "Ankle prevention protocol",
    },
    {
        "query": "periodizzazione ondulata",
        "expected_type": "periodization",
        "expected_keywords": ["Periodizzazione", "DUP", "WUP", "ondulata"],
        "description": "Undulating periodization model",
    },
    {
        "query": "return to play dopo distorsione",
        "expected_type": "protocol",
        "expected_keywords": ["RTP", "distorsione", "injury", "return"],
        "description": "Return to play after ankle sprain",
    },
    {
        "query": "tabella percentuali 1RM",
        "expected_type": "reference",
        "expected_keywords": ["1RM", "percentuale", "ripetizioni"],
        "description": "1RM percentage conversion table",
    },
]


class EmbeddingVerifier:
    """Verifier for TrainMind AI embeddings in ChromaDB."""

    def __init__(self):
        """Initialize the verifier."""
        self.api_key_openai = os.getenv("OPENAI_API_KEY")
        self.chroma_persist_dir = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_data")
        self.collection_prefix = os.getenv("CHROMA_COLLECTION_PREFIX", "trainmind")

        if not self.api_key_openai:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        self.openai_client = OpenAI(api_key=self.api_key_openai)

        # Initialize ChromaDB client (v0.4+ API)
        self.chroma_client = chromadb.PersistentClient(
            path=self.chroma_persist_dir,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )

        self.results = {
            "passed": 0,
            "failed": 0,
            "queries": [],
        }

    def generate_embedding(self, text: str, retries: int = 0) -> List[float]:
        """
        Generate embedding for text.

        Args:
            text: Text to embed.
            retries: Current retry attempt.

        Returns:
            Embedding vector.
        """
        import time

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

    def print_collections_stats(self) -> None:
        """Print collections statistics."""
        logger.info("ChromaDB Collections Statistics:")
        try:
            collections = self.chroma_client.list_collections()

            for collection in collections:
                col_name = collection.name
                count = collection.count()
                logger.info(f"  Collection '{col_name}': {count} vectors")
        except Exception as e:
            logger.error(f"Failed to get collections stats: {e}")

    def test_query(
        self, query_text: str, collection_name: str, top_k: int = 3
    ) -> List[Tuple[str, float, dict]]:
        """
        Query the ChromaDB collection and return results.

        Args:
            query_text: Query text.
            collection_name: ChromaDB collection name.
            top_k: Number of top results to return.

        Returns:
            List of (id, score, metadata) tuples.
        """
        try:
            embedding = self.generate_embedding(query_text)
            collection = self.chroma_client.get_collection(name=collection_name)

            # Query the collection
            results = collection.query(
                query_embeddings=[embedding],
                n_results=top_k,
                include=["metadatas", "distances"],
            )

            output = []
            if results["ids"] and len(results["ids"]) > 0:
                for i, doc_id in enumerate(results["ids"][0]):
                    # ChromaDB returns distances; convert to score
                    distance = results["distances"][0][i]
                    score = 1 - distance  # For cosine distance

                    metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                    output.append((doc_id, score, metadata))

            return output
        except Exception as e:
            logger.error(f"Failed to query collection: {e}")
            return []

    def check_result_relevance(
        self,
        results: List[Tuple[str, float, dict]],
        expected_type: str,
        expected_keywords: List[str],
    ) -> Tuple[bool, str]:
        """
        Check if results are relevant based on type and keywords.

        Args:
            results: Query results.
            expected_type: Expected document type.
            expected_keywords: Expected keywords in results.

        Returns:
            (is_relevant, reason) tuple.
        """
        if not results:
            return False, "No results returned"

        # Check first result
        first_id, first_score, first_metadata = results[0]

        if first_score < 0.5:
            return False, f"Top score too low ({first_score:.3f})"

        doc_type = first_metadata.get("type", "unknown")
        if doc_type != expected_type:
            return False, f"Wrong type: got {doc_type}, expected {expected_type}"

        # Check for expected keywords in the ID or metadata
        id_and_metadata = str(first_id) + str(first_metadata).lower()
        found_keywords = [kw for kw in expected_keywords if kw.lower() in id_and_metadata]

        if not found_keywords:
            return (
                False,
                f"No expected keywords found (looking for: {expected_keywords})",
            )

        return True, f"Match on type {doc_type}, keywords: {found_keywords}"

    def run_tests(self) -> None:
        """Run all verification tests."""
        logger.info("Running embedding verification tests...\n")

        # Print collections stats first
        self.print_collections_stats()
        logger.info("")

        for test in TEST_QUERIES:
            logger.info(f"Test: {test['description']}")
            logger.info(f"  Query: {test['query']}")

            # Determine which collection to query based on expected type
            # Map types to collection names
            type_to_collection = {
                "exercise": f"{self.collection_prefix}_exercises",
                "protocol": f"{self.collection_prefix}_protocols",
                "periodization": f"{self.collection_prefix}_periodization",
                "reference": f"{self.collection_prefix}_references",
            }

            collection_name = type_to_collection.get(test["expected_type"])
            if not collection_name:
                logger.warning(f"Unknown collection for type {test['expected_type']}")
                self.results["failed"] += 1
                continue

            # Try to get the collection
            try:
                self.chroma_client.get_collection(name=collection_name)
            except Exception as e:
                logger.warning(f"Collection {collection_name} not found: {e}")
                self.results["failed"] += 1
                self.results["queries"].append(
                    {
                        "query": test["query"],
                        "description": test["description"],
                        "passed": False,
                        "reason": f"Collection not found: {collection_name}",
                    }
                )
                logger.info("")
                continue

            results = self.test_query(test["query"], collection_name)

            if not results:
                logger.warning("  No results returned!")
                self.results["failed"] += 1
                self.results["queries"].append(
                    {
                        "query": test["query"],
                        "description": test["description"],
                        "passed": False,
                        "reason": "No results",
                    }
                )
                logger.info("")
                continue

            is_relevant, reason = self.check_result_relevance(
                results,
                test["expected_type"],
                test["expected_keywords"],
            )

            # Log results
            for i, (doc_id, score, metadata) in enumerate(results):
                doc_type = metadata.get("type", "unknown")
                logger.info(
                    f"  Result {i + 1}: ID={doc_id}, Score={score:.4f}, Type={doc_type}"
                )
                if "name" in metadata:
                    logger.info(f"           Name={metadata['name']}")

            if is_relevant:
                logger.info(f"  PASS: {reason}")
                self.results["passed"] += 1
            else:
                logger.warning(f"  FAIL: {reason}")
                self.results["failed"] += 1

            self.results["queries"].append(
                {
                    "query": test["query"],
                    "description": test["description"],
                    "passed": is_relevant,
                    "reason": reason,
                }
            )
            logger.info("")

    def print_summary(self) -> None:
        """Print test summary."""
        passed = self.results["passed"]
        failed = self.results["failed"]
        total = passed + failed

        logger.info("=" * 60)
        logger.info("VERIFICATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total tests: {total}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {failed}")

        if total > 0:
            pass_rate = (passed / total) * 100
            logger.info(f"Pass rate: {pass_rate:.1f}%")

        logger.info("")
        logger.info("Details:")
        for query_result in self.results["queries"]:
            status = "PASS" if query_result["passed"] else "FAIL"
            logger.info(
                f"  [{status}] {query_result['description']}: {query_result['reason']}"
            )

        return failed == 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Verify TrainMind AI embeddings in ChromaDB")
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
        verifier = EmbeddingVerifier()
        verifier.run_tests()
        all_passed = verifier.print_summary()

        exit(0 if all_passed else 1)
    except Exception as e:
        logger.error(f"Verification failed: {e}", exc_info=True)
        exit(1)


if __name__ == "__main__":
    main()
