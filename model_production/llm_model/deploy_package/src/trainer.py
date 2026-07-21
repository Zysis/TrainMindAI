"""
src/trainer.py
==============
Modulo per il training LoRA/QLoRA del modello.

Implementa il fine-tuning con Parameter-Efficient Fine-Tuning (PEFT):
- QLoRA: quantizzazione 4-bit + LoRA per ridurre VRAM a ~16GB
- Dataset in formato messages (chat template Mistral/Llama)
- Salva adapter LoRA separato (caricabile da vLLM con --lora-modules)

Richiede GPU con almeno 24GB VRAM (o 16GB con QLoRA aggressiva).
Su RunPod/Vast.ai: usare A10 24GB o L4 24GB.

Uso:
    from src.trainer import LoRATrainer
    trainer = LoRATrainer(model_name="mistralai/Mistral-Small-3.1-24B-Instruct-2503")
    trainer.train(dataset_path="data/sft/train.jsonl", output_dir="outputs/lora")
"""

import json
from pathlib import Path
from typing import Optional

from rich.console import Console

console = Console()


class LoRATrainer:
    """
    Trainer per QLoRA fine-tuning del modello base.
    
    Usa Hugging Face TRL (SFTTrainer) con:
    - Quantizzazione BitsAndBytes 4-bit (QLoRA)
    - LoRA con rank configurabile (default 16)
    - Chat template automatico dal tokenizer
    - Eval periodico su validation set
    
    Il risultato è un adapter LoRA (~100-200MB) che può essere
    caricato dinamicamente da vLLM senza modificare il modello base.
    """

    def __init__(
        self,
        model_name: str = "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
        lora_rank: int = 16,
        lora_alpha: int = 32,
        lora_dropout: float = 0.05,
        learning_rate: float = 2e-4,
        num_epochs: int = 3,
        batch_size: int = 4,
        gradient_accumulation_steps: int = 8,
        max_seq_length: int = 2048,
        hf_token: Optional[str] = None
    ):
        """
        Inizializza il trainer.
        
        Args:
            model_name: Nome del modello base su Hugging Face
            lora_rank: Rank delle matrici LoRA (più alto = più capacità, più VRAM)
            lora_alpha: Alpha scaling per LoRA (tipicamente 2x rank)
            lora_dropout: Dropout per LoRA (regolarizzazione)
            learning_rate: Learning rate (2e-4 è un buon default per QLoRA)
            num_epochs: Numero di epoche di training
            batch_size: Batch size per device
            gradient_accumulation_steps: Steps di gradient accumulation
            max_seq_length: Lunghezza massima sequenza in token
            hf_token: Token Hugging Face per modelli gated
        """
        self.model_name = model_name
        self.lora_rank = lora_rank
        self.lora_alpha = lora_alpha
        self.lora_dropout = lora_dropout
        self.learning_rate = learning_rate
        self.num_epochs = num_epochs
        self.batch_size = batch_size
        self.gradient_accumulation_steps = gradient_accumulation_steps
        self.max_seq_length = max_seq_length
        self.hf_token = hf_token

    def load_dataset(self, dataset_path: str | Path) -> list[dict]:
        """
        Carica il dataset SFT da file JSONL.
        
        Il formato atteso è:
        {"messages": [
            {"role": "system", "content": "..."},
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "..."}
        ]}
        
        Args:
            dataset_path: Path al file .jsonl
            
        Returns:
            Lista di conversazioni (ogni elemento è un dict con "messages")
        """
        dataset_path = Path(dataset_path)
        
        if not dataset_path.exists():
            raise FileNotFoundError(f"Dataset non trovato: {dataset_path}")
        
        conversations = []
        with open(dataset_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if "messages" not in data:
                        console.print(f"[yellow]⚠️  Riga {line_num}: campo 'messages' mancante, skip[/yellow]")
                        continue
                    conversations.append(data)
                except json.JSONDecodeError as e:
                    console.print(f"[yellow]⚠️  Riga {line_num}: JSON non valido ({e}), skip[/yellow]")
        
        console.print(f"[green]✅ Dataset caricato: {len(conversations)} conversazioni da {dataset_path.name}[/green]")
        return conversations

    def validate_dataset(self, conversations: list[dict]) -> dict:
        """
        Valida il dataset SFT verificando formato e distribuzione.
        
        Args:
            conversations: Lista di conversazioni caricate
            
        Returns:
            Dict con statistiche e eventuali warning
        """
        stats = {
            "total": len(conversations),
            "with_system": 0,
            "avg_messages": 0,
            "avg_user_length": 0,
            "avg_assistant_length": 0,
            "warnings": [],
        }
        
        total_messages = 0
        total_user_len = 0
        total_assistant_len = 0
        user_count = 0
        assistant_count = 0
        
        for conv in conversations:
            messages = conv["messages"]
            total_messages += len(messages)
            
            has_system = any(m["role"] == "system" for m in messages)
            if has_system:
                stats["with_system"] += 1
            
            for msg in messages:
                if msg["role"] == "user":
                    total_user_len += len(msg["content"])
                    user_count += 1
                elif msg["role"] == "assistant":
                    total_assistant_len += len(msg["content"])
                    assistant_count += 1
        
        stats["avg_messages"] = total_messages / max(len(conversations), 1)
        stats["avg_user_length"] = total_user_len / max(user_count, 1)
        stats["avg_assistant_length"] = total_assistant_len / max(assistant_count, 1)
        
        # Warnings
        if len(conversations) < 100:
            stats["warnings"].append("Dataset molto piccolo (<100 esempi). Qualità LoRA potrebbe essere bassa.")
        if stats["with_system"] < len(conversations) * 0.9:
            stats["warnings"].append("Meno del 90% delle conversazioni ha un system prompt.")
        
        return stats

    def train(
        self,
        dataset_path: str | Path,
        eval_dataset_path: Optional[str | Path] = None,
        output_dir: str | Path = "./outputs/lora"
    ) -> Path:
        """
        Esegue il training QLoRA.
        
        IMPORTANTE: Richiede GPU con CUDA. Non eseguire su CPU.
        
        Args:
            dataset_path: Path al dataset di training (.jsonl)
            eval_dataset_path: Path al dataset di validazione (.jsonl, opzionale)
            output_dir: Directory dove salvare l'adapter LoRA
            
        Returns:
            Path alla directory con l'adapter salvato
        """
        import torch
        from datasets import Dataset
        from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
            TrainingArguments,
        )
        from trl import SFTTrainer
        
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Verifica GPU
        if not torch.cuda.is_available():
            raise RuntimeError(
                "CUDA non disponibile. Il training QLoRA richiede una GPU NVIDIA.\n"
                "Se stai usando RunPod/Vast.ai, assicurati di aver selezionato un'istanza con GPU."
            )
        
        console.print(f"[blue]🚀 Avvio training QLoRA[/blue]")
        console.print(f"   Modello base: {self.model_name}")
        console.print(f"   LoRA rank: {self.lora_rank}, alpha: {self.lora_alpha}")
        console.print(f"   Epochs: {self.num_epochs}, LR: {self.learning_rate}")
        console.print(f"   GPU: {torch.cuda.get_device_name(0)}")
        console.print(f"   VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")
        
        # 1. Configura quantizzazione 4-bit (QLoRA)
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",           # NormalFloat4 (migliore di fp4)
            bnb_4bit_compute_dtype=torch.bfloat16,  # Calcolo in bfloat16
            bnb_4bit_use_double_quant=True,       # Double quantization per risparmiare VRAM
        )
        
        # 2. Carica tokenizer
        console.print(f"[blue]📥 Caricamento tokenizer...[/blue]")
        tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            token=self.hf_token,
            trust_remote_code=True,
        )
        
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        tokenizer.padding_side = "right"
        
        # 3. Carica modello quantizzato
        console.print(f"[blue]📥 Caricamento modello in 4-bit...[/blue]")
        model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            quantization_config=bnb_config,
            device_map="auto",
            token=self.hf_token,
            trust_remote_code=True,
        )
        model = prepare_model_for_kbit_training(model)
        
        # 4. Configura LoRA
        lora_config = LoraConfig(
            r=self.lora_rank,
            lora_alpha=self.lora_alpha,
            lora_dropout=self.lora_dropout,
            bias="none",
            task_type=TaskType.CAUSAL_LM,
            # Target modules tipici per Mistral/Llama
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                           "gate_proj", "up_proj", "down_proj"],
        )
        
        model = get_peft_model(model, lora_config)
        
        # Stampa parametri trainabili
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total_params = sum(p.numel() for p in model.parameters())
        console.print(f"   Parametri trainabili: {trainable_params:,} / {total_params:,} "
                     f"({100 * trainable_params / total_params:.2f}%)")
        
        # 5. Prepara dataset
        console.print(f"[blue]📊 Preparazione dataset...[/blue]")
        train_conversations = self.load_dataset(dataset_path)
        
        # Converti in formato HuggingFace Dataset
        def format_conversation(conv):
            """Formatta una conversazione usando il chat template del tokenizer."""
            return tokenizer.apply_chat_template(
                conv["messages"],
                tokenize=False,
                add_generation_prompt=False,
            )
        
        train_texts = [format_conversation(c) for c in train_conversations]
        train_dataset = Dataset.from_dict({"text": train_texts})
        
        eval_dataset = None
        if eval_dataset_path:
            eval_conversations = self.load_dataset(eval_dataset_path)
            eval_texts = [format_conversation(c) for c in eval_conversations]
            eval_dataset = Dataset.from_dict({"text": eval_texts})
        
        # 6. Configura training
        training_args = TrainingArguments(
            output_dir=str(output_dir),
            num_train_epochs=self.num_epochs,
            per_device_train_batch_size=self.batch_size,
            gradient_accumulation_steps=self.gradient_accumulation_steps,
            learning_rate=self.learning_rate,
            weight_decay=0.01,
            warmup_ratio=0.03,
            lr_scheduler_type="cosine",
            logging_steps=10,
            save_strategy="epoch",
            evaluation_strategy="epoch" if eval_dataset else "no",
            bf16=True,
            gradient_checkpointing=True,
            max_grad_norm=0.3,
            group_by_length=True,
            report_to="none",  # Cambiare a "wandb" se si usa W&B
        )
        
        # 7. Inizializza trainer
        trainer = SFTTrainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            tokenizer=tokenizer,
            dataset_text_field="text",
            max_seq_length=self.max_seq_length,
            packing=False,
        )
        
        # 8. Training!
        console.print(f"[blue]🏋️ Training in corso...[/blue]")
        trainer.train()
        
        # 9. Salva adapter LoRA
        adapter_dir = output_dir / "adapter"
        trainer.save_model(str(adapter_dir))
        tokenizer.save_pretrained(str(adapter_dir))
        
        console.print(f"[green]✅ Training completato![/green]")
        console.print(f"   Adapter salvato in: {adapter_dir}")
        console.print(f"   Per usarlo con vLLM: --lora-modules trainmind={adapter_dir}")
        
        return adapter_dir

    def print_training_config(self) -> None:
        """Stampa la configurazione di training corrente."""
        console.print("\n[bold]📋 Configurazione Training QLoRA[/bold]")
        console.print(f"   Modello base:     {self.model_name}")
        console.print(f"   LoRA rank:        {self.lora_rank}")
        console.print(f"   LoRA alpha:       {self.lora_alpha}")
        console.print(f"   LoRA dropout:     {self.lora_dropout}")
        console.print(f"   Learning rate:    {self.learning_rate}")
        console.print(f"   Epochs:           {self.num_epochs}")
        console.print(f"   Batch size:       {self.batch_size}")
        console.print(f"   Grad accum:       {self.gradient_accumulation_steps}")
        console.print(f"   Effective batch:  {self.batch_size * self.gradient_accumulation_steps}")
        console.print(f"   Max seq length:   {self.max_seq_length}")
        console.print("")
