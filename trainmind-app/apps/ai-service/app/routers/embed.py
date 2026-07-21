"""
Endpoint per la creazione e gestione di embedding.

POST /ai/embed - Crea embedding e li upserta in Pinecone
GET /ai/embed/stats - Ottiene statistiche dell'indice Pinecone
"""

import uuid
import structlog
from fastapi import APIRouter, HTTPException
from openai import APIError

from app.models.schemas import EmbedRequest, EmbedResponse
from app.clients.openai_client import get_openai_client
from app.clients.vector_client import get_vector_client

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["embed"])


@router.post("/embed", response_model=EmbedResponse)
async def create_and_upsert_embeddings(request: EmbedRequest) -> EmbedResponse:
    """
    Crea embedding per un batch di testi e li upserta in Pinecone.

    Args:
        request: EmbedRequest con testi, namespace e metadata

    Returns:
        EmbedResponse con numero di embedding creati

    Raises:
        HTTPException: Errori durante la creazione degli embedding
    """
    try:
        if not request.texts:
            raise HTTPException(status_code=400, detail="Lista di testi vuota")

        if request.metadata and len(request.metadata) != len(request.texts):
            raise HTTPException(
                status_code=400,
                detail="Lunghezza di metadata e texts deve essere identica",
            )

        logger.info(
            "Embedding request received",
            text_count=len(request.texts),
            namespace=request.namespace,
        )

        openai_client = get_openai_client()
        vector_client = get_vector_client()

        # Crea gli embedding
        embeddings = openai_client.create_embeddings_batch(request.texts)

        logger.debug(
            "Embeddings created",
            count=len(embeddings),
            embedding_dimension=len(embeddings[0]) if embeddings else 0,
        )

        # Prepara i vettori per l'upsert
        vectors_to_upsert = []
        for i, (text, embedding) in enumerate(zip(request.texts, embeddings)):
            vector_id = str(uuid.uuid4())

            # Usa metadata fornito o crea uno default
            metadata = request.metadata[i] if request.metadata else {}
            if not metadata.get("title"):
                metadata["title"] = f"Documento {i + 1}"
            metadata["content"] = text
            metadata["source"] = "api_upload"

            vectors_to_upsert.append((vector_id, embedding, metadata))

        # Upserta i vettori in ChromaDB
        upsert_result = vector_client.upsert_vectors(
            vectors=vectors_to_upsert,
            namespace=request.namespace,
        )

        logger.info(
            "Embeddings upserted successfully",
            count=len(vectors_to_upsert),
            namespace=request.namespace,
        )

        return EmbedResponse(
            count=len(vectors_to_upsert),
            namespace=request.namespace,
            details=upsert_result,
        )

    except APIError as e:
        logger.error("OpenAI API error during embedding", error=str(e))
        raise HTTPException(status_code=503, detail="Errore nel servizio embedding")
    except Exception as e:
        logger.error("Error creating embeddings", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Errore nella creazione degli embedding")


@router.get("/embed/stats")
async def get_index_stats() -> dict:
    """
    Ottiene statistiche dettagliate dell'indice ChromaDB.

    Returns:
        Dizionario con statistiche dell'indice includeendo dimensioni per namespace

    Raises:
        HTTPException: Errori nel recupero delle statistiche
    """
    try:
        logger.info("Index stats request received")

        vector_client = get_vector_client()
        stats = vector_client.describe_index_stats()

        logger.debug("Index stats retrieved successfully")

        return {
            "status": "success",
            "stats": stats,
        }

    except Exception as e:
        logger.error("Error fetching index stats", error=str(e))
        raise HTTPException(status_code=500, detail="Errore nel recupero delle statistiche")
