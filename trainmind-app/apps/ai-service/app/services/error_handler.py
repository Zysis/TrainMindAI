"""
TrainMind AI Service — Error Handling & Fallback Layer.

Sprint 2.5.2: Gestisce:
- LLM timeouts → retry con exponential backoff
- API rate limiting → queue con backoff
- Malformed output → retry con corrective prompt
- AI service down → messaggio utente + auto-retry
- Structured logging con Pino-compatible JSON output (structlog)
"""

import asyncio
import time
from functools import wraps
from typing import Any, Callable, Optional

import structlog
from openai import (
    APIError,
    APITimeoutError,
    RateLimitError,
    APIConnectionError,
    InternalServerError,
)

logger = structlog.get_logger(__name__)


# ── Retry Configuration ────────────────────────────────────

DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 1.0       # secondi
DEFAULT_MAX_DELAY = 30.0       # secondi
RATE_LIMIT_BASE_DELAY = 5.0    # secondi per rate limit
TIMEOUT_SECONDS = 60           # timeout per singola chiamata


class AIServiceError(Exception):
    """Errore generico del servizio AI con contesto strutturato."""

    def __init__(
        self,
        message: str,
        error_type: str = "unknown",
        retryable: bool = False,
        status_code: int = 500,
        details: Optional[dict] = None,
    ):
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable
        self.status_code = status_code
        self.details = details or {}


class LLMTimeoutError(AIServiceError):
    def __init__(self, message: str = "LLM request timed out"):
        super().__init__(message, "timeout", retryable=True, status_code=504)


class LLMRateLimitError(AIServiceError):
    def __init__(self, retry_after: Optional[float] = None):
        msg = "Rate limit raggiunto"
        if retry_after:
            msg += f", riprova tra {retry_after:.0f}s"
        super().__init__(msg, "rate_limit", retryable=True, status_code=429,
                         details={"retry_after": retry_after})


class LLMConnectionError(AIServiceError):
    def __init__(self, message: str = "Impossibile contattare il servizio LLM"):
        super().__init__(message, "connection", retryable=True, status_code=503)


class LLMMalformedOutputError(AIServiceError):
    def __init__(self, message: str = "Output LLM non valido"):
        super().__init__(message, "malformed_output", retryable=True, status_code=502)


# ── Retry Decorator ─────────────────────────────────────────


def with_retry(
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
):
    """
    Decorator che aggiunge retry con exponential backoff alle funzioni async.

    Gestisce automaticamente diversi tipi di errore OpenAI con strategie
    di backoff specifiche.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_error = None
            attempt_start = time.time()

            for attempt in range(1, max_retries + 1):
                try:
                    return await func(*args, **kwargs)

                except APITimeoutError as e:
                    last_error = e
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    logger.warning(
                        "LLM timeout, retrying",
                        attempt=attempt,
                        max_retries=max_retries,
                        delay=delay,
                        function=func.__name__,
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(delay)

                except RateLimitError as e:
                    last_error = e
                    # Usa retry-after header se disponibile
                    retry_after = getattr(e, 'retry_after', None)
                    delay = retry_after if retry_after else min(
                        RATE_LIMIT_BASE_DELAY * (2 ** (attempt - 1)), max_delay
                    )
                    logger.warning(
                        "Rate limit hit, backing off",
                        attempt=attempt,
                        delay=delay,
                        function=func.__name__,
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(delay)

                except APIConnectionError as e:
                    last_error = e
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    logger.warning(
                        "LLM connection error, retrying",
                        attempt=attempt,
                        delay=delay,
                        error=str(e),
                        function=func.__name__,
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(delay)

                except InternalServerError as e:
                    last_error = e
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    logger.warning(
                        "LLM internal server error, retrying",
                        attempt=attempt,
                        delay=delay,
                        function=func.__name__,
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(delay)

                except APIError as e:
                    # Non retryable API errors
                    logger.error(
                        "Non-retryable API error",
                        error=str(e),
                        status_code=getattr(e, 'status_code', None),
                        function=func.__name__,
                    )
                    raise

            # Tutti i tentativi esauriti
            total_time = time.time() - attempt_start
            logger.error(
                "All retry attempts exhausted",
                max_retries=max_retries,
                total_time_seconds=round(total_time, 2),
                last_error=str(last_error),
                function=func.__name__,
            )

            if isinstance(last_error, APITimeoutError):
                raise LLMTimeoutError()
            elif isinstance(last_error, RateLimitError):
                raise LLMRateLimitError()
            elif isinstance(last_error, APIConnectionError):
                raise LLMConnectionError()
            else:
                raise AIServiceError(
                    f"Servizio AI non disponibile dopo {max_retries} tentativi",
                    error_type="exhausted",
                    status_code=503,
                )

        return wrapper
    return decorator


# ── Output Validation ────────────────────────────────────────


def validate_llm_output(
    content: str,
    min_length: int = 10,
    required_keywords: Optional[list[str]] = None,
) -> bool:
    """
    Valida l'output del LLM per rilevare risposte malformate o vuote.

    Args:
        content: Testo generato dal LLM
        min_length: Lunghezza minima accettabile
        required_keywords: Parole chiave che devono essere presenti

    Returns:
        True se l'output è valido
    """
    if not content or len(content.strip()) < min_length:
        return False

    if required_keywords:
        content_lower = content.lower()
        for kw in required_keywords:
            if kw.lower() in content_lower:
                return True
        return False

    return True


# ── User-Friendly Error Messages ────────────────────────────


FALLBACK_MESSAGES = {
    "timeout": "Il servizio AI sta impiegando più tempo del previsto. Riprova tra qualche secondo.",
    "rate_limit": "Troppe richieste al servizio AI. Attendi un momento e riprova.",
    "connection": "Il servizio AI non è momentaneamente raggiungibile. Verifica che sia avviato e riprova.",
    "malformed_output": "La risposta generata non è andata a buon fine. Riprova con una domanda più specifica.",
    "exhausted": "Il servizio AI non è disponibile al momento. Riprova tra qualche minuto.",
    "unknown": "Si è verificato un errore imprevisto. Riprova più tardi.",
}


def get_user_message(error: AIServiceError) -> str:
    """Restituisce un messaggio user-friendly per l'errore."""
    return FALLBACK_MESSAGES.get(error.error_type, FALLBACK_MESSAGES["unknown"])


def format_error_response(error: AIServiceError) -> dict:
    """Formatta un errore come risposta JSON strutturata."""
    return {
        "error": True,
        "error_type": error.error_type,
        "message": get_user_message(error),
        "retryable": error.retryable,
        "details": error.details,
    }
