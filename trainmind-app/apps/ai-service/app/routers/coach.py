"""
Endpoint per consulenze da coach IA.

POST /ai/coach - Fornisce consulenze su allenamento, form, recupero, etc.

Sprint 2.2: Athlete context integration, configurable params,
proper system/user message separation, enhanced error handling.
"""

import structlog
from fastapi import APIRouter, HTTPException
from openai import APIError

from app.models.schemas import CoachRequest, CoachResponse, UsageInfo
from app.services.rag import get_rag_service
from app.services.context_builder import get_context_builder
from app.services.prompts import SYSTEM_PROMPT_COACH
from app.clients.openai_client import get_openai_client
from app.services.cache import cache_get, cache_set, build_response_cache_key

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["coach"])


@router.post("/coach", response_model=CoachResponse)
async def coach_consultation(request: CoachRequest) -> CoachResponse:
    """
    Fornisce una consulenza da parte di un coach IA esperto.

    Utilizza RAG per recuperare documentazione rilevante e il contesto
    atleta (se fornito) prima di generare una risposta personalizzata.

    Args:
        request: CoachRequest con domanda e configurazione

    Returns:
        CoachResponse con risposta, fonti e riferimenti
    """
    try:
        logger.info(
            "Coach consultation request received",
            category=request.category,
            has_athlete_id=request.athlete_id is not None,
        )

        # Check cache
        cache_key = build_response_cache_key(
            request.question,
            namespaces=request.namespaces,
            athlete_id=request.athlete_id,
            model=request.model,
        )
        cached = cache_get("response", cache_key)
        if cached:
            logger.info("Coach response served from cache")
            return CoachResponse(**cached)

        rag_service = get_rag_service()
        context_builder = get_context_builder()
        openai_client = get_openai_client()

        # Recupera contesto combinato (atleta + KB)
        combined = await context_builder.build_combined_context(
            query=request.question,
            athlete_id=request.athlete_id,
            namespaces=request.namespaces,
            top_k=request.top_k,
        )

        sources = combined.get("sources", [])
        matches = combined.get("matches", [])
        athlete_context = combined.get("athlete_context")

        logger.debug(
            "Context retrieved for coach",
            sources_count=len(sources),
            has_athlete_context=athlete_context is not None,
        )

        # Costruisci i messaggi con separazione corretta system/user
        messages = rag_service.build_messages(
            system_prompt=SYSTEM_PROMPT_COACH,
            context_docs=matches,
            user_query=request.question,
            athlete_context=athlete_context,
        )

        # Chiama il modello (il modello effettivo arriva da apps/api)
        llm_result = openai_client.chat_completion_full(
            messages=messages,
            model=request.model,
            temperature=0.7,
            max_tokens=2048,
        )
        response_content = llm_result.content

        logger.info(
            "Coach consultation completed",
            response_length=len(response_content),
            sources_count=len(sources),
            model=llm_result.model,
            total_tokens=llm_result.total_tokens,
        )

        # Estrai riferimenti dai metadati delle fonti
        references = []
        for source in sources:
            if source.metadata:
                ref = source.metadata.get("reference")
                if ref and ref not in references:
                    references.append(ref)

        result = CoachResponse(
            answer=response_content,
            sources=sources,
            references=references,
            usage=UsageInfo(**llm_result.as_usage_dict()),
        )

        # Cache the response.
        # `usage` viene escluso: una risposta servita dalla cache non consuma
        # token, contarli di nuovo gonfierebbe lo storico dei costi.
        cache_set("response", cache_key, result.model_dump(exclude={"usage"}))

        return result

    except APIError as e:
        logger.error("OpenAI API error in coach endpoint", error=str(e))
        raise HTTPException(status_code=503, detail="Errore nel servizio LLM")
    except Exception as e:
        logger.error(
            "Error in coach consultation",
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Errore nella consulenza del coach")
