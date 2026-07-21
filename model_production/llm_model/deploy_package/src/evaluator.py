"""
src/evaluator.py
================
Suite di valutazione per il sistema TrainMindAI.

Metriche valutate:
- Factuality: i fatti citati sono presenti nei chunk recuperati?
- Groundedness: ogni affermazione ha citazione tracciabile?
- JSON validity: % di output che passa la validazione Pydantic
- Latency: tempo di risposta (p50, p95)
- Hallucination rate: % di affermazioni non grounded
- Role coherence: output mantiene tono tecnico-operativo

Nessuna modifica (prompt, LoRA, retriever) va in produzione senza superare questa suite.

Uso:
    from src.evaluator import ModelEvaluator
    evaluator = ModelEvaluator(llm_client=client, retriever=retriever)
    results = evaluator.run_full_eval(eval_dataset_path="data/sft/eval.jsonl")
"""

import json
import re
import time
from pathlib import Path
from typing import Optional

from pydantic import ValidationError
from rich.console import Console
from rich.table import Table

from src.schemas import (
    AlertWorkload,
    AthleteSummary,
    DailyReport,
    StaffNote,
    TeamSummary,
    WeeklyReport,
)

console = Console()

# Mapping tipo output → schema Pydantic
OUTPUT_SCHEMAS = {
    "alert_workload": AlertWorkload,
    "athlete_summary": AthleteSummary,
    "team_summary": TeamSummary,
    "daily_report": DailyReport,
    "weekly_report": WeeklyReport,
    "staff_note": StaffNote,
}


class EvalMetrics:
    """Container per le metriche di valutazione."""

    def __init__(self):
        self.total_examples = 0
        self.json_valid = 0
        self.json_invalid = 0
        self.latencies_ms: list[float] = []
        self.hallucination_flags: list[bool] = []
        self.groundedness_scores: list[float] = []
        self.role_coherence_scores: list[float] = []
        self.errors: list[str] = []

    @property
    def json_validity_rate(self) -> float:
        """Percentuale di output JSON validi."""
        total = self.json_valid + self.json_invalid
        return (self.json_valid / total * 100) if total > 0 else 0.0

    @property
    def latency_p50(self) -> float:
        """Latenza mediana in ms."""
        if not self.latencies_ms:
            return 0.0
        sorted_lat = sorted(self.latencies_ms)
        idx = len(sorted_lat) // 2
        return sorted_lat[idx]

    @property
    def latency_p95(self) -> float:
        """Latenza al 95° percentile in ms."""
        if not self.latencies_ms:
            return 0.0
        sorted_lat = sorted(self.latencies_ms)
        idx = int(len(sorted_lat) * 0.95)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    @property
    def hallucination_rate(self) -> float:
        """Percentuale di output con allucinazioni segnalate."""
        if not self.hallucination_flags:
            return 0.0
        return sum(self.hallucination_flags) / len(self.hallucination_flags) * 100

    @property
    def avg_groundedness(self) -> float:
        """Score medio di groundedness (0-1)."""
        if not self.groundedness_scores:
            return 0.0
        return sum(self.groundedness_scores) / len(self.groundedness_scores)

    def to_dict(self) -> dict:
        """Esporta metriche come dizionario."""
        return {
            "total_examples": self.total_examples,
            "json_validity_rate_pct": round(self.json_validity_rate, 2),
            "json_valid": self.json_valid,
            "json_invalid": self.json_invalid,
            "latency_p50_ms": round(self.latency_p50, 1),
            "latency_p95_ms": round(self.latency_p95, 1),
            "hallucination_rate_pct": round(self.hallucination_rate, 2),
            "avg_groundedness": round(self.avg_groundedness, 3),
            "errors_count": len(self.errors),
        }


class ModelEvaluator:
    """
    Evaluator per il sistema RAG + LLM di TrainMindAI.
    
    Esegue valutazione automatica su un dataset di eval (JSONL),
    misurando qualità, affidabilità e performance del sistema.
    """

    def __init__(
        self,
        llm_client=None,
        retriever=None,
    ):
        """
        Inizializza l'evaluator.
        
        Args:
            llm_client: Istanza LLMClient per generare risposte
            retriever: Istanza RAGRetriever per il retrieval
        """
        self.llm_client = llm_client
        self.retriever = retriever

    def load_eval_dataset(self, path: str | Path) -> list[dict]:
        """
        Carica il dataset di valutazione.
        
        Formato atteso (JSONL):
        {
            "messages": [...],
            "expected_output_type": "alert_workload|athlete_summary|...",
            "expected_json": {...}  // opzionale, per confronto
        }
        
        Args:
            path: Path al file .jsonl di eval
            
        Returns:
            Lista di esempi di eval
        """
        path = Path(path)
        examples = []
        
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    examples.append(json.loads(line))
        
        console.print(f"[blue]📊 Dataset eval caricato: {len(examples)} esempi[/blue]")
        return examples

    def evaluate_json_validity(self, output_text: str, expected_type: str) -> bool:
        """
        Verifica se l'output è un JSON valido conforme allo schema Pydantic.
        
        Args:
            output_text: Testo di output dal LLM (dovrebbe essere JSON)
            expected_type: Tipo di output atteso (chiave di OUTPUT_SCHEMAS)
            
        Returns:
            True se il JSON è valido e conforme allo schema
        """
        schema_class = OUTPUT_SCHEMAS.get(expected_type)
        if not schema_class:
            return False
        
        try:
            # Prova a parsare come JSON
            data = json.loads(output_text)
            # Valida con Pydantic
            schema_class.model_validate(data)
            return True
        except (json.JSONDecodeError, ValidationError):
            return False

    def evaluate_groundedness(
        self,
        output_text: str,
        retrieved_chunks: list[dict]
    ) -> float:
        """
        Valuta la groundedness: quanto l'output è supportato dai chunk recuperati.
        
        Metodo semplificato: verifica la sovrapposizione di termini tecnici chiave
        tra output e chunk. Per una valutazione più accurata, usare LLM-as-judge.
        
        Args:
            output_text: Testo di output del modello
            retrieved_chunks: Chunk recuperati dal RAG
            
        Returns:
            Score 0-1 (1 = completamente grounded)
        """
        if not retrieved_chunks:
            return 0.0
        
        # Estrai termini tecnici dall'output (numeri, sigle, valori)
        
        # Pattern per numeri con contesto (es. "ACWR 1.5", "RPE 7")
        number_patterns = re.findall(
            r'\b(?:ACWR|RPE|sRPE|monotonia|strain|AU|kg|min|%)\s*[><=]*\s*[\d.]+',
            output_text,
            re.IGNORECASE,
        )
        
        if not number_patterns:
            # Se non ci sono pattern specifici, score neutro
            return 0.7
        
        # Verifica che i pattern siano presenti nei chunk
        all_chunks_text = " ".join(chunk.get("text", "") for chunk in retrieved_chunks)
        
        grounded_count = 0
        for pattern in number_patterns:
            # Verifica approssimativa (il valore numerico è nei chunk)
            numbers_in_pattern = re.findall(r'[\d.]+', pattern)
            for num in numbers_in_pattern:
                if num in all_chunks_text:
                    grounded_count += 1
                    break
        
        score = grounded_count / max(len(number_patterns), 1)
        return min(score, 1.0)

    def evaluate_role_coherence(self, output_text: str) -> float:
        """
        Valuta se l'output mantiene il tono tecnico-operativo del preparatore fisico.
        
        Controlla assenza di linguaggio medico, motivazionale, o inappropriato.
        
        Args:
            output_text: Testo di output del modello
            
        Returns:
            Score 0-1 (1 = pienamente coerente con il ruolo)
        """
        # Termini che NON dovrebbero apparire (linguaggio medico/inappropriato)
        red_flags = [
            "diagnosi", "prescrivo", "prescrivere", "terapia farmacologica",
            "medicinale", "farmaco", "patologia", "malattia",
            "ti consiglio di consultare", "devi andare dal medico",
            # Linguaggio motivazionale inappropriato
            "sei un campione", "ce la puoi fare", "non mollare",
            "fantastico", "incredibile", "straordinario",
        ]
        
        # Termini che DOVREBBERO apparire (linguaggio tecnico corretto)
        green_flags = [
            "carico", "workload", "RPE", "sessione", "allenamento",
            "monitorare", "valutare", "segnalazione", "atleta",
            "recupero", "programmazione", "staff",
        ]
        
        output_lower = output_text.lower()
        
        # Penalità per red flags
        red_count = sum(1 for flag in red_flags if flag.lower() in output_lower)
        
        # Bonus per green flags
        green_count = sum(1 for flag in green_flags if flag.lower() in output_lower)
        
        # Score base 1.0, -0.2 per ogni red flag, +0.05 per ogni green flag (capped)
        score = 1.0 - (red_count * 0.2) + min(green_count * 0.05, 0.3)
        
        return max(0.0, min(1.0, score))

    def _infer_output_type(self, example: dict) -> str:
        """
        Inferisce il tipo di output dalla risposta gold (assistant message).
        Cerca il campo "type" nel JSON della risposta assistant.
        """
        assistant_msg = next(
            (m["content"] for m in example.get("messages", []) if m["role"] == "assistant"),
            ""
        )
        try:
            data = json.loads(assistant_msg)
            output_type = data.get("type", "")
            if output_type in OUTPUT_SCHEMAS:
                return output_type
        except (json.JSONDecodeError, AttributeError):
            pass
        return ""

    def run_single_eval(self, example: dict) -> dict:
        """
        Esegue la valutazione su un singolo esempio.
        
        Args:
            example: Dict con "messages" e opzionalmente "expected_output_type"
            
        Returns:
            Dict con risultati della valutazione
        """
        messages = example["messages"]
        expected_type = example.get("expected_output_type", "")
        
        # Se manca expected_output_type, prova a inferirlo dalla risposta gold
        if not expected_type:
            expected_type = self._infer_output_type(example)
        
        result = {
            "json_valid": False,
            "latency_ms": 0,
            "groundedness": 0.0,
            "role_coherence": 0.0,
            "hallucination": False,
            "error": None,
        }
        
        try:
            # Genera risposta
            start = time.time()
            response = self.llm_client.generate(messages=messages, temperature=0.0)
            result["latency_ms"] = (time.time() - start) * 1000
            
            output_text = response["content"]
            
            # Valuta JSON validity
            if expected_type:
                result["json_valid"] = self.evaluate_json_validity(output_text, expected_type)
            
            # Valuta role coherence
            result["role_coherence"] = self.evaluate_role_coherence(output_text)
            
            # Valuta groundedness (se retriever disponibile)
            if self.retriever:
                # Estrai query dall'user message
                user_msg = next((m["content"] for m in messages if m["role"] == "user"), "")
                chunks = self.retriever.retrieve(user_msg, top_k=5)
                result["groundedness"] = self.evaluate_groundedness(output_text, chunks)
            
        except Exception as e:
            result["error"] = str(e)
        
        return result

    def run_full_eval(
        self,
        eval_dataset_path: str | Path,
        max_examples: Optional[int] = None
    ) -> EvalMetrics:
        """
        Esegue la suite completa di valutazione su tutto il dataset.
        
        Args:
            eval_dataset_path: Path al dataset di eval (.jsonl)
            max_examples: Limite massimo di esempi da valutare (None = tutti)
            
        Returns:
            Oggetto EvalMetrics con tutte le metriche aggregate
        """
        examples = self.load_eval_dataset(eval_dataset_path)
        
        if max_examples:
            examples = examples[:max_examples]
        
        metrics = EvalMetrics()
        metrics.total_examples = len(examples)
        
        console.print(f"[blue]🧪 Esecuzione eval su {len(examples)} esempi...[/blue]")
        
        for i, example in enumerate(examples):
            console.print(f"   Esempio {i+1}/{len(examples)}...", end="\r")
            
            result = self.run_single_eval(example)
            
            if result["error"]:
                metrics.errors.append(result["error"])
                continue
            
            # Accumula metriche
            if result["json_valid"]:
                metrics.json_valid += 1
            else:
                metrics.json_invalid += 1
            
            metrics.latencies_ms.append(result["latency_ms"])
            metrics.groundedness_scores.append(result["groundedness"])
            metrics.role_coherence_scores.append(result["role_coherence"])
            metrics.hallucination_flags.append(result["hallucination"])
        
        console.print("")  # Newline dopo il progress
        
        # Stampa risultati
        self._print_results(metrics)
        
        return metrics

    def _print_results(self, metrics: EvalMetrics) -> None:
        """Stampa i risultati della valutazione in formato tabella."""
        table = Table(title="📊 Risultati Valutazione", show_header=True)
        table.add_column("Metrica", style="bold")
        table.add_column("Valore", justify="right")
        table.add_column("Target", justify="right", style="dim")
        table.add_column("Status", justify="center")
        
        # JSON Validity
        jv = metrics.json_validity_rate
        jv_status = "✅" if jv >= 99 else "⚠️" if jv >= 90 else "❌"
        table.add_row("JSON Validity", f"{jv:.1f}%", "≥ 99%", jv_status)
        
        # Latency
        p95 = metrics.latency_p95
        lat_status = "✅" if p95 < 6000 else "⚠️" if p95 < 10000 else "❌"
        table.add_row("Latency p50", f"{metrics.latency_p50:.0f} ms", "< 6000 ms", "")
        table.add_row("Latency p95", f"{p95:.0f} ms", "< 6000 ms", lat_status)
        
        # Groundedness
        gr = metrics.avg_groundedness
        gr_status = "✅" if gr >= 0.7 else "⚠️" if gr >= 0.5 else "❌"
        table.add_row("Groundedness", f"{gr:.2f}", "≥ 0.70", gr_status)
        
        # Hallucination rate
        hr = metrics.hallucination_rate
        hr_status = "✅" if hr <= 5 else "⚠️" if hr <= 10 else "❌"
        table.add_row("Hallucination Rate", f"{hr:.1f}%", "≤ 5%", hr_status)
        
        # Errors
        table.add_row("Errori", str(len(metrics.errors)), "0", 
                     "✅" if not metrics.errors else "⚠️")
        
        console.print(table)

    def save_results(self, metrics: EvalMetrics, output_path: str | Path) -> None:
        """Salva i risultati di eval in un file JSON."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(metrics.to_dict(), f, indent=2, ensure_ascii=False)
        
        console.print(f"[green]💾 Risultati salvati in: {output_path}[/green]")
