"""
scripts/07_serve_model.py
=========================
STEP 7: Serving del modello con vLLM

Avvia il modello con vLLM, esponendo un endpoint OpenAI-compatible.
Supporta il caricamento di adapter LoRA per il modello fine-tunato.

IMPORTANTE: Richiede GPU con almeno 24GB VRAM.

Esecuzione (locale con GPU):
    python scripts/07_serve_model.py

Esecuzione su RunPod (consigliata):
    Vedi le istruzioni nella sezione "Deployment su RunPod" sotto.

Endpoint risultante:
    http://localhost:8000/v1/chat/completions (OpenAI-compatible)

Prerequisiti:
    - vLLM installato (pip install vllm)
    - GPU NVIDIA con CUDA
    - VRAM ≥ 24GB per Mistral Small 24B in 4-bit
    - (Opzionale) Adapter LoRA in outputs/lora/adapter/

Output:
    Server vLLM in esecuzione su localhost:8000
"""

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel

from config.settings import settings

console = Console()


def check_vllm_installed() -> bool:
    """Verifica che vLLM sia installato."""
    try:
        import vllm
        console.print(f"[green]✅ vLLM versione: {vllm.__version__}[/green]")
        return True
    except ImportError:
        console.print("[red]❌ vLLM non installato.[/red]")
        console.print("   Installa con: pip install vllm")
        console.print("   (richiede CUDA e GPU NVIDIA)")
        return False


def build_vllm_command() -> list[str]:
    """Costruisce il comando per avviare vLLM."""
    
    cmd = [
        sys.executable, "-m", "vllm.entrypoints.openai.api_server",
        "--model", settings.LLM_MODEL,
        "--host", "0.0.0.0",
        "--port", "8000",
        "--max-model-len", "8192",
        "--dtype", "auto",
        "--trust-remote-code",
    ]
    
    # Aggiungi quantizzazione se il modello lo supporta
    # Per Mistral Small 24B, usiamo AWQ per ridurre VRAM
    cmd.extend(["--quantization", "awq"])
    
    # Aggiungi adapter LoRA se disponibile
    adapter_path = settings.lora_dir / "adapter"
    if adapter_path.exists():
        cmd.extend([
            "--enable-lora",
            "--lora-modules", f"trainmind={adapter_path}",
            "--max-lora-rank", str(settings.LORA_RANK),
        ])
        console.print(f"[green]✅ LoRA adapter trovato: {adapter_path}[/green]")
    else:
        console.print(f"[yellow]ℹ️  Nessun adapter LoRA trovato in {adapter_path}[/yellow]")
        console.print("   Il modello verrà servito senza LoRA (modello base).")
    
    # Token HF per modelli gated
    if settings.HF_TOKEN:
        cmd.extend(["--token", settings.HF_TOKEN])
    
    return cmd


def print_runpod_instructions():
    """Stampa istruzioni per deployment su RunPod."""
    
    adapter_path = settings.lora_dir / "adapter"
    lora_flag = ""
    if adapter_path.exists():
        lora_flag = f" --enable-lora --lora-modules trainmind=/workspace/lora"
    
    console.print(Panel.fit(
        "[bold yellow]📋 Deployment su RunPod (consigliato)[/bold yellow]\n\n"
        "[bold]1. Crea un pod su RunPod:[/bold]\n"
        "   - Template: vLLM (runpod/vllm)\n"
        "   - GPU: A10 24GB o L4 24GB\n"
        "   - Storage: 50GB\n\n"
        "[bold]2. Configura il modello:[/bold]\n"
        f"   MODEL_NAME={settings.LLM_MODEL}\n"
        f"   QUANTIZATION=awq\n"
        f"   MAX_MODEL_LEN=8192\n\n"
        "[bold]3. (Se hai LoRA) Carica l'adapter:[/bold]\n"
        "   Upload outputs/lora/adapter/ su /workspace/lora/\n\n"
        "[bold]4. Comando avvio:[/bold]\n"
        f"   vllm serve {settings.LLM_MODEL} \\\n"
        f"     --quantization awq \\\n"
        f"     --max-model-len 8192 \\\n"
        f"     --port 8000{lora_flag}\n\n"
        "[bold]5. Configura .env nell'app:[/bold]\n"
        "   LLM_PROVIDER=vllm\n"
        "   LLM_BASE_URL=https://your-pod-id-8000.proxy.runpod.net/v1\n"
        "   LLM_MODEL=trainmind  # nome del LoRA module",
        title="Istruzioni RunPod"
    ))


def main():
    """Entry point: avvio serving vLLM."""
    
    console.print(Panel.fit(
        "[bold blue]STEP 7 — Serving Modello con vLLM[/bold blue]\n"
        f"Modello: {settings.LLM_MODEL}\n"
        f"Endpoint: http://localhost:8000/v1\n"
        f"Adapter LoRA: {settings.lora_dir / 'adapter'}",
        title="TrainMindAI Pipeline"
    ))
    
    # Mostra sempre le istruzioni RunPod
    print_runpod_instructions()
    
    # Verifica se possiamo avviare localmente
    console.print("\n[bold]🔍 Verifica setup locale...[/bold]")
    
    if not check_vllm_installed():
        console.print("\n[yellow]Il serving locale non è disponibile.[/yellow]")
        console.print("Usa le istruzioni RunPod sopra per il deployment cloud.")
        sys.exit(0)
    
    # Verifica GPU
    try:
        import torch
        if not torch.cuda.is_available():
            console.print("[red]❌ CUDA non disponibile per serving locale.[/red]")
            console.print("   Usa RunPod per il deployment.")
            sys.exit(0)
    except ImportError:
        console.print("[red]❌ PyTorch/CUDA non configurato.[/red]")
        sys.exit(0)
    
    # Costruisci e mostra comando
    cmd = build_vllm_command()
    cmd_str = " ".join(cmd)
    
    console.print(f"\n[bold]🚀 Avvio vLLM...[/bold]")
    console.print(f"   Comando: {cmd_str}")
    console.print(f"\n   L'endpoint sarà disponibile su: http://localhost:8000/v1")
    console.print(f"   Premi Ctrl+C per interrompere.\n")
    
    # Avvia vLLM
    try:
        process = subprocess.run(cmd)
    except KeyboardInterrupt:
        console.print("\n[yellow]Server interrotto dall'utente.[/yellow]")
    except Exception as e:
        console.print(f"[red]❌ Errore avvio vLLM: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
