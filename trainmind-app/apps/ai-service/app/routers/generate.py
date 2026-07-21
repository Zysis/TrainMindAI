"""
Endpoint per la generazione di contenuto (piani, sessioni, esercizi).

POST /ai/generate - Genera contenuto context-aware via RAG.

Sprint 2.2: Structured output parsing, athlete context, configurable params,
context-type-specific namespace selection.
"""

import json
import re
from typing import Optional
import structlog
from fastapi import APIRouter, HTTPException
from openai import APIError

from app.models.schemas import GenerateRequest, GenerateResponse
from app.services.rag import get_rag_service
from app.services.context_builder import get_context_builder
from app.services.prompts import SYSTEM_PROMPT_GENERATOR
from app.clients.openai_client import get_openai_client
from app.services.cache import cache_get, cache_set, build_response_cache_key

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["generate"])

# Mapping context_type -> namespace ottimali
CONTEXT_TYPE_NAMESPACES = {
    "plan": ["periodization", "exercises", "protocols"],
    "session": ["exercises", "protocols"],
    "exercise": ["exercises", "references"],
}


def extract_structured_data(content: str, context_type: str) -> Optional[dict]:
    """
    Tenta di estrarre dati strutturati dalla risposta generata.

    Cerca blocchi JSON o tabelle markdown nella risposta e li converte
    in dati strutturati utilizzabili dal frontend.

    Args:
        content: Contenuto generato dal modello
        context_type: Tipo di contesto (plan, session, exercise)

    Returns:
        Dati strutturati estratti o None
    """
    try:
        # Cerca blocchi JSON nella risposta
        json_pattern = r'```json\s*([\s\S]*?)\s*```'
        json_matches = re.findall(json_pattern, content)

        if json_matches:
            for match in json_matches:
                try:
                    return json.loads(match)
                except json.JSONDecodeError:
                    continue

        # Cerca tabelle markdown e convertile in dati strutturati
        table_pattern = r'\|(.+)\|\n\|[-\s|]+\|\n((?:\|.+\|\n?)+)'
        table_matches = re.findall(table_pattern, content)

        if table_matches:
            tables = []
            for header_row, body in table_matches:
                headers = [h.strip() for h in header_row.split('|') if h.strip()]
                rows = []
                for row_line in body.strip().split('\n'):
                    cells = [c.strip() for c in row_line.split('|') if c.strip()]
                    if cells:
                        row_dict = {}
                        for i, header in enumerate(headers):
                            if i < len(cells):
                                row_dict[header] = cells[i]
                        rows.append(row_dict)

                tables.append({
                    "headers": headers,
                    "rows": rows,
                })

            if tables:
                return {
                    "type": context_type,
                    "tables": tables,
                }

        return None

    except Exception as e:
        logger.debug("Could not extract structured data", error=str(e))
        return None


@router.post("/generate", response_model=GenerateResponse)
async def generate_content(request: GenerateRequest) -> GenerateResponse:
    """
    Genera contenuto di allenamento (piano, sessione, esercizio) usando RAG.

    Sprint 2.2 improvements:
    - Namespace auto-selection based on context_type
    - Athlete context integration
    - Structured data extraction from generated content
    - Proper system/user message separation

    Args:
        request: GenerateRequest con prompt, tipo contesto, e configurazione

    Returns:
        GenerateResponse con contenuto generato, fonti e dati strutturati
    """
    try:
        logger.info(
            "Generate request received",
            context_type=request.context_type,
            has_athlete_id=request.athlete_id is not None,
        )

        # Check cache
        cache_key = build_response_cache_key(
            request.prompt,
            namespaces=CONTEXT_TYPE_NAMESPACES.get(request.context_type),
            athlete_id=request.athlete_id,
        )
        cached = cache_get("response", cache_key)
        if cached:
            logger.info("Generate response served from cache")
            return GenerateResponse(**cached)

        rag_service = get_rag_service()
        context_builder = get_context_builder()
        openai_client = get_openai_client()

        # Determina namespace ottimali per il context_type
        namespaces = CONTEXT_TYPE_NAMESPACES.get(
            request.context_type,
            [request.namespace],
        )

        # Recupera contesto combinato
        combined = await context_builder.build_combined_context(
            query=request.prompt,
            athlete_id=request.athlete_id,
            namespaces=namespaces,
            top_k=request.top_k,
        )

        sources = combined.get("sources", [])
        matches = combined.get("matches", [])
        athlete_context = combined.get("athlete_context")

        logger.debug(
            "Context retrieved for generation",
            sources_count=len(sources),
            matches_count=len(matches),
            namespaces=namespaces,
        )

        # Costruisci i messaggi
        messages = rag_service.build_messages(
            system_prompt=SYSTEM_PROMPT_GENERATOR,
            context_docs=matches,
            user_query=request.prompt,
            athlete_context=athlete_context,
        )

        # Chiama OpenAI con parametri adatti alla generazione
        response_content = openai_client.chat_completion(
            messages=messages,
            temperature=0.6,  # Leggermente piu' deterministico per piani strutturati
            max_tokens=3000,  # Piani di allenamento sono tipicamente lunghi
        )

        # Prova ad estrarre dati strutturati
        structured_data = extract_structured_data(response_content, request.context_type)

        logger.info(
            "Content generated successfully",
            response_length=len(response_content),
            sources_count=len(sources),
            has_structured_data=structured_data is not None,
        )

        result = GenerateResponse(
            content=response_content,
            sources=sources,
            structured_data=structured_data,
        )

        # Cache the response
        cache_set("response", cache_key, result.model_dump())

        return result

    except APIError as e:
        logger.error("OpenAI API error", error=str(e))
        raise HTTPException(status_code=503, detail="Errore nel servizio LLM")
    except Exception as e:
        logger.error("Error generating content", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Errore nella generazione del contenuto")
