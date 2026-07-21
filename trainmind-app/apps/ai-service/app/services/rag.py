"""
Retrieval-Augmented Generation (RAG) service.

Gestisce il recupero di documenti rilevanti da ChromaDB e la costruzione
di prompt context-aware per il modello LLM.

Sprint 2.2: Enhanced with relevance filtering, deduplication, smart ranking,
query expansion, token budget management, and athlete context integration.
"""

import re
from typing import Optional
import structlog

from app.clients.openai_client import get_openai_client
from app.clients.vector_client import get_vector_client
from app.models.schemas import Source

logger = structlog.get_logger(__name__)

# ============================================================
# Costanti
# ============================================================

# Soglia minima di rilevanza (score sotto questo valore vengono scartati)
RELEVANCE_THRESHOLD = 0.25

# Soglia alta di rilevanza (score sopra questo valore sono "altamente rilevanti")
HIGH_RELEVANCE_THRESHOLD = 0.55

# Budget massimo di token per il contesto (approssimativo: 1 token ~ 4 chars)
MAX_CONTEXT_CHARS = 6000  # ~1500 token

# Budget per singolo documento nel contesto
MAX_DOC_CHARS = 1200  # ~300 token

# Mappatura keyword italiane -> namespace per query routing
KEYWORD_NAMESPACE_MAP = {
    "exercises": [
        "esercizio", "esercizi", "squat", "deadlift", "bench", "press",
        "jump", "salto", "plyo", "pliometria", "forza", "potenza",
        "agilita", "velocita", "core", "stretching", "flessibilita",
        "mobilita", "propriocezione", "coordinazione",
    ],
    "protocols": [
        "protocollo", "prevenzione", "infortunio", "rtp", "return to play",
        "riabilitazione", "recupero", "caviglia", "ginocchio", "spalla",
        "schiena", "hamstring", "achille", "anca", "tendinite",
    ],
    "periodization": [
        "periodizzazione", "lineare", "ondulata", "blocchi", "atr",
        "mesociclo", "microciclo", "macrociclo", "fase", "pre-season",
        "in-season", "off-season", "deload", "scarico", "picco",
    ],
    "references": [
        "1rm", "percentuale", "rpe", "scala", "borg", "vbt",
        "velocita", "zona", "tabella", "riferimento", "conversione",
    ],
}


class RAGService:
    """
    Servizio di Retrieval-Augmented Generation per context-aware LLM.

    Features Sprint 2.2:
    - Relevance threshold filtering
    - Deduplication by document ID
    - Smart namespace routing based on query keywords
    - Token budget management per il contesto
    - Athlete context injection
    """

    def __init__(self) -> None:
        """Inizializza il servizio RAG."""
        self.openai_client = get_openai_client()
        self.vector_client = get_vector_client()

    def detect_relevant_namespaces(self, query: str) -> list[str]:
        """
        Rileva i namespace rilevanti basandosi sulle keyword nella query.

        Args:
            query: Query in testo naturale

        Returns:
            Lista di namespace rilevanti (ordine: piu' probabile prima)
        """
        query_lower = query.lower()
        namespace_scores: dict[str, int] = {}

        for namespace, keywords in KEYWORD_NAMESPACE_MAP.items():
            score = sum(1 for kw in keywords if kw in query_lower)
            if score > 0:
                namespace_scores[namespace] = score

        if not namespace_scores:
            # Default: cerca in exercises e protocols
            return ["exercises", "protocols"]

        # Ordina per score decrescente
        sorted_ns = sorted(namespace_scores.items(), key=lambda x: x[1], reverse=True)
        return [ns for ns, _ in sorted_ns]

    def deduplicate_matches(self, matches: list[dict]) -> list[dict]:
        """
        Rimuove documenti duplicati mantenendo quello con score piu' alto.

        Args:
            matches: Lista di match da deduplicare

        Returns:
            Lista di match unici
        """
        seen_ids: set[str] = set()
        unique_matches: list[dict] = []

        for match in matches:
            doc_id = match["id"]
            if doc_id not in seen_ids:
                seen_ids.add(doc_id)
                unique_matches.append(match)

        return unique_matches

    def filter_by_relevance(
        self,
        matches: list[dict],
        threshold: float = RELEVANCE_THRESHOLD,
    ) -> list[dict]:
        """
        Filtra i match sotto la soglia di rilevanza.

        Args:
            matches: Lista di match
            threshold: Soglia minima di score

        Returns:
            Lista filtrata
        """
        filtered = [m for m in matches if m["score"] >= threshold]

        removed = len(matches) - len(filtered)
        if removed > 0:
            logger.debug(
                "Filtered low-relevance matches",
                removed=removed,
                threshold=threshold,
            )

        return filtered

    def retrieve_context(
        self,
        query: str,
        namespaces: Optional[list[str]] = None,
        top_k: int = 5,
        filters: Optional[dict] = None,
        relevance_threshold: float = RELEVANCE_THRESHOLD,
        auto_detect_namespaces: bool = False,
    ) -> dict:
        """
        Recupera documenti rilevanti da ChromaDB per una query.

        Args:
            query: Query in testo naturale
            namespaces: Lista di namespace da cui cercare (None = auto-detect)
            top_k: Numero di documenti da recuperare per namespace
            filters: Filtri opzionali da applicare alla query
            relevance_threshold: Soglia minima di rilevanza
            auto_detect_namespaces: Se True e namespaces e' None, auto-rileva

        Returns:
            Dizionario con chiavi "matches", "sources", "metadata"
        """
        try:
            # Auto-detect namespaces se richiesto
            if namespaces is None or (auto_detect_namespaces and not namespaces):
                namespaces = self.detect_relevant_namespaces(query)
                logger.debug("Auto-detected namespaces", namespaces=namespaces)

            logger.debug(
                "Retrieving context",
                query_length=len(query),
                namespaces=namespaces,
                top_k=top_k,
            )

            # Crea l'embedding della query
            query_embedding = self.openai_client.create_embedding(query)

            all_matches = []
            all_sources = []

            # Effettua la ricerca in ogni namespace
            for namespace in namespaces:
                try:
                    matches = self.vector_client.query_vectors(
                        embedding=query_embedding,
                        namespace=namespace,
                        top_k=top_k,
                        filter_dict=filters,
                    )

                    for match in matches:
                        metadata = match.get("metadata", {})
                        source = Source(
                            id=match["id"],
                            title=metadata.get("name", metadata.get("title", match["id"])),
                            category=namespace,
                            score=match["score"],
                            metadata=metadata,
                        )
                        all_sources.append(source)
                        all_matches.append(match)

                    logger.debug(
                        "Context retrieved from namespace",
                        namespace=namespace,
                        count=len(matches),
                    )

                except Exception as e:
                    logger.warning(
                        "Error retrieving from namespace",
                        namespace=namespace,
                        error=str(e),
                    )
                    continue

            # Pipeline: sort -> deduplicate -> filter -> top_k
            all_matches.sort(key=lambda x: x["score"], reverse=True)
            all_matches = self.deduplicate_matches(all_matches)
            all_matches = self.filter_by_relevance(all_matches, relevance_threshold)
            top_matches = all_matches[:top_k]

            # Filtra sources per allinearle ai match selezionati
            top_ids = {m["id"] for m in top_matches}
            top_sources = [s for s in all_sources if s.id in top_ids]
            # Ordina sources nello stesso ordine dei match
            source_map = {s.id: s for s in top_sources}
            top_sources = [source_map[m["id"]] for m in top_matches if m["id"] in source_map]

            # Calcola statistiche di rilevanza
            high_relevance = sum(1 for m in top_matches if m["score"] >= HIGH_RELEVANCE_THRESHOLD)

            logger.info(
                "Context retrieved successfully",
                total_matches=len(top_matches),
                high_relevance_count=high_relevance,
                namespaces_searched=namespaces,
            )

            return {
                "matches": top_matches,
                "sources": top_sources,
                "query_embedding_dim": len(query_embedding),
                "high_relevance_count": high_relevance,
            }

        except Exception as e:
            logger.error("Error retrieving context", error=str(e))
            raise

    def build_prompt(
        self,
        system_prompt: str,
        context_docs: list[dict],
        user_query: str,
        athlete_context: Optional[str] = None,
        max_context_chars: int = MAX_CONTEXT_CHARS,
    ) -> str:
        """
        Costruisce un prompt RAG completo con budget di token.

        Args:
            system_prompt: Prompt di sistema iniziale
            context_docs: Lista di documenti recuperati
            user_query: Query/domanda dell'utente
            athlete_context: Contesto dell'atleta (opzionale)
            max_context_chars: Limite caratteri per il contesto

        Returns:
            Prompt formattato pronto per l'LLM
        """
        if not user_query:
            raise ValueError("user_query cannot be empty")

        try:
            parts = []

            # Contesto atleta
            if athlete_context:
                parts.append(f"## PROFILO ATLETA:\n{athlete_context}\n")

            # Contesto knowledge base con budget
            if context_docs:
                kb_section = "## CONTESTO DALLA KNOWLEDGE BASE:\n\n"
                remaining_chars = max_context_chars
                doc_count = 0

                for i, doc in enumerate(context_docs, 1):
                    metadata = doc.get("metadata", {})
                    title = metadata.get("name", metadata.get("title", f"Documento {i}"))
                    content = metadata.get("content", "")
                    score = doc.get("score", 0)

                    if not content:
                        continue

                    # Tronca il singolo documento
                    doc_content = content[:MAX_DOC_CHARS]
                    if len(content) > MAX_DOC_CHARS:
                        doc_content += "..."

                    # Componi la sezione documento
                    doc_section = f"### {i}. {title} (rilevanza: {score:.0%})\n{doc_content}\n\n"

                    # Controlla budget
                    if len(doc_section) > remaining_chars:
                        if doc_count == 0:
                            # Almeno un documento deve essere incluso
                            kb_section += doc_section[:remaining_chars]
                            doc_count += 1
                        break

                    kb_section += doc_section
                    remaining_chars -= len(doc_section)
                    doc_count += 1

                if doc_count > 0:
                    parts.append(kb_section)

                logger.debug(
                    "Context budget used",
                    docs_included=doc_count,
                    chars_used=max_context_chars - remaining_chars,
                )

            # Assembla il prompt finale
            context_block = "\n".join(parts) if parts else ""

            full_prompt = f"""{context_block}

---

## DOMANDA DELL'UTENTE:

{user_query}"""

            logger.debug(
                "Prompt built successfully",
                prompt_length=len(full_prompt),
                context_docs_count=len(context_docs),
                has_athlete_context=athlete_context is not None,
            )

            return full_prompt

        except Exception as e:
            logger.error("Error building prompt", error=str(e))
            raise

    def build_messages(
        self,
        system_prompt: str,
        context_docs: list[dict],
        user_query: str,
        history: Optional[list[dict]] = None,
        athlete_context: Optional[str] = None,
    ) -> list[dict]:
        """
        Costruisce la lista di messaggi OpenAI con system prompt, history e RAG context.

        Questo metodo separa correttamente il system message dal contesto,
        preservando la history della conversazione.

        Args:
            system_prompt: Prompt di sistema
            context_docs: Documenti recuperati dal vector DB
            user_query: Ultima domanda dell'utente
            history: Messaggi precedenti della conversazione
            athlete_context: Contesto atleta opzionale

        Returns:
            Lista di messaggi nel formato OpenAI
        """
        messages = []

        # System message
        messages.append({
            "role": "system",
            "content": system_prompt,
        })

        # History precedente (escluso l'ultimo messaggio utente)
        if history:
            for msg in history[:-1]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        # User message con contesto RAG iniettato
        user_prompt = self.build_prompt(
            system_prompt="",  # Non duplicare il system prompt
            context_docs=context_docs,
            user_query=user_query,
            athlete_context=athlete_context,
        )

        messages.append({
            "role": "user",
            "content": user_prompt,
        })

        return messages

    def format_sources(
        self,
        sources: list[Source],
        max_sources: Optional[int] = 5,
    ) -> str:
        """
        Formatta una lista di Source objects come testo leggibile.

        Args:
            sources: Lista di Source da formattare
            max_sources: Numero massimo di fonti da includere

        Returns:
            Testo formattato con le fonti
        """
        if not sources:
            return ""

        try:
            display_sources = sources[:max_sources] if max_sources else sources

            formatted = "**Fonti utilizzate:**\n"
            for i, source in enumerate(display_sources, 1):
                formatted += f"\n{i}. **{source.title}** ({source.category})"
                formatted += f" - Rilevanza: {source.score:.0%}"

            return formatted

        except Exception as e:
            logger.warning("Error formatting sources", error=str(e))
            return ""


# Istanza globale del servizio RAG
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """
    Ottiene l'istanza globale del servizio RAG.

    Returns:
        Istanza del servizio RAG
    """
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
