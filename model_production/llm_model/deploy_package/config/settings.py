"""
config/settings.py
==================
Configurazione centralizzata per la pipeline TrainMindAI LLM.
Legge le variabili d'ambiente dal file .env e le espone come oggetto Settings.

Uso:
    from config.settings import settings
    print(settings.LLM_PROVIDER)
"""

import os
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Carica il file .env dalla root del progetto llm_model
_ROOT_DIR = Path(__file__).parent.parent
load_dotenv(_ROOT_DIR / ".env")


class Settings(BaseSettings):
    """Configurazione globale del progetto. Ogni campo corrisponde a una variabile .env."""

    # --- LLM Provider ---
    LLM_PROVIDER: Literal["openai", "vllm"] = "openai"

    # --- OpenAI ---
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # --- vLLM ---
    LLM_BASE_URL: str = "http://localhost:8000/v1"
    LLM_API_KEY: str = "token-placeholder"
    LLM_MODEL: str = "mistralai/Mistral-Small-3.1-24B-Instruct-2503"

    # --- Embeddings ---
    EMBED_MODEL: str = "intfloat/multilingual-e5-small"
    EMBED_DEVICE: str = "cpu"  # cpu | cuda | mps

    # --- Reranker ---
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    RERANKER_DEVICE: str = "cpu"

    # --- Vector Database ---
    VECTOR_DB: Literal["qdrant_local", "qdrant_cloud", "pinecone"] = "qdrant_local"
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX: str = "trainmind-kb"

    # --- Collection/Index ---
    KB_COLLECTION_NAME: str = "trainmind_kb_v1"
    KB_CHUNK_SIZE: int = 600
    KB_CHUNK_OVERLAP: int = 80

    # --- Training ---
    TRAINING_MODEL: str = "mistralai/Mistral-Small-3.1-24B-Instruct-2503"
    TRAINING_OUTPUT_DIR: str = "./outputs/lora"
    TRAINING_EPOCHS: int = 3
    TRAINING_BATCH_SIZE: int = 4
    TRAINING_GRAD_ACCUM: int = 8
    TRAINING_LR: float = 2e-4
    LORA_RANK: int = 16
    LORA_ALPHA: int = 32

    # --- Hugging Face ---
    HF_TOKEN: str = ""

    # --- Observability ---
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "http://localhost:3000"

    # --- SSL ---
    SSL_VERIFY: str = "true"  # "false" per ambienti con certificati non validi

    # --- Paths (relativi alla root del progetto) ---
    KB_DOCS_PATH: str = "./docs/kb"
    CHUNKS_OUTPUT_PATH: str = "./data/chunks"
    SFT_DATASET_PATH: str = "./data/sft"
    LORA_OUTPUT_PATH: str = "./outputs/lora"

    @property
    def root_dir(self) -> Path:
        """Restituisce il path assoluto della root del progetto llm_model."""
        return _ROOT_DIR

    @property
    def kb_docs_dir(self) -> Path:
        """Path assoluto della cartella documenti KB."""
        return _ROOT_DIR / self.KB_DOCS_PATH

    @property
    def chunks_dir(self) -> Path:
        """Path assoluto della cartella chunks."""
        return _ROOT_DIR / self.CHUNKS_OUTPUT_PATH

    @property
    def sft_dir(self) -> Path:
        """Path assoluto della cartella dataset SFT."""
        return _ROOT_DIR / self.SFT_DATASET_PATH

    @property
    def lora_dir(self) -> Path:
        """Path assoluto della cartella output LoRA."""
        return _ROOT_DIR / self.LORA_OUTPUT_PATH

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Istanza singleton usata in tutto il progetto
settings = Settings()
