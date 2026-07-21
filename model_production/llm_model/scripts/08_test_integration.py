"""
scripts/08_test_integration.py
==============================
STEP 8: Test di integrazione end-to-end

Testa la pipeline completa: query → retrieval → rerank → LLM → output validato.
Verifica che tutti i componenti funzionino insieme correttamente.

Esecuzione:
    python scripts/08_test_integration.py

    # Solo test RAG (senza LLM):
    python scripts/08_test_integration.py --rag-only

    # Con provider specifico:
    python scripts/08_test_integration.py --provider openai

Prerequisiti:
    - Steps 1-3 completati (KB indicizzata in Qdrant)
    - LLM accessibile (OpenAI o vLLM)

Output:
    Report di test a schermo con risultati per ogni scenario
"""

import argparse
import json
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from config.settings import settings

console = Console()


# =============================================================================
# SCENARI DI TEST
# =============================================================================

TEST_SCENARIOS = [
    {
        "name": "Alert ACWR alto",
        "query": "L'atleta A03 ha ACWR 1.6 da 2 giorni. Cosa suggerisci?",
        "expected_keywords": ["ACWR", "1.5", "carico", "ridurre"],
        "expected_type": "alert_workload",
        "user_data": {
            "athlete_id": "A03",
            "acwr": 1.6,
            "days_above_threshold": 2,
            "threshold": 1.5,
            "request": "Genera alert workload",
        },
    },
    {
        "name": "Sintesi atleta",
        "query": "Genera una sintesi per l'atleta A07, PF, ACWR 1.1, monotonia 1.3, settimana stabile",
        "expected_keywords": ["sweet spot", "A07", "monotonia"],
        "expected_type": "athlete_summary",
        "user_data": {
            "athlete_id": "A07",
            "role": "PF",
            "acwr": 1.1,
            "monotony": 1.3,
            "weekly_load": 2600,
            "sleep": 7,
            "readiness": 8,
            "request": "Genera sintesi atleta",
        },
    },
    {
        "name": "Domanda tecnica su RPE",
        "query": "Quando va raccolta la RPE dopo l'allenamento?",
        "expected_keywords": ["30 minuti", "dopo", "sessione"],
        "expected_type": None,
    },
    {
        "name": "Domanda su monotonia",
        "query": "La monotonia del giocatore è 2.3 da una settimana. È preoccupante?",
        "expected_keywords": ["monotonia", "2.0", "rischio", "variazione"],
        "expected_type": None,
    },
    {
        "name": "Rifiuto fuori scope (diagnosi)",
        "query": "L'atleta A05 ha dolore al ginocchio, cosa potrebbe essere?",
        "expected_keywords": ["fuori", "ambito", "medico", "staff"],
        "expected_type": None,
    },
]


def test_retrieval_only():
    """Testa solo il componente di retrieval (senza LLM)."""
    
    console.print("\n[bold]🔍 Test Retrieval (RAG only)...[/bold]\n")
    
    from src.embedder import KBEmbedder
    from src.vectordb import VectorDBClient
    
    embedder = KBEmbedder(model_name=settings.EMBED_MODEL, device=settings.EMBED_DEVICE)
    
    try:
        vectordb = VectorDBClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
            collection_name=settings.KB_COLLECTION_NAME,
        )
    except Exception as e:
        console.print(f"[red]❌ Qdrant non raggiungibile: {e}[/red]")
        return False
    
    # Verifica collection
    info = vectordb.get_collection_info()
    if "error" in info:
        console.print(f"[red]❌ Collection non trovata: {info['error']}[/red]")
        return False
    
    console.print(f"   Collection: {info['name']} ({info['points_count']} punti)")
    
    # Test queries
    table = Table(title="Risultati Retrieval")
    table.add_column("Query", style="bold", max_width=40)
    table.add_column("Risultati", justify="center")
    table.add_column("Top Score", justify="center")
    table.add_column("Top Source", max_width=25)
    
    all_passed = True
    
    for scenario in TEST_SCENARIOS:
        query = scenario["query"]
        
        # Genera embedding della query
        query_embedding = embedder.embed_query(query)
        
        # Ricerca
        results = vectordb.search(query_embedding, top_k=5)
        
        if results:
            top_score = f"{results[0]['score']:.3f}"
            top_source = results[0]["metadata"]["source"]
            table.add_row(
                query[:40],
                str(len(results)),
                top_score,
                top_source,
            )
        else:
            table.add_row(query[:40], "0", "N/A", "N/A")
            all_passed = False
    
    console.print(table)
    return all_passed


def test_full_pipeline(provider: str):
    """Testa la pipeline completa: retrieval + LLM + validazione."""
    
    console.print(f"\n[bold]🧪 Test Pipeline Completa (provider: {provider})...[/bold]\n")
    
    from src.llm_client import LLMClient
    
    # Inizializza LLM client
    if provider == "vllm":
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
    
    # Health check
    console.print("   Health check LLM...")
    try:
        healthy = llm_client.health_check()
        if not healthy:
            console.print("[yellow]⚠️  LLM ha risposto ma non nel formato atteso[/yellow]")
    except Exception as e:
        console.print(f"[red]❌ LLM non raggiungibile: {e}[/red]")
        return False
    
    console.print("[green]   ✅ LLM operativo[/green]")
    
    # Inizializza retriever (opzionale)
    retriever = None
    try:
        from src.retriever import RAGRetriever
        retriever = RAGRetriever()
        console.print("[green]   ✅ Retriever operativo[/green]")
    except Exception as e:
        console.print(f"[yellow]   ⚠️  Retriever non disponibile: {e}[/yellow]")
    
    # Carica system prompt
    import yaml
    prompt_file = PROJECT_ROOT / "prompts" / "system_coach.yaml"
    with open(prompt_file, "r", encoding="utf-8") as f:
        prompt_data = yaml.safe_load(f)
    system_prompt = prompt_data["prompt"]
    
    # Esegui test
    table = Table(title="Risultati Pipeline End-to-End")
    table.add_column("Scenario", style="bold", max_width=25)
    table.add_column("Status", justify="center")
    table.add_column("Latenza", justify="right")
    table.add_column("Keywords", justify="center")
    table.add_column("Note", max_width=30)
    
    total_passed = 0
    total_tests = 0
    
    for scenario in TEST_SCENARIOS:
        total_tests += 1
        name = scenario["name"]
        
        # Prepara contesto RAG (se disponibile)
        context = ""
        if retriever:
            context = retriever.retrieve_with_context(scenario["query"], top_k=3)
        
        # Prepara messaggi
        user_content = scenario["query"]
        if "user_data" in scenario:
            user_content = json.dumps(scenario["user_data"], ensure_ascii=False)
        
        messages = [
            {"role": "system", "content": system_prompt},
        ]
        
        if context:
            messages.append({"role": "system", "content": f"CONTESTO KB:\n{context}"})
        
        messages.append({"role": "user", "content": user_content})
        
        # Genera risposta
        try:
            start = time.time()
            response = llm_client.generate(messages=messages, temperature=0.0)
            latency = (time.time() - start) * 1000
            
            output = response["content"]
            
            # Verifica keywords attese
            keywords_found = sum(
                1 for kw in scenario["expected_keywords"]
                if kw.lower() in output.lower()
            )
            keywords_total = len(scenario["expected_keywords"])
            keywords_pct = keywords_found / keywords_total * 100
            
            # Determina status
            if keywords_pct >= 50:
                status = "[green]✅ PASS[/green]"
                total_passed += 1
            else:
                status = "[yellow]⚠️ PARTIAL[/yellow]"
            
            table.add_row(
                name,
                status,
                f"{latency:.0f}ms",
                f"{keywords_found}/{keywords_total}",
                output[:30] + "...",
            )
            
        except Exception as e:
            table.add_row(name, "[red]❌ FAIL[/red]", "N/A", "N/A", str(e)[:30])
    
    console.print(table)
    
    # Riepilogo
    pct = total_passed / total_tests * 100
    color = "green" if pct >= 80 else "yellow" if pct >= 60 else "red"
    console.print(f"\n   [{color}]Risultato: {total_passed}/{total_tests} scenari passati ({pct:.0f}%)[/{color}]")
    
    return pct >= 60


def main():
    """Entry point: test di integrazione."""
    
    parser = argparse.ArgumentParser(description="Test integrazione TrainMindAI")
    parser.add_argument("--rag-only", action="store_true", help="Testa solo retrieval")
    parser.add_argument("--provider", choices=["openai", "vllm"], default=settings.LLM_PROVIDER)
    args = parser.parse_args()
    
    console.print(Panel.fit(
        "[bold blue]STEP 8 — Test Integrazione End-to-End[/bold blue]\n"
        f"Mode: {'RAG only' if args.rag_only else 'Pipeline completa'}\n"
        f"Provider: {args.provider}\n"
        f"Scenari: {len(TEST_SCENARIOS)}",
        title="TrainMindAI Pipeline"
    ))
    
    # Test retrieval
    rag_ok = test_retrieval_only()
    
    if args.rag_only:
        if rag_ok:
            console.print("\n[green]✅ Test retrieval superato![/green]")
        else:
            console.print("\n[red]❌ Test retrieval fallito. Verifica Qdrant e indicizzazione.[/red]")
        return
    
    # Test pipeline completa
    pipeline_ok = test_full_pipeline(args.provider)
    
    # Risultato finale
    if rag_ok and pipeline_ok:
        console.print(Panel.fit(
            "[bold green]✅ Test integrazione superati![/bold green]\n"
            "La pipeline è funzionante end-to-end.",
            title="Risultato Finale"
        ))
    else:
        console.print(Panel.fit(
            "[bold yellow]⚠️  Alcuni test non superati.[/bold yellow]\n"
            "Verificare i componenti segnalati.",
            title="Risultato Finale"
        ))


if __name__ == "__main__":
    main()
