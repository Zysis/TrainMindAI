"""
Utility script to clear collections from ChromaDB.

Can clear a specific collection or the entire database.
"""

import argparse
import logging
import os
from pathlib import Path

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


class IndexCleaner:
    """Utility to clear ChromaDB collections."""

    def __init__(self):
        """Initialize the cleaner."""
        self.chroma_persist_dir = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_data")
        self.collection_prefix = os.getenv("CHROMA_COLLECTION_PREFIX", "trainmind")

        # Initialize ChromaDB client (v0.4+ API)
        self.chroma_client = chromadb.PersistentClient(
            path=self.chroma_persist_dir,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )

    def get_collections_stats(self) -> dict:
        """Get current collections statistics."""
        try:
            stats = {}
            collections = self.chroma_client.list_collections()

            for collection in collections:
                stats[collection.name] = {
                    "vector_count": collection.count(),
                }

            return stats
        except Exception as e:
            logger.error(f"Failed to get collections stats: {e}")
            return {}

    def clear_collection(self, collection_name: str) -> None:
        """
        Clear all vectors from a specific collection.

        Args:
            collection_name: The collection to clear.
        """
        try:
            logger.info(f"Clearing collection '{collection_name}'...")

            # Delete the collection
            self.chroma_client.delete_collection(name=collection_name)

            logger.info(f"Successfully cleared collection '{collection_name}'")
        except Exception as e:
            logger.error(f"Failed to clear collection '{collection_name}': {e}")
            raise

    def clear_entire_database(self) -> None:
        """Clear all collections from the entire database."""
        try:
            logger.info("Clearing entire ChromaDB database...")
            logger.warning("This will delete ALL collections from the database!")

            # Get all collections
            collections = self.chroma_client.list_collections()

            if not collections:
                logger.info("Database is already empty")
                return

            for collection in collections:
                logger.info(f"  Deleting collection '{collection.name}'...")
                self.chroma_client.delete_collection(name=collection.name)

            logger.info("Successfully cleared entire database")
        except Exception as e:
            logger.error(f"Failed to clear entire database: {e}")
            raise

    def print_stats_before_and_after(self, collection_name: str = None) -> None:
        """
        Print statistics before clearing.

        Args:
            collection_name: Optional collection name to focus on.
        """
        stats_before = self.get_collections_stats()

        logger.info("\nCollections Stats Before:")
        self._print_stats(stats_before, collection_name)

    def _print_stats(self, stats: dict, collection_name: str = None) -> None:
        """
        Print formatted stats.

        Args:
            stats: Stats dictionary.
            collection_name: Optional collection to focus on.
        """
        logger.info(f"  Persist directory: {self.chroma_persist_dir}")

        if not stats:
            logger.info("  No collections found")
            return

        for col_name, col_info in stats.items():
            if collection_name and col_name != collection_name:
                continue
            vector_count = col_info.get("vector_count", 0)
            logger.info(f"    Collection '{col_name}': {vector_count} vectors")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Clear collections from ChromaDB")
    parser.add_argument(
        "--collection",
        type=str,
        help="Clear specific collection (default: entire database)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompt",
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
        cleaner = IndexCleaner()

        # Print stats before
        if args.collection:
            cleaner.print_stats_before_and_after(args.collection)
        else:
            cleaner.print_stats_before_and_after()

        # Confirmation prompt if not forced
        if not args.force:
            if args.collection:
                prompt = f"Are you sure you want to clear collection '{args.collection}'? (yes/no): "
            else:
                prompt = "Are you sure you want to clear the ENTIRE database? (yes/no): "

            response = input(prompt).strip().lower()
            if response != "yes":
                logger.info("Cancelled")
                return

        # Clear
        if args.collection:
            cleaner.clear_collection(args.collection)
        else:
            cleaner.clear_entire_database()

        # Print stats after
        stats_after = cleaner.get_collections_stats()
        logger.info("\nCollections Stats After:")
        cleaner._print_stats(stats_after, args.collection)

        logger.info("Done!")

    except Exception as e:
        logger.error(f"Operation failed: {e}", exc_info=True)
        exit(1)


if __name__ == "__main__":
    main()
