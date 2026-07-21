"""
Configuration module for TrainMind AI Service.

Carica le impostazioni da variabili d'ambiente usando Pydantic Settings.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Impostazioni dell'applicazione caricate dalle variabili d'ambiente."""

    # Local LLM Configuration (primary — llama-cpp-python server)
    local_llm_enabled: bool = True
    local_llm_base_url: str = "http://localhost:8000/v1"
    local_llm_model: str = "trainmind"
    local_llm_timeout: int = 120  # seconds — CPU inference is slower

    # OpenAI Configuration (fallback for LLM, primary for embeddings)
    openai_api_key: str = ""  # now optional — not needed if only using local LLM
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # ChromaDB Configuration
    chroma_persist_directory: str = "./chroma_data"
    chroma_collection_prefix: str = "trainmind"

    # Database Configuration
    database_url: str = "postgresql://trainmind:trainmind_dev@localhost:5432/trainmind_dev"

    # Redis Configuration
    redis_url: str = "redis://localhost:6379/1"

    # Sentry Configuration (optional)
    sentry_dsn: str = ""
    environment: str = "development"

    # Service Configuration
    ai_service_port: int = 3002
    ai_service_host: str = "0.0.0.0"
    log_level: str = "info"

    class Config:
        """Configurazione Pydantic."""

        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Istanza globale delle impostazioni
settings = Settings()
