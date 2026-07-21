"""
Context builder for constructing rich contextual information.

Costruisce contesto da athlete data (via API interna) e knowledge base per RAG.

Sprint 2.2: Real athlete context via Fastify API, wellness data integration,
combined context assembly with proper formatting.
"""

from typing import Optional, Any
from datetime import datetime
import structlog
import httpx

from app.config import settings
from app.services.rag import get_rag_service
from app.services.prompts import ATHLETE_CONTEXT_PREFIX

logger = structlog.get_logger(__name__)

# URL base per l'API Fastify interna
API_BASE_URL = "http://localhost:3001/api/v1"
API_TIMEOUT = 5.0  # secondi


class ContextBuilder:
    """
    Costruisce contesto da multiple fonti per RAG.

    Sprint 2.2: Integrazione reale con il database via Fastify API
    per recuperare profilo atleta, wellness logs e injury history.
    """

    def __init__(self) -> None:
        """Inizializza il context builder."""
        self.rag_service = get_rag_service()

    async def _fetch_from_api(self, path: str) -> Optional[dict]:
        """
        Effettua una richiesta GET all'API Fastify interna.

        Args:
            path: Path dell'endpoint (es. /athletes/123)

        Returns:
            Dati JSON o None in caso di errore
        """
        url = f"{API_BASE_URL}{path}"
        try:
            async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(
                        "API returned non-200",
                        url=url,
                        status=response.status_code,
                    )
                    return None
        except httpx.TimeoutException:
            logger.warning("API timeout", url=url)
            return None
        except Exception as e:
            logger.warning("API request failed", url=url, error=str(e))
            return None

    async def get_athlete_context(self, athlete_id: str) -> str:
        """
        Recupera il contesto specifico di un atleta dall'API.

        Tenta di recuperare:
        - Profilo atleta (nome, posizione, dati biometrici)
        - Ultimi wellness logs
        - Infortuni attivi

        Se l'API non e' raggiungibile, ritorna un contesto minimo.

        Args:
            athlete_id: ID univoco dell'atleta

        Returns:
            Stringa formattata con il contesto dell'atleta
        """
        if not athlete_id:
            raise ValueError("athlete_id cannot be empty")

        try:
            logger.debug("Building athlete context", athlete_id=athlete_id)

            # Prova a recuperare il profilo atleta dall'API
            athlete_data = await self._fetch_from_api(f"/athletes/{athlete_id}")

            if athlete_data:
                context = self._format_athlete_profile(athlete_data)
            else:
                # Fallback: contesto minimo
                context = f"ID Atleta: {athlete_id}\nStato: Informazioni profilo non disponibili."

            # Prova a recuperare gli ultimi wellness logs
            wellness_data = await self._fetch_from_api(
                f"/athletes/{athlete_id}/wellness?limit=7"
            )
            if wellness_data and isinstance(wellness_data, list) and len(wellness_data) > 0:
                context += "\n\n" + self._format_wellness_summary(wellness_data)

            # Prova a recuperare infortuni attivi
            injuries_data = await self._fetch_from_api(
                f"/athletes/{athlete_id}/injuries?status=active"
            )
            if injuries_data and isinstance(injuries_data, list) and len(injuries_data) > 0:
                context += "\n\n" + self._format_injuries(injuries_data)

            logger.debug("Athlete context built", athlete_id=athlete_id, length=len(context))
            return context

        except Exception as e:
            logger.error(
                "Error building athlete context",
                athlete_id=athlete_id,
                error=str(e),
            )
            return f"ID Atleta: {athlete_id}\nStato: Errore nel recupero dati."

    def _format_athlete_profile(self, data: dict) -> str:
        """Formatta il profilo atleta in testo leggibile."""
        parts = []

        name = data.get("name", data.get("firstName", ""))
        surname = data.get("surname", data.get("lastName", ""))
        if name or surname:
            parts.append(f"Nome: {name} {surname}".strip())

        if data.get("position"):
            parts.append(f"Posizione: {data['position']}")

        if data.get("dateOfBirth"):
            try:
                dob = datetime.fromisoformat(data["dateOfBirth"].replace("Z", "+00:00"))
                age = (datetime.now() - dob.replace(tzinfo=None)).days // 365
                parts.append(f"Eta': {age} anni")
            except (ValueError, TypeError):
                pass

        if data.get("height"):
            parts.append(f"Altezza: {data['height']} cm")

        if data.get("weight"):
            parts.append(f"Peso: {data['weight']} kg")

        if data.get("dominantHand"):
            parts.append(f"Mano dominante: {data['dominantHand']}")

        if data.get("team"):
            parts.append(f"Squadra: {data['team']}")

        if data.get("notes"):
            parts.append(f"Note: {data['notes']}")

        return "\n".join(parts) if parts else "Profilo non disponibile"

    def _format_wellness_summary(self, wellness_logs: list[dict]) -> str:
        """
        Formatta un riepilogo dei wellness logs recenti.

        Args:
            wellness_logs: Lista di wellness log entries

        Returns:
            Testo formattato con trend wellness
        """
        if not wellness_logs:
            return ""

        parts = ["Wellness ultimi giorni:"]

        # Calcola medie
        fields = ["sleep", "fatigue", "soreness", "stress", "mood"]
        field_names = {
            "sleep": "Sonno",
            "fatigue": "Fatica",
            "soreness": "Dolore",
            "stress": "Stress",
            "mood": "Umore",
        }

        for field in fields:
            values = [log.get(field) for log in wellness_logs if log.get(field) is not None]
            if values:
                avg = sum(values) / len(values)
                latest = values[0] if values else None
                trend = ""
                if len(values) >= 3:
                    recent_avg = sum(values[:3]) / 3
                    older_avg = sum(values[3:]) / max(len(values[3:]), 1)
                    if older_avg > 0:
                        diff = recent_avg - older_avg
                        if diff > 0.5:
                            trend = " (in aumento)"
                        elif diff < -0.5:
                            trend = " (in calo)"

                parts.append(
                    f"- {field_names.get(field, field)}: ultimo={latest}/10, media={avg:.1f}/10{trend}"
                )

        return "\n".join(parts)

    def _format_injuries(self, injuries: list[dict]) -> str:
        """Formatta gli infortuni attivi."""
        if not injuries:
            return ""

        parts = ["Infortuni attivi:"]
        for injury in injuries:
            name = injury.get("type", injury.get("name", "Sconosciuto"))
            body_area = injury.get("bodyArea", "")
            severity = injury.get("severity", "")
            date = injury.get("date", injury.get("createdAt", ""))
            rtp_phase = injury.get("rtpPhase", "")

            line = f"- {name}"
            if body_area:
                line += f" ({body_area})"
            if severity:
                line += f", severita': {severity}"
            if rtp_phase:
                line += f", fase RTP: {rtp_phase}"

            parts.append(line)

        return "\n".join(parts)

    def get_kb_context(
        self,
        query: str,
        namespaces: Optional[list[str]] = None,
        top_k: int = 5,
    ) -> dict[str, Any]:
        """
        Recupera il contesto dalla knowledge base.

        Args:
            query: Query di ricerca
            namespaces: Namespace da cui cercare (None = auto-detect)
            top_k: Numero massimo di documenti

        Returns:
            Dizionario con contesto formattato e metadati
        """
        try:
            logger.debug(
                "Building KB context",
                query_length=len(query),
                namespaces=namespaces,
            )

            context_result = self.rag_service.retrieve_context(
                query=query,
                namespaces=namespaces,
                top_k=top_k,
                auto_detect_namespaces=(namespaces is None),
            )

            sources = context_result.get("sources", [])
            matches = context_result.get("matches", [])

            logger.debug(
                "KB context built successfully",
                sources_count=len(sources),
                matches_count=len(matches),
            )

            return {
                "sources": sources,
                "matches": matches,
                "high_relevance_count": context_result.get("high_relevance_count", 0),
            }

        except Exception as e:
            logger.error("Error building KB context", query=query, error=str(e))
            raise

    async def build_combined_context(
        self,
        query: str,
        athlete_id: Optional[str] = None,
        namespaces: Optional[list[str]] = None,
        top_k: int = 5,
    ) -> dict[str, Any]:
        """
        Costruisce un contesto combinato da multiple fonti.

        Args:
            query: Query principale
            athlete_id: ID dell'atleta (opzionale)
            namespaces: Namespace da ricercare (None = auto-detect)
            top_k: Numero massimo di documenti KB

        Returns:
            Dizionario con athlete_context, matches, sources
        """
        try:
            logger.debug(
                "Building combined context",
                query_length=len(query),
                has_athlete_id=athlete_id is not None,
                namespaces=namespaces,
            )

            result = {
                "athlete_context": None,
                "matches": [],
                "sources": [],
                "high_relevance_count": 0,
            }

            # Recupera contesto atleta se richiesto
            if athlete_id:
                try:
                    result["athlete_context"] = await self.get_athlete_context(athlete_id)
                except Exception as e:
                    logger.warning(
                        "Failed to get athlete context",
                        athlete_id=athlete_id,
                        error=str(e),
                    )

            # Recupera contesto KB
            try:
                kb_result = self.get_kb_context(query, namespaces, top_k)
                result["matches"] = kb_result["matches"]
                result["sources"] = kb_result["sources"]
                result["high_relevance_count"] = kb_result.get("high_relevance_count", 0)
            except Exception as e:
                logger.warning("Failed to get KB context", error=str(e))

            logger.debug(
                "Combined context built",
                has_athlete=result["athlete_context"] is not None,
                matches_count=len(result["matches"]),
            )

            return result

        except Exception as e:
            logger.error("Error building combined context", error=str(e))
            raise


# Istanza globale
_context_builder: Optional[ContextBuilder] = None


def get_context_builder() -> ContextBuilder:
    """
    Ottiene l'istanza globale del context builder.

    Returns:
        Istanza del ContextBuilder
    """
    global _context_builder
    if _context_builder is None:
        _context_builder = ContextBuilder()
    return _context_builder
