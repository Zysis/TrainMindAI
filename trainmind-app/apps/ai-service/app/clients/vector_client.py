"""
ChromaDB vector database client wrapper.

Gestisce le operazioni di upsert, query e gestione delle collezioni su ChromaDB locale.
"""

from typing import Optional, Any
import os
import structlog
import chromadb

from app.config import settings

logger = structlog.get_logger(__name__)


class VectorClient:
    """
    Wrapper per il client ChromaDB con operazioni di vector database.

    Gestisce l'inicializzazione, query e upsert dei vettori su ChromaDB.
    Usa collezioni distinte per ogni namespace (es. trainmind_exercises, trainmind_protocols).
    Compatibile con ChromaDB >= 0.4.0 (API PersistentClient).
    """

    _instance: Optional["VectorClient"] = None

    # Namespace predefiniti per l'organizzazione della knowledge base
    NAMESPACES = {
        "exercises",
        "protocols",
        "periodization",
        "references",
    }

    def __new__(cls) -> "VectorClient":
        """Implementa il pattern Singleton."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        """Inizializza il client ChromaDB."""
        if self._initialized:
            return

        try:
            persist_dir = settings.chroma_persist_directory

            # Crea la directory di persistenza se non esiste
            os.makedirs(persist_dir, exist_ok=True)

            # ChromaDB >= 0.4.0: usa PersistentClient per persistenza locale
            self.client = chromadb.PersistentClient(
                path=persist_dir,
                settings=chromadb.Settings(
                    anonymized_telemetry=False,
                ),
            )
            self.collection_prefix = settings.chroma_collection_prefix

            logger.info(
                "ChromaDB client initialized",
                persist_directory=persist_dir,
                collection_prefix=self.collection_prefix,
            )
            self._initialized = True

        except Exception as e:
            logger.error("Failed to initialize ChromaDB client", error=str(e))
            raise

    def _get_collection_name(self, namespace: str) -> str:
        """
        Genera il nome della collezione da un namespace.

        Args:
            namespace: Nome del namespace

        Returns:
            Nome della collezione con prefisso (es. trainmind_exercises)
        """
        return f"{self.collection_prefix}_{namespace}"

    def _get_or_create_collection(self, namespace: str):
        """
        Ottiene o crea una collezione per un namespace.

        Args:
            namespace: Nome del namespace

        Returns:
            Collezione ChromaDB
        """
        collection_name = self._get_collection_name(namespace)

        try:
            # ChromaDB con cosine distance per consistenza con i modelli di embedding
            collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            return collection
        except Exception as e:
            logger.error(
                "Failed to get or create collection",
                collection_name=collection_name,
                error=str(e),
            )
            raise

    def upsert_vectors(
        self,
        vectors: list[tuple[str, list[float], dict]],
        namespace: str = "default",
    ) -> dict[str, Any]:
        """
        Upsert vettori in una collezione ChromaDB.

        Args:
            vectors: Lista di tuple (id, embedding, metadata)
            namespace: Namespace dove salvare i vettori

        Returns:
            Risultato dell'operazione

        Raises:
            ValueError: Se il namespace non è valido
            Exception: Errori di comunicazione con ChromaDB
        """
        if not vectors:
            logger.warning("No vectors to upsert")
            return {"upserted_count": 0}

        try:
            logger.debug(
                "Upserting vectors",
                count=len(vectors),
                namespace=namespace,
            )

            collection = self._get_or_create_collection(namespace)

            # Prepara i dati per ChromaDB
            ids = []
            embeddings = []
            metadatas = []
            documents = []

            for vec_id, embedding, metadata in vectors:
                ids.append(vec_id)
                embeddings.append(embedding)
                metadatas.append(metadata)
                # ChromaDB richiede documenti (testo) per ogni embedding
                documents.append(metadata.get("content", metadata.get("title", "")))

            # Upsert in ChromaDB
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents,
            )

            logger.info(
                "Vectors upserted successfully",
                count=len(vectors),
                namespace=namespace,
            )

            return {"upserted_count": len(vectors)}

        except Exception as e:
            logger.error(
                "Error upserting vectors",
                error=str(e),
                namespace=namespace,
            )
            raise

    def query_vectors(
        self,
        embedding: list[float],
        namespace: str = "default",
        top_k: int = 10,
        filter_dict: Optional[dict] = None,
    ) -> list[dict[str, Any]]:
        """
        Effettua una query vettoriale su una collezione.

        Args:
            embedding: Vettore di embedding per la query
            namespace: Namespace dove cercare
            top_k: Numero di risultati da ritornare
            filter_dict: Filtri facoltativi da applicare (formato ChromaDB where)

        Returns:
            Lista di match con formato {"id": str, "score": float, "metadata": dict}

        Raises:
            Exception: Errori di comunicazione con ChromaDB
        """
        try:
            logger.debug(
                "Querying vectors",
                namespace=namespace,
                top_k=top_k,
                filter_applied=filter_dict is not None,
            )

            collection = self._get_or_create_collection(namespace)

            # ChromaDB restituisce distanze, non score
            # Convertiamo usando score = 1 / (1 + distance) per cosine
            response = collection.query(
                query_embeddings=[embedding],
                n_results=top_k,
                where=filter_dict if filter_dict else None,
                include=["embeddings", "metadatas", "distances", "documents"],
            )

            # Trasforma i risultati nel formato desiderato
            matches = []
            if response["ids"] and len(response["ids"]) > 0:
                for i, doc_id in enumerate(response["ids"][0]):
                    # ChromaDB restituisce distanze (cosine: 0-2, 0 = identico)
                    distance = response["distances"][0][i]
                    # Converti a score: per cosine, score = 1 - distance
                    score = 1 - distance

                    metadata = response["metadatas"][0][i] if response["metadatas"] else {}

                    matches.append({
                        "id": doc_id,
                        "score": float(score),
                        "metadata": metadata or {},
                    })

            logger.debug(
                "Query completed",
                namespace=namespace,
                matches_returned=len(matches),
            )

            return matches

        except Exception as e:
            logger.error(
                "Error querying vectors",
                error=str(e),
                namespace=namespace,
            )
            raise

    def delete_vectors(
        self,
        ids: list[str],
        namespace: str = "default",
    ) -> dict[str, Any]:
        """
        Elimina vettori da una collezione.

        Args:
            ids: Lista di ID dei vettori da eliminare
            namespace: Namespace da cui eliminare

        Returns:
            Risultato dell'operazione di eliminazione

        Raises:
            Exception: Errori di comunicazione con ChromaDB
        """
        if not ids:
            logger.warning("No vectors to delete")
            return {"deleted_count": 0}

        try:
            logger.debug(
                "Deleting vectors",
                count=len(ids),
                namespace=namespace,
            )

            collection = self._get_or_create_collection(namespace)
            collection.delete(ids=ids)

            logger.info(
                "Vectors deleted successfully",
                count=len(ids),
                namespace=namespace,
            )

            return {"deleted_count": len(ids)}

        except Exception as e:
            logger.error(
                "Error deleting vectors",
                error=str(e),
                namespace=namespace,
            )
            raise

    def describe_index_stats(self) -> dict[str, Any]:
        """
        Ottiene statistiche dettagliate per tutte le collezioni.

        Returns:
            Statistiche delle collezioni

        Raises:
            Exception: Errori di comunicazione con ChromaDB
        """
        try:
            logger.debug("Fetching index stats")

            stats = {
                "collections": {},
                "persist_directory": settings.chroma_persist_directory,
            }

            # Itera su tutti i namespace e conta i vettori in ogni collezione
            for namespace in self.NAMESPACES:
                try:
                    collection = self._get_or_create_collection(namespace)
                    count = collection.count()
                    stats["collections"][namespace] = {
                        "vector_count": count,
                    }
                except Exception as e:
                    logger.warning(
                        "Failed to get stats for namespace",
                        namespace=namespace,
                        error=str(e),
                    )
                    stats["collections"][namespace] = {
                        "vector_count": 0,
                        "error": str(e),
                    }

            logger.debug("Index stats retrieved", stats=stats)
            return stats

        except Exception as e:
            logger.error("Error fetching index stats", error=str(e))
            raise

    def reset_namespace(self, namespace: str) -> None:
        """
        Elimina e ricrea una collezione (reset completo).

        Args:
            namespace: Namespace da resettare

        Raises:
            Exception: Errori di comunicazione con ChromaDB
        """
        try:
            logger.info(
                "Resetting namespace",
                namespace=namespace,
            )

            collection_name = self._get_collection_name(namespace)

            # Elimina la collezione
            self.client.delete_collection(name=collection_name)

            logger.info(
                "Namespace reset successfully",
                namespace=namespace,
            )

        except Exception as e:
            logger.error(
                "Error resetting namespace",
                error=str(e),
                namespace=namespace,
            )
            raise


# Istanza globale del client
_vector_client: Optional[VectorClient] = None


def get_vector_client() -> VectorClient:
    """
    Ottiene l'istanza globale del client ChromaDB.

    Returns:
        Istanza del client VectorClient
    """
    global _vector_client
    if _vector_client is None:
        _vector_client = VectorClient()
    return _vector_client
