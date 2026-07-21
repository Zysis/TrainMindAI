"""
Endpoint per la generazione di riassunti narrativi di report periodici.

POST /ai/generate-report-summary - Genera un riassunto testuale breve (2-4 frasi)
da un payload di dati aggregati per le 3 audience: STAFF, MEDICAL, TRAINER.

Sprint 4.1.2b: Report Engine - AI narrative summary.
"""

import json
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from openai import APIError

from app.models.schemas import ReportSummaryRequest, ReportSummaryResponse
from app.services.prompts import get_report_prompt
from app.clients.openai_client import get_openai_client
from app.services.cache import cache_get, cache_set

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["reports"])


def _build_user_payload(request: ReportSummaryRequest) -> str:
    """Costruisce il messaggio user con i dati del report da riassumere."""
    return (
        f"Organizzazione: {request.organization_name}\n"
        f"Periodo: dal {request.period_from} al {request.period_to}\n"
        f"Audience: {request.audience}\n\n"
        f"Dati aggregati del report (JSON):\n"
        f"{json.dumps(request.data, ensure_ascii=False, indent=2)[:6000]}\n\n"
        f"Genera un riassunto in italiano secondo le regole del system prompt. "
        f"Rispondi ESCLUSIVAMENTE con un JSON valido nel formato "
        f'{{"summary": "...", "highlights": ["...", "..."]}}'
    )


def _fallback_summary(request: ReportSummaryRequest) -> ReportSummaryResponse:
    """Genera un riassunto deterministico in caso di errore LLM."""
    audience_labels = {
        "STAFF": "Staff tecnico",
        "MEDICAL": "Staff medico",
        "TRAINER": "Preparazione atletica",
    }
    label = audience_labels.get(request.audience, "Staff")
    data = request.data or {}
    kpis = data.get("kpis", []) if isinstance(data, dict) else []

    highlights: list[str] = []
    for kpi in kpis[:4]:
        if isinstance(kpi, dict):
            label_k = kpi.get("label", "")
            value_k = kpi.get("value", "")
            if label_k and value_k != "":
                highlights.append(f"{label_k}: {value_k}")

    summary = (
        f"Report {label} per {request.organization_name} dal {request.period_from} al "
        f"{request.period_to}. Il periodo e' stato analizzato su base dati aggregati "
        f"della piattaforma TrainMind AI."
    )
    if not highlights:
        highlights = ["Dati insufficienti per dettagli quantitativi"]

    return ReportSummaryResponse(
        summary=summary,
        highlights=highlights,
        model="fallback",
    )


def _parse_llm_response(raw: str) -> dict[str, Any]:
    """Estrae JSON dalla risposta del modello, tollerante a code fences."""
    text = raw.strip()
    if text.startswith("```"):
        # rimuovi code fence (```json ... ``` o ``` ... ```)
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # fallback: estrai dalla prima { alla ultima }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    return json.loads(text)


def _build_cache_key(request: ReportSummaryRequest) -> str:
    """Costruisce una chiave cache deterministica per il report summary."""
    import hashlib

    payload = f"{request.audience}|{request.organization_name}|{request.period_from}|{request.period_to}|{json.dumps(request.data, sort_keys=True, ensure_ascii=False)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


@router.post("/generate-report-summary", response_model=ReportSummaryResponse)
async def generate_report_summary(
    request: ReportSummaryRequest,
) -> ReportSummaryResponse:
    """
    Genera un riassunto narrativo breve (2-4 frasi) per un report periodico.

    Args:
        request: ReportSummaryRequest con audience, periodo, dati aggregati

    Returns:
        ReportSummaryResponse con summary testuale e highlights
    """
    try:
        logger.info(
            "Report summary request received",
            audience=request.audience,
            org=request.organization_name,
            period_from=request.period_from,
            period_to=request.period_to,
        )

        # Cache lookup
        cache_key = _build_cache_key(request)
        cached = cache_get("report_summary", cache_key)
        if cached:
            logger.info("Report summary served from cache")
            return ReportSummaryResponse(**cached)

        system_prompt = get_report_prompt(request.audience)
        user_payload = _build_user_payload(request)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ]

        openai_client = get_openai_client()

        try:
            raw_response = openai_client.chat_completion(
                messages=messages,
                temperature=0.4,
                max_tokens=600,
            )
        except Exception as exc:
            logger.warning(
                "LLM call failed, using fallback summary",
                error=str(exc),
                audience=request.audience,
            )
            return _fallback_summary(request)

        try:
            parsed = _parse_llm_response(raw_response)
            summary_text = parsed.get("summary", "").strip()
            highlights_raw = parsed.get("highlights", [])
            if not isinstance(highlights_raw, list):
                highlights_raw = []
            highlights = [str(h).strip() for h in highlights_raw if str(h).strip()]

            if not summary_text:
                raise ValueError("Empty summary from LLM")

        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning(
                "Failed to parse LLM response as JSON, using fallback",
                error=str(exc),
                raw_preview=raw_response[:200],
            )
            return _fallback_summary(request)

        result = ReportSummaryResponse(
            summary=summary_text,
            highlights=highlights[:5],
            model=getattr(openai_client, "model", "gpt-4o"),
        )

        cache_set("report_summary", cache_key, result.model_dump())

        logger.info(
            "Report summary generated",
            audience=request.audience,
            summary_length=len(summary_text),
            highlights_count=len(highlights),
        )

        return result

    except APIError as e:
        logger.error("OpenAI API error in report summary", error=str(e))
        # Non fallire: ritorna fallback
        return _fallback_summary(request)
    except Exception as e:
        logger.error(
            "Unexpected error in report summary",
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Errore nella generazione del riassunto del report",
        )
