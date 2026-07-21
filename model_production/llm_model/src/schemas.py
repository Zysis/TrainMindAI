"""
src/schemas.py
==============
Schemi Pydantic v2 per tutti gli output strutturati del sistema TrainMindAI.
Ogni output destinato al frontend DEVE passare per uno di questi schemi.

Tipi di output:
- AlertWorkload  : Alert su soglie di carico
- AthleteSummary : Sintesi individuale dell'atleta
- TeamSummary    : Sintesi collettiva della squadra
- DailyReport   : Report giornaliero della sessione
- WeeklyReport  : Report settimanale aggregato
- StaffNote     : Nota tecnica breve per lo staff
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# =============================================================================
# ENUMERAZIONI
# =============================================================================

class AlertLevel(str, Enum):
    """Livelli di severità degli alert."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertCode(str, Enum):
    """Codici identificativi degli alert di workload."""
    ACWR_HIGH = "ACWR_HIGH"
    ACWR_LOW = "ACWR_LOW"
    MONOTONIA_HIGH = "MONOTONIA_HIGH"
    STRAIN_HIGH = "STRAIN_HIGH"
    RPE_SPIKE = "RPE_SPIKE"
    CONSECUTIVE_HIGH = "CONSECUTIVE_HIGH"
    SLEEP_LOW = "SLEEP_LOW"
    READINESS_LOW = "READINESS_LOW"


class AcwrZone(str, Enum):
    """Zone ACWR per classificazione rapida."""
    UNDERTRAINING = "undertraining"      # < 0.8
    SWEET_SPOT = "sweet_spot"            # 0.8 - 1.3
    GRAY_ZONE = "gray_zone"             # 1.3 - 1.5
    DANGER_ZONE = "danger_zone"          # > 1.5
    CRITICAL_ZONE = "critical_zone"      # > 2.0


class Availability(str, Enum):
    """Stato di disponibilità dell'atleta."""
    FULL = "full"
    PARTIAL = "partial"
    UNAVAILABLE = "unavailable"


class LoadTrend(str, Enum):
    """Trend del carico rispetto al periodo precedente."""
    INCREASING = "increasing"
    STABLE = "stable"
    DECREASING = "decreasing"


class AthleteStatus(str, Enum):
    """Stato classificato dell'atleta (semaforo)."""
    GREEN = "green"     # Condizione ottimale
    YELLOW = "yellow"   # Monitoraggio
    RED = "red"         # Attenzione


# =============================================================================
# MODELLI BASE
# =============================================================================

class SubjectiveIndicators(BaseModel):
    """Indicatori soggettivi di benessere dell'atleta (scala 1-10)."""
    sleep: Optional[float] = Field(None, ge=1, le=10, description="Qualità del sonno")
    fatigue: Optional[float] = Field(None, ge=1, le=10, description="Percezione fatica")
    muscle_pain: Optional[float] = Field(None, ge=1, le=10, description="Dolore muscolare")
    stress: Optional[float] = Field(None, ge=1, le=10, description="Stress percepito")
    motivation: Optional[float] = Field(None, ge=1, le=10, description="Motivazione")
    readiness: Optional[float] = Field(None, ge=1, le=10, description="Prontezza all'allenamento")


class WorkloadMetrics(BaseModel):
    """Metriche di carico dell'atleta."""
    daily_srpe: Optional[float] = Field(None, ge=0, description="sRPE giornaliera (AU)")
    weekly_load: Optional[float] = Field(None, ge=0, description="Carico settimanale (AU)")
    acute_load: Optional[float] = Field(None, ge=0, description="Carico acuto 7gg (AU)")
    chronic_load: Optional[float] = Field(None, ge=0, description="Carico cronico 28gg (AU)")
    acwr: Optional[float] = Field(None, ge=0, description="ACWR")
    acwr_zone: Optional[AcwrZone] = Field(None, description="Zona ACWR")
    monotony: Optional[float] = Field(None, ge=0, description="Monotonia settimanale")
    strain: Optional[float] = Field(None, ge=0, description="Strain settimanale")


# =============================================================================
# OUTPUT STRUTTURATI
# =============================================================================

class AlertWorkload(BaseModel):
    """
    Alert di carico per un singolo atleta.
    Generato da regole Python (soglie) + LLM (testo messaggio/suggerimento).
    """
    type: str = Field(default="alert_workload", description="Tipo di output")
    level: AlertLevel = Field(..., description="Livello di severità")
    athlete_id: str = Field(..., description="ID anonimo dell'atleta")
    code: AlertCode = Field(..., description="Codice identificativo dell'alert")
    value: float = Field(..., description="Valore che ha triggerato l'alert")
    threshold: float = Field(..., description="Soglia superata")
    message: str = Field(..., description="Descrizione breve dell'alert")
    suggestion: str = Field(..., description="Suggerimento operativo concreto")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AthleteSummary(BaseModel):
    """
    Sintesi individuale dell'atleta per un periodo specifico.
    Generata da LLM + RAG + dati strutturati.
    """
    type: str = Field(default="athlete_summary", description="Tipo di output")
    athlete_id: str = Field(..., description="ID anonimo dell'atleta")
    period_start: str = Field(..., description="Data inizio periodo (YYYY-MM-DD)")
    period_end: str = Field(..., description="Data fine periodo (YYYY-MM-DD)")
    role: Optional[str] = Field(None, description="Ruolo (PG, SG, SF, PF, C)")
    category: Optional[str] = Field(None, description="Categoria/campionato")
    availability: Availability = Field(..., description="Stato disponibilità")
    workload: WorkloadMetrics = Field(..., description="Metriche di carico")
    load_trend: LoadTrend = Field(..., description="Trend del carico")
    subjective: Optional[SubjectiveIndicators] = Field(None, description="Indicatori soggettivi")
    observations: list[str] = Field(default_factory=list, description="Osservazioni (max 3)")
    suggestion: str = Field(..., description="Suggerimento operativo per il preparatore")
    status: AthleteStatus = Field(..., description="Classificazione semaforo")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeamSummary(BaseModel):
    """
    Sintesi collettiva della squadra per una settimana.
    Generata da LLM + RAG + dati aggregati.
    """
    type: str = Field(default="team_summary", description="Tipo di output")
    week_number: int = Field(..., description="Numero settimana")
    period_start: str = Field(..., description="Data inizio periodo")
    period_end: str = Field(..., description="Data fine periodo")
    sessions_completed: int = Field(..., ge=0, description="Sessioni completate")
    sessions_planned: int = Field(..., ge=0, description="Sessioni programmate")
    matches_played: int = Field(default=0, ge=0, description="Partite disputate")
    avg_weekly_load: float = Field(..., ge=0, description="Carico medio settimanale squadra (AU)")
    load_trend_vs_previous: str = Field(..., description="Trend vs settimana precedente (es. '+12%')")
    athletes_acwr_above_13: list[str] = Field(default_factory=list, description="Atleti con ACWR > 1.3")
    athletes_monotony_above_2: list[str] = Field(default_factory=list, description="Atleti con monotonia > 2.0")
    fully_available: int = Field(..., ge=0, description="Atleti pienamente disponibili")
    total_athletes: int = Field(..., ge=0, description="Totale atleti nel roster")
    priority_alerts: list[str] = Field(default_factory=list, description="Segnalazioni prioritarie (max 3)")
    staff_note: str = Field(..., description="Nota operativa per lo staff")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DailyReport(BaseModel):
    """
    Report giornaliero della sessione di allenamento.
    Generato da LLM + RAG + template strutturato.
    """
    type: str = Field(default="daily_report", description="Tipo di output")
    date: str = Field(..., description="Data della sessione (YYYY-MM-DD)")
    session_type: str = Field(..., description="Tipo di sessione")
    duration_minutes: int = Field(..., ge=0, description="Durata sessione (minuti)")
    season_phase: Optional[str] = Field(None, description="Fase della stagione")
    avg_rpe: Optional[float] = Field(None, ge=0, le=10, description="RPE media squadra")
    avg_srpe: Optional[float] = Field(None, ge=0, description="sRPE media (AU)")
    athletes_present: int = Field(..., ge=0, description="Atleti presenti")
    athletes_total: int = Field(..., ge=0, description="Atleti totali")
    high_load_athletes: list[str] = Field(default_factory=list, description="Atleti con RPE ≥ 7")
    alerts: list[str] = Field(default_factory=list, description="Segnalazioni")
    notes: list[str] = Field(default_factory=list, description="Note operative (max 3)")
    report_text: str = Field(..., description="Report testuale completo")
    disclaimer: str = Field(
        default="Questo output è uno strumento di supporto. Non sostituisce il giudizio "
                "professionale dello staff tecnico-sanitario. Le decisioni cliniche e "
                "operative restano di responsabilità del professionista.",
        description="Disclaimer obbligatorio"
    )
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WeeklyReport(BaseModel):
    """
    Report settimanale aggregato.
    Generato da LLM + RAG + template + dati storici.
    """
    type: str = Field(default="weekly_report", description="Tipo di output")
    week_number: int = Field(..., description="Numero settimana")
    period_start: str = Field(..., description="Data inizio")
    period_end: str = Field(..., description="Data fine")
    season_phase: Optional[str] = Field(None, description="Fase stagione")
    microcycle_type: Optional[str] = Field(None, description="Tipo microciclo")
    total_team_load: float = Field(..., ge=0, description="Carico totale squadra (AU media)")
    sessions_completed: int = Field(..., ge=0)
    sessions_planned: int = Field(..., ge=0)
    load_change_pct: Optional[float] = Field(None, description="Variazione % vs settimana precedente")
    avg_acwr: Optional[float] = Field(None, description="ACWR medio squadra")
    avg_monotony: Optional[float] = Field(None, description="Monotonia media")
    athletes_in_sweet_spot: int = Field(default=0, ge=0, description="Atleti con ACWR 0.8-1.3")
    green_athletes: list[str] = Field(default_factory=list, description="Atleti in condizione ottimale")
    yellow_athletes: list[str] = Field(default_factory=list, description="Atleti in monitoraggio")
    red_athletes: list[str] = Field(default_factory=list, description="Atleti in attenzione")
    matches: list[str] = Field(default_factory=list, description="Partite disputate")
    next_week_objective: Optional[str] = Field(None, description="Obiettivo settimana entrante")
    next_week_notes: Optional[str] = Field(None, description="Note per settimana entrante")
    report_text: str = Field(..., description="Report testuale completo")
    disclaimer: str = Field(
        default="Questo output è uno strumento di supporto. Non sostituisce il giudizio "
                "professionale dello staff tecnico-sanitario. Le decisioni cliniche e "
                "operative restano di responsabilità del professionista.",
        description="Disclaimer obbligatorio"
    )
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StaffNote(BaseModel):
    """
    Nota tecnica breve per lo staff.
    Generata da LLM + RAG. Testo libero corto.
    """
    type: str = Field(default="staff_note", description="Tipo di output")
    context: str = Field(..., description="Contesto della nota (es. 'post-partita', 'pre-allenamento')")
    content: str = Field(..., max_length=500, description="Contenuto della nota (max 500 caratteri)")
    related_athletes: list[str] = Field(default_factory=list, description="Atleti coinvolti")
    priority: AlertLevel = Field(default=AlertLevel.INFO, description="Priorità della nota")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# DISCLAIMER COSTANTE
# =============================================================================

DISCLAIMER_TEXT = (
    "Questo output è uno strumento di supporto. Non sostituisce il giudizio "
    "professionale dello staff tecnico-sanitario. Le decisioni cliniche e "
    "operative restano di responsabilità del professionista."
)
