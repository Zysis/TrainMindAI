"""
Endpoint per chat RAG-enhanced.

POST /ai/chat - Interazione conversazionale con supporto RAG
Supporta sia risposte complete che streaming SSE.

Sprint 2.2: Proper message history handling, system prompt injection,
athlete context, conversation memory preservation.
"""

import json
import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openai import APIError

from app.models.schemas import ChatRequest, ChatResponse, UsageInfo
from app.services.rag import get_rag_service
from app.services.context_builder import get_context_builder
from app.services.prompts import SYSTEM_PROMPT_CHAT
from app.clients.openai_client import get_openai_client

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["chat"])


async def generate_sse_stream(
    messages: list[dict],
    sources: list,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    model: str | None = None,
):
    """
    Genera una risposta in streaming SSE.

    Args:
        messages: Messaggi nel formato OpenAI
        sources: Lista di Source objects
        temperature: Temperatura del modello
        max_tokens: Max token nella risposta
        model: Override del modello (arriva da apps/api)

    Yields:
        String in formato SSE
    """
    openai_client = get_openai_client()

    try:
        content_buffer = ""
        usage_sink: dict = {}
        for chunk in openai_client.chat_completion_stream(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            usage_sink=usage_sink,
        ):
            content_buffer += chunk
            yield f"data: {json.dumps({'type': 'content', 'chunk': chunk})}\n\n"

        # Consumo token: emesso prima di 'done' così apps/api lo intercetta
        # mentre fa da pipe verso il browser. Il frontend ignora i tipi
        # che non conosce, quindi non serve modificarlo.
        if usage_sink:
            yield f"data: {json.dumps({'type': 'usage', 'usage': usage_sink})}\n\n"

        # Invia le fonti alla fine
        if sources:
            sources_json = json.dumps(
                {
                    "type": "sources",
                    "sources": [
                        {
                            "id": s.id,
                            "title": s.title,
                            "category": s.category,
                            "score": s.score,
                        }
                        for s in sources
                    ],
                }
            )
            yield f"data: {sources_json}\n\n"

        # Invia il contenuto completo
        yield f"data: {json.dumps({'type': 'done', 'full_content': content_buffer})}\n\n"

    except APIError as e:
        logger.error("OpenAI API error during streaming", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': 'Errore nel servizio LLM'})}\n\n"
    except Exception as e:
        logger.error("Error in streaming", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': 'Errore interno del server'})}\n\n"


@router.post("/chat")
async def chat_with_rag(request: ChatRequest):
    """
    Endpoint di chat RAG-enhanced con supporto per streaming.

    Sprint 2.2 improvements:
    - System prompt come messaggio separato (non iniettato nel user message)
    - History preservata correttamente
    - Contesto RAG iniettato nell'ultimo user message senza sovrascrivere
    - Athlete context integration

    Args:
        request: ChatRequest con messaggi, configurazione stream, etc.

    Returns:
        ChatResponse (non-streaming) oppure StreamingResponse (streaming)
    """
    try:
        logger.info(
            "Chat request received",
            num_messages=len(request.messages),
            stream=request.stream,
            has_athlete_id=request.athlete_id is not None,
        )

        # Estrai l'ultima domanda dell'utente
        user_query = ""
        for msg in reversed(request.messages):
            if msg.role == "user":
                user_query = msg.content
                break

        if not user_query:
            raise HTTPException(status_code=400, detail="Nessun messaggio dell'utente trovato")

        rag_service = get_rag_service()
        context_builder = get_context_builder()

        # Recupera contesto combinato (atleta + KB)
        combined = await context_builder.build_combined_context(
            query=user_query,
            athlete_id=request.athlete_id,
            namespaces=request.namespaces,
            top_k=request.top_k,
        )

        sources = combined.get("sources", [])
        matches = combined.get("matches", [])
        athlete_context = combined.get("athlete_context")

        logger.debug(
            "Chat context retrieved",
            sources_count=len(sources),
            has_athlete_context=athlete_context is not None,
        )

        # Converti i messaggi history al formato dict
        history_dicts = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]

        # Costruisci i messaggi con gestione corretta della history
        openai_messages = rag_service.build_messages(
            system_prompt=SYSTEM_PROMPT_CHAT,
            context_docs=matches,
            user_query=user_query,
            history=history_dicts,
            athlete_context=athlete_context,
        )

        # Gestisci streaming
        if request.stream:
            logger.debug("Chat streaming response")

            return StreamingResponse(
                generate_sse_stream(
                    messages=openai_messages,
                    sources=sources,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    model=request.model,
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        # Risposta non-streaming
        logger.debug("Chat non-streaming response")
        openai_client = get_openai_client()

        llm_result = openai_client.chat_completion_full(
            messages=openai_messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        response_content = llm_result.content

        logger.info(
            "Chat completed successfully",
            response_length=len(response_content),
            sources_count=len(sources),
            model=llm_result.model,
            total_tokens=llm_result.total_tokens,
        )

        return ChatResponse(
            content=response_content,
            sources=sources,
            finish_reason="stop",
            usage=UsageInfo(**llm_result.as_usage_dict()),
        )

    except APIError as e:
        logger.error("OpenAI API error in chat", error=str(e))
        raise HTTPException(status_code=503, detail="Errore nel servizio LLM")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in chat endpoint", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Errore nell'interazione chat")
