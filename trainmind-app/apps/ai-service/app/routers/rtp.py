"""
Endpoint per consulenza AI Return-to-Play.

POST /ai/rtp-advisor - Analizza stato RTP e suggerisce avanzamento/esercizi.

Sprint 4.4b: RTP + AI integration.
"""

import json
import structlog
from fastapi import APIRouter, HTTPException
from openai import APIError

from app.models.schemas import (
    RTPAdvisorRequest,
    RTPAdvisorResponse,
    RTPExerciseSuggestion,
    UsageInfo,
)
from app.services.rag import get_rag_service
from app.services.context_builder import get_context_builder
from app.services.prompts import SYSTEM_PROMPT_RTP_ADVISOR
from app.clients.openai_client import get_openai_client
from app.services.cache import cache_get, cache_set, build_response_cache_key

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["rtp"])


def _build_rtp_user_prompt(req: RTPAdvisorRequest) -> str:
    """Build user prompt with all RTP context."""
    criteria_text = ""
    if req.criteria:
        met = [c for c in req.criteria if c.isMet]
        unmet = [c for c in req.criteria if not c.isMet]
        criteria_text = f"\n\nCRITERI CLEARANCE FASE CORRENTE ({len(met)}/{len(req.criteria)} soddisfatti):\n"
        for c in req.criteria:
            status = "MET" if c.isMet else "NOT MET"
            criteria_text += f"- [{status}] {c.description}\n"

    athlete_info = ""
    if req.athlete_name:
        athlete_info = f"\nAtleta: {req.athlete_name}"
        if req.athlete_position:
            athlete_info += f" ({req.athlete_position})"

    lang_instruction = "Rispondi in italiano." if req.language == "it" else "Respond in English."

    return f"""Analizza il seguente protocollo Return-to-Play e fornisci la tua consulenza.

INFORTUNIO:
- Tipo: {req.injury_type}
- Localizzazione: {req.injury_location}
- Severita': {req.injury_severity}/5
- Sport: {req.sport}
{athlete_info}

STATO PROTOCOLLO:
- Fase corrente: {req.current_phase}
- Giorni nel protocollo: {req.days_in_protocol}
{criteria_text}

{lang_instruction}
Rispondi SOLO con JSON valido, senza markdown o testo aggiuntivo."""


def _parse_rtp_response(content: str, model_name: str) -> RTPAdvisorResponse:
    """Parse LLM JSON response into RTPAdvisorResponse."""
    # Strip markdown code fences if present
    cleaned = content.strip()
    if cleaned.startswith("```"):
        # Remove first line (```json or ```) and last line (```)
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    data = json.loads(cleaned)

    exercises = []
    for ex in data.get("suggested_exercises", []):
        exercises.append(RTPExerciseSuggestion(
            name=ex.get("name", ""),
            sets=str(ex.get("sets", "")),
            reps=str(ex.get("reps", "")),
            notes=ex.get("notes", ""),
            priority=ex.get("priority", "recommended"),
        ))

    return RTPAdvisorResponse(
        readiness_score=data.get("readiness_score", 0),
        readiness_label=data.get("readiness_label", "not_ready"),
        phase_analysis=data.get("phase_analysis", ""),
        advancement_recommendation=data.get("advancement_recommendation", ""),
        suggested_exercises=exercises,
        cautions=data.get("cautions", []),
        estimated_days_to_next_phase=data.get("estimated_days_to_next_phase"),
        model=model_name,
    )


def _fallback_response(req: RTPAdvisorRequest) -> RTPAdvisorResponse:
    """Generate rule-based fallback if LLM fails."""
    met_count = sum(1 for c in req.criteria if c.isMet)
    total = len(req.criteria) if req.criteria else 1
    base_score = int((met_count / total) * 80)

    # Severity penalty
    if req.injury_severity >= 4:
        base_score = max(0, base_score - 15)

    # Determine label
    if base_score >= 90:
        label = "cleared"
    elif base_score >= 70:
        label = "ready"
    elif base_score >= 40:
        label = "approaching"
    else:
        label = "not_ready"

    # Estimate days based on phase and severity
    phase_days = {
        "PHASE_1": 7 + req.injury_severity * 3,
        "PHASE_2": 10 + req.injury_severity * 3,
        "PHASE_3": 14 + req.injury_severity * 2,
        "PHASE_4": 10 + req.injury_severity * 2,
        "PHASE_5": 7 + req.injury_severity,
    }
    est_days = phase_days.get(req.current_phase, 14)

    return RTPAdvisorResponse(
        readiness_score=base_score,
        readiness_label=label,
        phase_analysis=f"Atleta in {req.current_phase} con {met_count}/{total} criteri soddisfatti. "
                       f"Infortunio {req.injury_type} ({req.injury_location}), severita' {req.injury_severity}/5.",
        advancement_recommendation="Completare i criteri mancanti prima di avanzare alla fase successiva."
                                   if met_count < total else
                                   "Criteri soddisfatti. Valutare avanzamento con supervisione medica.",
        suggested_exercises=[],
        cautions=["Risposta generata da regole automatiche (LLM non disponibile). Consultare lo staff medico."],
        estimated_days_to_next_phase=est_days,
        model="fallback",
    )


@router.post("/rtp-advisor", response_model=RTPAdvisorResponse)
async def rtp_advisor(request: RTPAdvisorRequest) -> RTPAdvisorResponse:
    """
    Analizza protocollo RTP e fornisce consulenza AI su readiness,
    esercizi suggeriti e raccomandazioni per avanzamento fase.
    """
    try:
        logger.info(
            "RTP advisor request",
            injury_type=request.injury_type,
            phase=request.current_phase,
            days=request.days_in_protocol,
            criteria_count=len(request.criteria),
        )

        # Check cache
        cache_key = build_response_cache_key(
            f"rtp:{request.injury_type}:{request.current_phase}:{request.days_in_protocol}",
            namespaces=["protocols", "exercises"],
            athlete_id=request.athlete_name,
            model=request.model,
        )
        cached = cache_get("response", cache_key)
        if cached:
            logger.info("RTP advisor response from cache")
            return RTPAdvisorResponse(**cached)

        rag_service = get_rag_service()
        context_builder = get_context_builder()
        openai_client = get_openai_client()

        # RAG: recupera contesto su riabilitazione per tipo infortunio
        rtp_query = f"return to play {request.injury_type} {request.injury_location} {request.current_phase} basketball rehabilitation"
        combined = await context_builder.build_combined_context(
            query=rtp_query,
            athlete_id=None,
            namespaces=["protocols", "exercises"],
            top_k=5,
        )

        matches = combined.get("matches", [])

        logger.debug("RTP context retrieved", matches_count=len(matches))

        # Build messages
        user_prompt = _build_rtp_user_prompt(request)
        messages = rag_service.build_messages(
            system_prompt=SYSTEM_PROMPT_RTP_ADVISOR,
            context_docs=matches,
            user_query=user_prompt,
            athlete_context=None,
        )

        # Call LLM
        llm_result = openai_client.chat_completion_full(
            messages=messages,
            model=request.model,
            temperature=0.4,  # Lower temp for more consistent structured output
            max_tokens=2048,
        )
        response_content = llm_result.content

        result = _parse_rtp_response(response_content, llm_result.model or "gpt-4")
        result.usage = UsageInfo(**llm_result.as_usage_dict())

        logger.info(
            "RTP advisor completed",
            readiness_score=result.readiness_score,
            label=result.readiness_label,
            exercises_count=len(result.suggested_exercises),
            model=llm_result.model,
            total_tokens=llm_result.total_tokens,
        )

        # Cache senza `usage`: dalla cache non si consumano token.
        cache_set("response", cache_key, result.model_dump(exclude={"usage"}))

        return result

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.warning("RTP advisor LLM parse error, using fallback", error=str(e))
        return _fallback_response(request)

    except APIError as e:
        logger.error("OpenAI API error in RTP advisor", error=str(e))
        return _fallback_response(request)

    except Exception as e:
        logger.error("RTP advisor error", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Errore nella consulenza RTP AI")
