"""
scripts/06_eval_model.py
========================
STEP 6: Valutazione del modello

Esegue la suite di valutazione completa sul dataset di eval.
Misura: JSON validity, latenza, groundedness, hallucination rate, role coherence.

Nessuna modifica va in produzione senza superare questa suite.

Esecuzione:
    python scripts/06_eval_model.py

    # Con provider specifico:
    python scripts/06_eval_model.py --provider openai
    python scripts/06_eval_model.py --provider vllm

Prerequisiti:
    - Dataset eval: data/sft/eval.jsonl
    - LLM accessibile (OpenAI API o vLLM endpoint)
    - (Opzionale) Qdrant con KB indicizzata per groundedness

Output:
    outputs/eval/eval_results.json — Metriche aggregate

Ri-eseguibile: Sì. Rigenera le metriche.
"""

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel

from config.settings import settings

console = Console()


def parse_args():
    """Parsing argomenti da command line."""
    parser = argparse.ArgumentParser(description="Valutazione modello TrainMindAI")
    parser.add_argument(
        "--provider",
        choices=["openai", "vllm"],
        default=settings.LLM_PROVIDER,
        help="Provider LLM da usare per la valutazione"
    )
    parser.add_argument(
        "--max-examples",
        type=int,
        default=None,
        help="Limite massimo di esempi da valutare (default: tutti)"
    )
    parser.add_argument(
        "--no-retrieval",
        action="store_true",
        help="Disabilita valutazione groundedness (non richiede Qdrant)"
    )
    return parser.parse_args()


def main():
    """Entry point: esecuzione suite di valutazione."""
    args = parse_args()
    
    console.print(Panel.fit(
        "[bold blue]STEP 6 — Valutazione Modello[/bold blue]\n"
        f"Provider: {args.provider}\n"
        f"Dataset eval: {settings.sft_dir / 'eval.jsonl'}\n"
        f"Max examples: {args.max_examples or 'tutti'}\n"
        f"Groundedness: {'disabilitata' if args.no_retrieval else 'abilitata'}",
        title="TrainMindAI Pipeline"
    ))
    
    # Verifica dataset eval
    eval_path = settings.sft_dir / "eval.jsonl"
    if not eval_path.exists():
        console.print(f"[red]❌ Dataset eval non trovato: {eval_path}[/red]")
        console.print("   Esegui prima: python scripts/04_generate_sft_dataset.py")
        sys.exit(1)
    
    # Inizializza LLM client
    console.print("\n[bold]🤖 Inizializzazione LLM client...[/bold]")
    
    from src.llm_client import LLMClient
    
    if args.provider == "vllm":
        llm_client = LLMClient(
            provider="vllm",
            base_url=settings.LLM_BASE_URL,
            api_key=settings.LLM_API_KEY,
            model=settings.LLM_MODEL,
        )
    else:
        llm_client = LLMClient(
            provider="openai",
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
        )
    
    # Inizializza retriever (opzionale)
    retriever = None
    if not args.no_retrieval:
        try:
            from src.retriever import RAGRetriever
            retriever = RAGRetriever()
            console.print("[green]✅ Retriever inizializzato per valutazione groundedness[/green]")
        except Exception as e:
            console.print(f"[yellow]⚠️  Retriever non disponibile: {e}[/yellow]")
            console.print("   La valutazione groundedness sarà saltata.")
    
    # Esegui valutazione
    console.print("\n[bold]🧪 Esecuzione suite di valutazione...[/bold]")
    
    from src.evaluator import ModelEvaluator
    
    evaluator = ModelEvaluator(
        llm_client=llm_client,
        retriever=retriever,
    )
    
    metrics = evaluator.run_full_eval(
        eval_dataset_path=eval_path,
        max_examples=args.max_examples,
    )
    
    # Salva risultati
    output_dir = PROJECT_ROOT / "outputs" / "eval"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "eval_results.json"
    
    evaluator.save_results(metrics, output_file)
    
    # Criteri Go/No-Go
    console.print("\n[bold]📋 Criteri Go/No-Go:[/bold]")
    
    go_nogo = {
        "JSON Validity ≥ 99%": metrics.json_validity_rate >= 99,
        "Latency p95 < 6000ms": metrics.latency_p95 < 6000,
        "Hallucination ≤ 5%": metrics.hallucination_rate <= 5,
        "Groundedness ≥ 0.7": metrics.avg_groundedness >= 0.7,
    }
    
    all_passed = all(go_nogo.values())
    
    for criterion, passed in go_nogo.items():
        status = "[green]✅ PASS[/green]" if passed else "[red]❌ FAIL[/red]"
        console.print(f"   {status} — {criterion}")
    
    if all_passed:
        console.print(Panel.fit(
            "[bold green]🎉 GO — Tutti i criteri superati![/bold green]\n"
            "Il modello è pronto per la promozione in produzione.",
            title="Decisione"
        ))
    else:
        console.print(Panel.fit(
            "[bold red]🚫 NO-GO — Criteri non soddisfatti[/bold red]\n"
            "Rivedere il modello/prompt/retriever prima della promozione.",
            title="Decisione"
        ))
    
    console.print(f"\n[dim]Risultati completi: {output_file}[/dim]")
    console.print("[dim]Prossimo step: python scripts/07_serve_model.py[/dim]")


if __name__ == "__main__":
    main()
