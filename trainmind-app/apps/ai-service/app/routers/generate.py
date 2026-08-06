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

from app.models.schemas import GenerateRequest, GenerateResponse, UsageInfo
from app.services.rag import get_rag_service
from app.services.context_builder import get_context_builder
from app.services.prompts import SYSTEM_PROMPT_GENERATOR, SYSTEM_PROMPT_PLAN_JSON
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


def parse_structured_plan(content: str) -> Optional[dict]:
    """
    Valida un piano JSON generato dal modello.

    Non basta che il JSON sia sintatticamente valido: il frontend abilita
    "Usa questo piano" solo se trova `planName`, `description` e `weeks[]`, e
    poi cicla su `weeks[].sessions[].exercises[]`. Un JSON valido ma con la
    forma sbagliata farebbe esplodere la pagina invece di disabilitare il
    pulsante, quindi la forma va verificata qui.

    Returns:
        Il piano se la forma è corretta, altrimenti None.
    """
    try:
        data = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Piano: risposta non è JSON valido")
        return None

    if not isinstance(data, dict):
        return None

    weeks = data.get("weeks")
    if not isinstance(weeks, list) or not weeks:
        logger.warning("Piano: campo 'weeks' assente o vuoto")
        return None

    for week in weeks:
        if not isinstance(week, dict):
            return None
        sessions = week.get("sessions")
        if not isinstance(sessions, list) or not sessions:
            logger.warning("Piano: settimana senza sessioni")
            return None
        for session in sessions:
            if not isinstance(session, dict) or not isinstance(
                session.get("exercises"), list
            ):
                logger.warning("Piano: sessione senza array 'exercises'")
                return None

    if not data.get("planName") or not isinstance(data.get("planName"), str):
        return None

    data.setdefault("description", "")
    return data


def format_rest(seconds: int) -> str:
    """
    Formatta il recupero senza arrotondare.

    Un arrotondamento ai minuti trasformerebbe 90 secondi in "2 min": un errore
    del 33% su un parametro che il preparatore usa davvero. Si mostrano quindi
    i minuti solo quando il valore è esatto.
    """
    try:
        seconds = int(seconds)
    except (TypeError, ValueError):
        return str(seconds)

    if seconds < 60:
        return f"{seconds} sec"
    if seconds % 60 == 0:
        return f"{seconds // 60} min"
    return f"{seconds // 60} min {seconds % 60} sec"


def render_plan_as_text(plan: dict) -> str:
    """
    Versione leggibile del piano, usata come `content`.

    Serve perché il JSON grezzo non è mostrabile all'utente: se per qualsiasi
    motivo il frontend non usasse la vista strutturata, ricadrebbe su `content`.
    """
    lines: list[str] = [str(plan.get("planName", "Piano di allenamento"))]
    if plan.get("description"):
        lines.append(str(plan["description"]))
    lines.append("")

    for week in plan.get("weeks", []):
        lines.append(f"━━━ SETTIMANA {week.get('weekNumber', '?')} ━━━")
        if week.get("notes"):
            lines.append(str(week["notes"]))
        lines.append("")

        for session in week.get("sessions", []):
            duration = session.get("duration")
            header = f"▸ {session.get('title', 'Sessione')}"
            if duration:
                header += f" ({duration} min)"
            lines.append(header)
            if session.get("notes"):
                lines.append(str(session["notes"]))

            for i, ex in enumerate(session.get("exercises", []), start=1):
                line = f"  {i}. {ex.get('name', '?')} — {ex.get('sets', '?')}x{ex.get('reps', '?')}"
                if ex.get("intensity"):
                    line += f" @ {ex['intensity']}"
                rest = ex.get("restSeconds")
                if rest:
                    line += f" | Rec: {format_rest(rest)}"
                if ex.get("notes"):
                    line += f" ({ex['notes']})"
                lines.append(line)
            lines.append("")

    return "\n".join(lines)


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
            model=request.model,
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

        # Per i piani si genera JSON strutturato: è l'unico formato che il
        # frontend può importare con "Usa questo piano". Sessioni ed esercizi
        # restano su markdown leggibile, che è ciò che serve lì.
        wants_plan = request.context_type == "plan"

        messages = rag_service.build_messages(
            system_prompt=SYSTEM_PROMPT_PLAN_JSON if wants_plan else SYSTEM_PROMPT_GENERATOR,
            context_docs=matches,
            user_query=request.prompt,
            athlete_context=athlete_context,
        )

        llm_result = openai_client.chat_completion_full(
            messages=messages,
            model=request.model,
            temperature=0.6,  # Leggermente piu' deterministico per piani strutturati
            # I piani in JSON sono più verbosi del markdown equivalente: con un
            # tetto troppo basso la risposta viene troncata e il JSON non chiude.
            max_tokens=4096 if wants_plan else 3000,
            json_mode=wants_plan,
        )
        response_content = llm_result.content

        structured_plan = parse_structured_plan(response_content) if wants_plan else None
        structured_data = None

        if structured_plan:
            # Il JSON grezzo non è mostrabile: `content` diventa la resa leggibile.
            response_content = render_plan_as_text(structured_plan)
        else:
            # Nessun piano valido (o context_type diverso): si ripiega
            # sull'estrazione delle tabelle markdown, come prima.
            structured_data = extract_structured_data(response_content, request.context_type)
            if wants_plan:
                logger.warning(
                    "Piano richiesto ma JSON non valido: il frontend non potrà importarlo",
                    model=llm_result.model,
                )

        logger.info(
            "Content generated successfully",
            response_length=len(response_content),
            sources_count=len(sources),
            has_structured_plan=structured_plan is not None,
            has_structured_data=structured_data is not None,
        )

        result = GenerateResponse(
            content=response_content,
            sources=sources,
            structured_data=structured_data,
            structured_plan=structured_plan,
            usage=UsageInfo(**llm_result.as_usage_dict()),
        )

        # Cache the response senza `usage`: una risposta dalla cache non
        # consuma token e non deve essere conteggiata due volte.
        cache_set("response", cache_key, result.model_dump(exclude={"usage"}))

        return result

    except APIError as e:
        logger.error("OpenAI API error", error=str(e))
        raise HTTPException(status_code=503, detail="Errore nel servizio LLM")
    except Exception as e:
        logger.error("Error generating content", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Errore nella generazione del contenuto")
