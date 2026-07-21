"""
tests/test_schemas.py
=====================
Test unitari per gli schemi Pydantic di output.

Verifica che gli schemi validino correttamente gli output del sistema.

Esecuzione:
    pytest tests/test_schemas.py -v
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.schemas import (
    AlertCode,
    AlertLevel,
    AlertWorkload,
    AthleteSummary,
    Availability,
    DailyReport,
    LoadTrend,
    StaffNote,
    TeamSummary,
    WeeklyReport,
    WorkloadMetrics,
    AcwrZone,
    AthleteStatus,
    SubjectiveIndicators,
)


class TestAlertWorkload:
    """Test per lo schema AlertWorkload."""

    def test_valid_alert(self):
        """Verifica creazione di un alert valido."""
        alert = AlertWorkload(
            level=AlertLevel.WARNING,
            athlete_id="A03",
            code=AlertCode.ACWR_HIGH,
            value=1.52,
            threshold=1.5,
            message="ACWR sopra soglia",
            suggestion="Ridurre carico",
        )
        assert alert.type == "alert_workload"
        assert alert.level == AlertLevel.WARNING
        assert alert.value == 1.52

    def test_alert_json_serializable(self):
        """Verifica che l'alert sia serializzabile in JSON."""
        alert = AlertWorkload(
            level=AlertLevel.CRITICAL,
            athlete_id="A07",
            code=AlertCode.MONOTONIA_HIGH,
            value=2.5,
            threshold=2.0,
            message="Monotonia elevata",
            suggestion="Inserire variazione",
        )
        json_str = alert.model_dump_json()
        data = json.loads(json_str)
        assert data["level"] == "critical"
        assert data["code"] == "MONOTONIA_HIGH"

    def test_alert_from_json(self):
        """Verifica parsing di un alert da JSON (come farebbe il validator)."""
        json_data = {
            "type": "alert_workload",
            "level": "warning",
            "athlete_id": "A12",
            "code": "RPE_SPIKE",
            "value": 9.0,
            "threshold": 7.0,
            "message": "RPE spike",
            "suggestion": "Verificare cause",
            "timestamp": "2026-05-01T10:00:00",
        }
        alert = AlertWorkload.model_validate(json_data)
        assert alert.athlete_id == "A12"
        assert alert.code == AlertCode.RPE_SPIKE

    def test_invalid_alert_level(self):
        """Verifica che livelli non validi vengano rifiutati."""
        with pytest.raises(Exception):
            AlertWorkload(
                level="invalid_level",
                athlete_id="A01",
                code=AlertCode.ACWR_HIGH,
                value=1.5,
                threshold=1.5,
                message="test",
                suggestion="test",
            )


class TestAthleteSummary:
    """Test per lo schema AthleteSummary."""

    def test_valid_summary(self):
        """Verifica creazione di una sintesi atleta valida."""
        summary = AthleteSummary(
            athlete_id="A07",
            period_start="2026-03-11",
            period_end="2026-03-17",
            role="PF",
            category="Serie A2",
            availability=Availability.FULL,
            workload=WorkloadMetrics(
                acwr=1.22,
                acwr_zone=AcwrZone.SWEET_SPOT,
                monotony=1.4,
                weekly_load=2850,
            ),
            load_trend=LoadTrend.STABLE,
            observations=["Carico ben distribuito", "Nessun segnale di rischio"],
            suggestion="Mantenere programmazione attuale",
            status=AthleteStatus.GREEN,
        )
        assert summary.type == "athlete_summary"
        assert summary.availability == Availability.FULL
        assert summary.workload.acwr == 1.22

    def test_summary_with_subjective(self):
        """Verifica sintesi con indicatori soggettivi."""
        summary = AthleteSummary(
            athlete_id="A03",
            period_start="2026-03-11",
            period_end="2026-03-17",
            availability=Availability.PARTIAL,
            workload=WorkloadMetrics(acwr=1.48),
            load_trend=LoadTrend.INCREASING,
            subjective=SubjectiveIndicators(sleep=5, fatigue=8, readiness=4),
            observations=["ACWR in zona grigia"],
            suggestion="Ridurre carico",
            status=AthleteStatus.YELLOW,
        )
        assert summary.subjective.sleep == 5
        assert summary.subjective.fatigue == 8


class TestDailyReport:
    """Test per lo schema DailyReport."""

    def test_valid_daily_report(self):
        """Verifica creazione di un report giornaliero valido."""
        report = DailyReport(
            date="2026-03-15",
            session_type="Allenamento completo",
            duration_minutes=105,
            season_phase="In-season",
            avg_rpe=6.2,
            avg_srpe=651,
            athletes_present=11,
            athletes_total=13,
            high_load_athletes=["A03", "A11"],
            alerts=["A03: ACWR 1.48"],
            notes=["Sessione completata secondo programma"],
            report_text="REPORT GIORNALIERO — 15 Marzo 2026\n...",
        )
        assert report.type == "daily_report"
        assert report.athletes_present == 11
        assert "supporto" in report.disclaimer  # Disclaimer presente

    def test_daily_report_disclaimer_always_present(self):
        """Verifica che il disclaimer sia sempre presente."""
        report = DailyReport(
            date="2026-03-15",
            session_type="Test",
            duration_minutes=60,
            athletes_present=10,
            athletes_total=12,
            report_text="Test report",
        )
        assert "Non sostituisce" in report.disclaimer


class TestTeamSummary:
    """Test per lo schema TeamSummary."""

    def test_valid_team_summary(self):
        """Verifica creazione di una sintesi squadra valida."""
        summary = TeamSummary(
            week_number=12,
            period_start="2026-03-11",
            period_end="2026-03-17",
            sessions_completed=5,
            sessions_planned=5,
            matches_played=1,
            avg_weekly_load=2600,
            load_trend_vs_previous="+8%",
            athletes_acwr_above_13=["A03"],
            fully_available=11,
            total_athletes=13,
            priority_alerts=["A03 in zona grigia ACWR"],
            staff_note="Settimana gestita bene, monitorare A03",
        )
        assert summary.type == "team_summary"
        assert summary.matches_played == 1


class TestStaffNote:
    """Test per lo schema StaffNote."""

    def test_valid_staff_note(self):
        """Verifica creazione di una nota staff valida."""
        note = StaffNote(
            context="post-partita",
            content="A03 ha giocato 35 minuti, monitorare domani.",
            related_athletes=["A03"],
            priority=AlertLevel.INFO,
        )
        assert note.type == "staff_note"
        assert len(note.content) <= 500

    def test_staff_note_max_length(self):
        """Verifica che note troppo lunghe vengano rifiutate."""
        with pytest.raises(Exception):
            StaffNote(
                context="test",
                content="x" * 501,  # Oltre il max_length
            )
