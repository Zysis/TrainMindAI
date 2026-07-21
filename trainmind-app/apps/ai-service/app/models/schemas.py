"""
Request and response schemas for API endpoints.

Definisce le strutture dati Pydantic per la validazione e serializzazione.

Sprint 2.2: Updated descriptions for ChromaDB, added fields for
athlete context and enhanced configuration.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field


class Source(BaseModel):
    """Rappresenta una fonte di documentazione recuperata dalla knowledge base."""

    id: str = Field(..., description="ID univoco della fonte")
    title: str = Field(..., description="Titolo della fonte")
    category: str = Field(..., description="Categoria/namespace della fonte")
    score: float = Field(..., ge=-1.0, le=1.0, description="Score di rilevanza")
    metadata: Optional[dict] = Field(None, description="Metadati aggiuntivi")


class GenerateRequest(BaseModel):
    """Richiesta per generare contenuto (piano di allenamento, sessione, esercizio)."""

    prompt: str = Field(..., description="Prompt per la generazione")
    athlete_id: Optional[str] = Field(None, description="ID dell'atleta per personalizzazione")
    context_type: Literal["plan", "session", "exercise"] = Field(
        "plan",
        description="Tipo di contesto: piano di allenamento, sessione o esercizio",
    )
    namespace: str = Field(
        "protocols",
        description="Namespace ChromaDB da cui recuperare il contesto (fallback se context_type non mappato)",
    )
    top_k: int = Field(5, ge=1, le=50, description="Numero di documenti da recuperare")


class GenerateResponse(BaseModel):
    """Risposta contenente il contenuto generato."""

    content: str = Field(..., description="Contenuto generato dal modello")
    sources: list[Source] = Field(
        default_factory=list,
        description="Lista di fonti utilizzate per la generazione",
    )
    structured_data: Optional[dict] = Field(
        None,
        description="Dati strutturati estratti dalla risposta (tabelle, JSON se disponibile)",
    )


class CoachRequest(BaseModel):
    """Richiesta per una consulenza da un coach IA."""

    question: str = Field(..., description="Domanda per il coach")
    athlete_id: Optional[str] = Field(None, description="ID dell'atleta per personalizzazione")
    category: Optional[str] = Field(
        None,
        description="Categoria della domanda (es: form, nutrition, recovery, programming)",
    )
    namespaces: list[str] = Field(
        default_factory=lambda: ["protocols", "exercises", "references"],
        description="Namespace da cui recuperare il contesto",
    )
    top_k: int = Field(5, ge=1, le=50, description="Numero di documenti da recuperare")


class CoachResponse(BaseModel):
    """Risposta da un coach IA."""

    answer: str = Field(..., description="Risposta alla domanda")
    sources: list[Source] = Field(
        default_factory=list,
        description="Liste di fonti di supporto",
    )
    references: list[str] = Field(
        default_factory=list,
        description="Riferimenti scientifici citati",
    )


class EmbedRequest(BaseModel):
    """Richiesta per creare embedding e upsertarli in ChromaDB."""

    texts: list[str] = Field(..., description="Lista di testi da embeddare")
    namespace: str = Field(..., description="Namespace/collezione ChromaDB di destinazione")
    metadata: list[dict] = Field(
        default_factory=list,
        description="Lista di metadata corrispondenti ai testi (stessa lunghezza di texts)",
    )


class EmbedResponse(BaseModel):
    """Risposta dall'operazione di embedding e upsert."""

    count: int = Field(..., description="Numero di embedding creati e upsertati")
    namespace: str = Field(..., description="Namespace dove sono stati salvati")
    details: Optional[dict] = Field(None, description="Dettagli aggiuntivi dell'operazione")


class ChatMessage(BaseModel):
    """Singolo messaggio in una conversazione."""

    role: Literal["user", "assistant", "system"] = Field(..., description="Ruolo del messaggio")
    content: str = Field(..., description="Contenuto del messaggio")


class ChatRequest(BaseModel):
    """Richiesta per un'interazione di chat RAG-enhanced."""

    messages: list[ChatMessage] = Field(..., description="Cronologia dei messaggi")
    athlete_id: Optional[str] = Field(None, description="ID dell'atleta per personalizzazione")
    stream: bool = Field(False, description="Se True, risposta in streaming SSE")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Temperatura del modello")
    max_tokens: int = Field(2048, ge=100, le=4096, description="Max token nella risposta")
    namespaces: list[str] = Field(
        default_factory=lambda: ["protocols", "exercises"],
        description="Namespace da cui recuperare il contesto",
    )
    top_k: int = Field(5, ge=1, le=50, description="Numero di documenti da recuperare")


class ChatResponse(BaseModel):
    """Risposta da un'interazione di chat."""

    content: str = Field(..., description="Contenuto della risposta")
    sources: list[Source] = Field(
        default_factory=list,
        description="Fonti utilizzate nel contesto",
    )
    finish_reason: str = Field(
        "stop",
        description="Motivo della terminazione (stop, length, etc.)",
    )


class HealthCheckResponse(BaseModel):
    """Risposta dal health check endpoint."""

    status: str = Field(..., description="Stato del servizio")
    version: str = Field(..., description="Versione del servizio")
    services: dict = Field(..., description="Stato dei servizi dipendenti")


# ============================================================
# REPORT SUMMARY (Sprint 4.1.2b)
# ============================================================

class ReportSummaryRequest(BaseModel):
    """Richiesta per la generazione di un riassunto narrativo di un report."""

    audience: Literal["STAFF", "MEDICAL", "TRAINER"] = Field(
        ..., description="Audience del report (determina il tono e gli aspetti enfatizzati)"
    )
    organization_name: str = Field(..., description="Nome dell'organizzazione/squadra")
    period_from: str = Field(..., description="Inizio periodo (YYYY-MM-DD)")
    period_to: str = Field(..., description="Fine periodo (YYYY-MM-DD)")
    data: dict = Field(
        ..., description="Dati aggregati del report (KPI, tabelle, distribuzioni)"
    )
    language: Literal["it", "en"] = Field("it", description="Lingua del riassunto")


class ReportSummaryResponse(BaseModel):
    """Risposta contenente il riassunto narrativo del report."""

    summary: str = Field(..., description="Riassunto narrativo (2-4 frasi)")
    highlights: list[str] = Field(
        default_factory=list,
        description="Lista di punti chiave (bullet points)",
    )
    model: str = Field("fallback", description="Modello utilizzato per la generazione")


# ============================================================
# RTP AI ADVISOR (Sprint 4.4b)
# ============================================================

class RTPCriterion(BaseModel):
    """Singolo criterio di clearance."""
    description: str
    isMet: bool

class RTPAdvisorRequest(BaseModel):
    """Richiesta consulenza AI per protocollo Return-to-Play."""
    injury_type: str = Field(..., description="Tipo infortunio (muscular, ligament, tendon, bone, joint, etc.)")
    injury_location: str = Field(..., description="Localizzazione (knee_r, ankle_l, hamstring_r, etc.)")
    injury_severity: int = Field(..., ge=1, le=5, description="Severità 1-5")
    current_phase: str = Field(..., description="Fase RTP corrente (PHASE_1..PHASE_5, CLEARED)")
    days_in_protocol: int = Field(0, description="Giorni dall'inizio protocollo")
    criteria: list[RTPCriterion] = Field(default_factory=list, description="Criteri clearance fase corrente")
    athlete_name: Optional[str] = Field(None, description="Nome atleta")
    athlete_position: Optional[str] = Field(None, description="Ruolo (Point Guard, Center, etc.)")
    sport: str = Field("basketball", description="Sport")
    language: Literal["it", "en"] = Field("it", description="Lingua risposta")

class RTPExerciseSuggestion(BaseModel):
    """Esercizio suggerito per fase RTP."""
    name: str
    sets: str
    reps: str
    notes: str
    priority: Literal["essential", "recommended", "optional"]

class RTPAdvisorResponse(BaseModel):
    """Risposta AI con analisi RTP e suggerimenti."""
    readiness_score: int = Field(..., ge=0, le=100, description="Score readiness avanzamento 0-100")
    readiness_label: str = Field(..., description="Label: not_ready, approaching, ready, cleared")
    phase_analysis: str = Field(..., description="Analisi narrativa dello stato attuale")
    advancement_recommendation: str = Field(..., description="Raccomandazione specifica su avanzamento")
    suggested_exercises: list[RTPExerciseSuggestion] = Field(default_factory=list, description="Esercizi suggeriti per fase corrente")
    cautions: list[str] = Field(default_factory=list, description="Avvertenze e precauzioni")
    estimated_days_to_next_phase: Optional[int] = Field(None, description="Stima giorni per prossima fase")
    model: str = Field("fallback", description="Modello utilizzato")
