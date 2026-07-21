"""
Pinecone vector database client wrapper.

Gestisce le operazioni di upsert, query e gestione degli indici su Pinecone.
"""

from typing import Optional, Any
import structlog
from pinecone import Pinecone, ServerlessSpec

from app.config import settings

logger = structlog.get_logger(__name__)


class PineconeClient:
    """
    Wrapper per il client Pinecone con operazioni di vector database.

    Gestisce l'inicializzazione, query e upsert dei vettori su Pinecone.
    """

    _instance: Optional["PineconeClient"] = None

    # Namespace predefiniti per l'organizzazione della knowledge base
    NAMESPACES = {
        "exercises": "Esercizi e movimenti atletici",
        "protocols": "Protocolli di allenamento",
        "periodization": "Pianificazione e periodizzazione",
        "references": "Riferimenti scientifici e studi",
    }

    def __new__(cls) -> "PineconeClient":
        """Implementa il pattern Singleton."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        """Inizializza il client Pinecone."""
        if self._initialized:
            return

        try:
            self.client = Pinecone(api_key=settings.pinecone_api_key)
            self.index_name = settings.pinecone_index_name

            # Ottieni l'indice
            self.index = self.client.Index(self.index_name)

            logger.info(
                "Pinecone client initialized",
                index_name=self.index_name,
            )
            self._initialized = True

        except Exception as e:
            logger.error("Failed to initialize Pinecone client", error=str(e))
            raise

    def upsert_vectors(
        self,
        vectors: list[tuple[str, list[float], dict]],
        namespace: str = "default",
    ) -> dict[str, Any]:
        """
        Upsert vettori nell'indice Pinecone.

        Args:
            vectors: Lista di tuple (id, embedding, metadata)
            namespace: Namespace dove salvare i vettori

        Returns:
            Risultato dell'operazione Pinecone

        Raises:
            ValueError: Se il namespace non è valido
            Exception: Errori di comunicazione con Pinecone
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

            # Upsert i vettori
            upsert_response = self.index.upsert(
                vectors=vectors,
                namespace=namespace,
            )

            logger.info(
                "Vectors upserted successfully",
                count=len(vectors),
                namespace=namespace,
            )

            return {"upserted_count": len(vectors), "response": upsert_response}

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
        Effettua una query vettoriale sull'indice.

        Args:
            embedding: Vettore di embedding per la query
            namespace: Namespace dove cercare
            top_k: Numero di risultati da ritornare
            filter_dict: Filtri facoltativi da applicare

        Returns:
            Lista di match con formato {"id": str, "score": float, "metadata": dict}

        Raises:
            Exception: Errori di comunicazione con Pinecone
        """
        try:
            logger.debug(
                "Querying vectors",
                namespace=namespace,
                top_k=top_k,
                filter_applied=filter_dict is not None,
            )

            response = self.index.query(
                vector=embedding,
                namespace=namespace,
                top_k=top_k,
                include_metadata=True,
                filter=filter_dict,
            )

            # Trasforma i risultati nel formato desiderato
            matches = [
                {
                    "id": match.id,
                    "score": float(match.score),
                    "metadata": match.metadata or {},
                }
                for match in response.matches
            ]

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
        Elimina vettori dall'indice.

        Args:
            ids: Lista di ID dei vettori da eliminare
            namespace: Namespace da cui eliminare

        Returns:
            Risultato dell'operazione di eliminazione

        Raises:
            Exception: Errori di comunicazione con Pinecone
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

            delete_response = self.index.delete(
                ids=ids,
                namespace=namespace,
            )

            logger.info(
                "Vectors deleted successfully",
                count=len(ids),
                namespace=namespace,
            )

            return {"deleted_count": len(ids), "response": delete_response}

        except Exception as e:
            logger.error(
                "Error deleting vectors",
                error=str(e),
                namespace=namespace,
            )
            raise

    def describe_index_stats(self) -> dict[str, Any]:
        """
        Ottiene statistiche dettagliate dell'indice.

        Returns:
            Statistiche dell'indice includeendo dimensioni per namespace

        Raises:
            Exception: Errori di comunicazione con Pinecone
        """
        try:
            logger.debug("Fetching index stats")

            stats = self.index.describe_index_stats()

            logger.debug("Index stats retrieved", response=stats)

            return stats

        except Exception as e:
            logger.error("Error fetching index stats", error=str(e))
            raise

    def fetch_vectors(
        self,
        ids: list[str],
        namespace: str = "default",
    ) -> dict[str, Any]:
        """
        Recupera vettori specifici per ID.

        Args:
            ids: Lista di ID dei vettori da recuperare
            namespace: Namespace da cui recuperare

        Returns:
            Dizionario con ID come chiave e vettori come valore

        Raises:
            Exception: Errori di comunicazione con Pinecone
        """
        if not ids:
            logger.warning("No IDs provided for fetch")
            return {}

        try:
            logger.debug(
                "Fetching vectors",
                count=len(ids),
                namespace=namespace,
            )

            response = self.index.fetch(
                ids=ids,
                namespace=namespace,
            )

            logger.debug(
                "Vectors fetched",
                count=len(response.get("vectors", {})),
                namespace=namespace,
            )

            return response

        except Exception as e:
            logger.error(
                "Error fetching vectors",
                error=str(e),
                namespace=namespace,
            )
            raise


# Istanza globale del client
_pinecone_client: Optional[PineconeClient] = None


def get_pinecone_client() -> PineconeClient:
    """
    Ottiene l'istanza globale del client Pinecone.

    Returns:
        Istanza del client Pinecone
    """
    global _pinecone_client
    if _pinecone_client is None:
        _pinecone_client = PineconeClient()
    return _pinecone_client
