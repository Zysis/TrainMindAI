"""
scripts/05_train_lora.py
========================
STEP 5: Training QLoRA del modello

Addestra un adapter LoRA sul modello base (Mistral Small 24B) usando
il dataset SFT generato allo step 4. Usa QLoRA (4-bit) per ridurre
i requisiti VRAM a ~16GB.

IMPORTANTE: Richiede GPU NVIDIA con almeno 24GB VRAM.
Se non hai una GPU locale, usa RunPod / Vast.ai / Lambda.

Esecuzione:
    python scripts/05_train_lora.py

Prerequisiti:
    - Step 4 completato (data/sft/train.jsonl esiste)
    - GPU NVIDIA con CUDA 12.1+
    - VRAM ≥ 24GB (A10, L4, RTX 4090, A100)
    - Token Hugging Face configurato in .env (HF_TOKEN)

Output:
    outputs/lora/adapter/ — Adapter LoRA pronto per vLLM

Ri-eseguibile: Sì. Sovrascrive adapter precedente.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel

from config.settings import settings

console = Console()


def check_prerequisites() -> bool:
    """Verifica che i prerequisiti per il training siano soddisfatti."""
    
    # Verifica dataset
    train_path = settings.sft_dir / "train.jsonl"
    if not train_path.exists():
        console.print(f"[red]❌ Dataset non trovato: {train_path}[/red]")
        console.print("   Esegui prima: python scripts/04_generate_sft_dataset.py")
        return False
    
    # Verifica GPU
    try:
        import torch
        if not torch.cuda.is_available():
            console.print("[red]❌ CUDA non disponibile.[/red]")
            console.print("   Il training QLoRA richiede una GPU NVIDIA.")
            console.print("\n[yellow]💡 Alternative:[/yellow]")
            console.print("   - RunPod (https://www.runpod.io) — GPU A10 24GB ~$0.50/h")
            console.print("   - Vast.ai (https://vast.ai) — GPU variabili")
            console.print("   - Google Colab Pro — T4/A100")
            return False
        
        # Verifica VRAM
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        if vram_gb < 16:
            console.print(f"[yellow]⚠️  VRAM disponibile: {vram_gb:.1f} GB[/yellow]")
            console.print("   Consigliati almeno 24GB. Il training potrebbe fallire.")
        else:
            console.print(f"[green]✅ GPU: {torch.cuda.get_device_name(0)} ({vram_gb:.1f} GB VRAM)[/green]")
            
    except ImportError:
        console.print("[red]❌ PyTorch non installato o non configurato con CUDA.[/red]")
        return False
    
    # Verifica HF token
    if not settings.HF_TOKEN:
        console.print("[yellow]⚠️  HF_TOKEN non configurato in .env[/yellow]")
        console.print("   Potrebbe essere necessario per scaricare modelli gated.")
        console.print("   Ottienilo da: https://huggingface.co/settings/tokens")
    
    return True


def main():
    """Entry point: training QLoRA."""
    
    console.print(Panel.fit(
        "[bold blue]STEP 5 — Training QLoRA[/bold blue]\n"
        f"Modello base: {settings.TRAINING_MODEL}\n"
        f"LoRA rank: {settings.LORA_RANK}, alpha: {settings.LORA_ALPHA}\n"
        f"Epochs: {settings.TRAINING_EPOCHS}, LR: {settings.TRAINING_LR}\n"
        f"Batch: {settings.TRAINING_BATCH_SIZE} × {settings.TRAINING_GRAD_ACCUM} = "
        f"{settings.TRAINING_BATCH_SIZE * settings.TRAINING_GRAD_ACCUM} effective\n"
        f"Dataset: {settings.sft_dir / 'train.jsonl'}\n"
        f"Output: {settings.lora_dir}",
        title="TrainMindAI Pipeline"
    ))
    
    # Verifica prerequisiti
    console.print("\n[bold]🔍 Verifica prerequisiti...[/bold]")
    if not check_prerequisites():
        sys.exit(1)
    
    # Conta esempi nel dataset
    train_path = settings.sft_dir / "train.jsonl"
    with open(train_path, "r") as f:
        n_train = sum(1 for line in f if line.strip())
    
    eval_path = settings.sft_dir / "eval.jsonl"
    n_eval = 0
    if eval_path.exists():
        with open(eval_path, "r") as f:
            n_eval = sum(1 for line in f if line.strip())
    
    console.print(f"\n   Dataset training: {n_train} esempi")
    console.print(f"   Dataset eval: {n_eval} esempi")
    
    # Inizializza trainer
    console.print("\n[bold]🏋️ Avvio training...[/bold]")
    
    from src.trainer import LoRATrainer
    
    trainer = LoRATrainer(
        model_name=settings.TRAINING_MODEL,
        lora_rank=settings.LORA_RANK,
        lora_alpha=settings.LORA_ALPHA,
        learning_rate=settings.TRAINING_LR,
        num_epochs=settings.TRAINING_EPOCHS,
        batch_size=settings.TRAINING_BATCH_SIZE,
        gradient_accumulation_steps=settings.TRAINING_GRAD_ACCUM,
        hf_token=settings.HF_TOKEN if settings.HF_TOKEN else None,
    )
    
    trainer.print_training_config()
    
    # Esegui training
    adapter_path = trainer.train(
        dataset_path=train_path,
        eval_dataset_path=eval_path if eval_path.exists() else None,
        output_dir=settings.lora_dir,
    )
    
    console.print(Panel.fit(
        f"[green]✅ Training completato![/green]\n\n"
        f"Adapter LoRA salvato in: {adapter_path}\n\n"
        f"[bold]Per usare l'adapter con vLLM:[/bold]\n"
        f"  vllm serve {settings.TRAINING_MODEL} \\\n"
        f"    --lora-modules trainmind={adapter_path}\n\n"
        f"[bold]Per testare localmente:[/bold]\n"
        f"  python scripts/06_eval_model.py",
        title="Risultato"
    ))
    
    console.print("\n[dim]Prossimo step: python scripts/06_eval_model.py[/dim]")


if __name__ == "__main__":
    main()
