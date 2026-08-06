"""
LLM client wrapper with dual-provider support.

Primary:  Local model via llama-cpp-python (OpenAI-compatible API on port 8000)
Fallback: OpenAI API (GPT-4o)

Embeddings always use OpenAI (better quality for RAG, low cost).
"""

import logging
from dataclasses import dataclass
from typing import Iterator, Optional

import httpx
try:
    import tiktoken
except Exception:
    tiktoken = None  # type: ignore

import structlog
from openai import OpenAI, APIError, RateLimitError, APIConnectionError
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.services.cache import cache_get, cache_set

logger = structlog.get_logger(__name__)


@dataclass
class LLMResult:
    """
    Esito di una chat completion, con il consumo token annesso.

    Serve a non perdere `response.usage`: prima veniva solo loggato e scartato,
    quindi era impossibile sapere quanto costasse ogni organizzazione.
    """

    content: str
    model: str = ""
    provider: str = "openai"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    estimated: bool = False

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def as_usage_dict(self) -> dict:
        """Formato atteso da `UsageInfo` in models/schemas.py."""
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "model": self.model,
            "provider": self.provider,
            "estimated": self.estimated,
        }


class LLMClient:
    """
    Dual-provider LLM client.

    Tries local model first (no API cost), falls back to OpenAI.
    Embeddings always go through OpenAI.
    Implements Singleton pattern.
    """

    _instance: Optional["LLMClient"] = None

    def __new__(cls) -> "LLMClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return

        # Local LLM client (llama-cpp-python server)
        self.local_enabled = settings.local_llm_enabled
        self.local_client: Optional[OpenAI] = None
        self.local_model = settings.local_llm_model
        self._local_healthy = False

        if self.local_enabled:
            self.local_client = OpenAI(
                base_url=settings.local_llm_base_url,
                api_key="not-needed",  # llama-cpp-python doesn't require a key
                timeout=settings.local_llm_timeout,
            )
            logger.info(
                "Local LLM client initialized",
                base_url=settings.local_llm_base_url,
                model=self.local_model,
            )

        # OpenAI client (fallback LLM + embeddings)
        self.openai_client: Optional[OpenAI] = None
        self.openai_model = settings.openai_model
        self.embedding_model = settings.openai_embedding_model

        if settings.openai_api_key:
            self.openai_client = OpenAI(api_key=settings.openai_api_key)
            logger.info("OpenAI client initialized (fallback + embeddings)",
                        model=self.openai_model)
        else:
            logger.warning("No OpenAI API key — fallback LLM and embeddings unavailable")

        # Tokenizer (may fail if tiktoken can't download encoding data)
        self.encoding = None
        if tiktoken is not None:
            try:
                self.encoding = tiktoken.encoding_for_model(self.openai_model)
            except Exception:
                try:
                    self.encoding = tiktoken.get_encoding("cl100k_base")
                except Exception:
                    logger.warning("tiktoken encoding download failed — using estimation")
        else:
            logger.warning("tiktoken not available — token counting will use estimation")

        self._initialized = True

    def _check_local_health(self) -> bool:
        """Quick health check on local LLM server."""
        if not self.local_enabled or not self.local_client:
            return False
        try:
            # Use httpx for fast timeout health check
            resp = httpx.get(
                f"{settings.local_llm_base_url.rstrip('/v1')}/health",
                timeout=3.0,
            )
            healthy = resp.status_code == 200
            if healthy != self._local_healthy:
                if healthy:
                    logger.info("Local LLM server is UP")
                else:
                    logger.warning("Local LLM server health check failed",
                                   status=resp.status_code)
            self._local_healthy = healthy
            return healthy
        except Exception:
            if self._local_healthy:
                logger.warning("Local LLM server is DOWN — will use OpenAI fallback")
            self._local_healthy = False
            return False

    def chat_completion_full(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> LLMResult:
        """
        Chat completion che restituisce anche il consumo token.

        È il metodo da usare nei router: `apps/api` persiste `usage` in
        `ai_usage_logs`. `chat_completion()` resta come wrapper per i
        chiamanti che vogliono solo la stringa.

        Args:
            messages: OpenAI-format message list
            model: Model override (None = use configured default)
            temperature: Creativity (0-1)
            max_tokens: Max response tokens
            json_mode: se True forza `response_format={"type":"json_object"}`,
                che garantisce un JSON sintatticamente valido. Il modello locale
                non lo supporta e viene quindi saltato: meglio una risposta
                corretta da OpenAI che un JSON malformato dal modello locale.

        Returns:
            LLMResult con contenuto, modello, provider e token
        """
        # Try local first (salvo json_mode: llama-cpp non garantisce JSON valido)
        if not json_mode and self._check_local_health():
            try:
                return self._local_chat(messages, temperature, max_tokens)
            except Exception as e:
                logger.error("Local LLM chat failed, falling back to OpenAI",
                             error=str(e))

        # Fallback to OpenAI
        if self.openai_client:
            return self._openai_chat(messages, model, temperature, max_tokens,
                                     json_mode)

        raise RuntimeError(
            "No LLM provider available. "
            "Start local model server (python scripts/start_model_server.py) "
            "or set OPENAI_API_KEY in .env"
        )

    def chat_completion(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """Come `chat_completion_full`, ma restituisce solo il testo."""
        return self.chat_completion_full(
            messages, model, temperature, max_tokens
        ).content

    def chat_completion_stream(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        usage_sink: Optional[dict] = None,
    ) -> Iterator[str]:
        """
        Streaming chat completion — tries local first, falls back to OpenAI.

        Args:
            usage_sink: dict opzionale che, a stream concluso, viene popolato
                con il consumo token (formato `LLMResult.as_usage_dict()`).
                In streaming il consumo non è noto finché lo stream non finisce,
                quindi non può essere restituito: il chiamante passa un dict e
                lo legge dopo aver esaurito l'iteratore.

        Yields:
            Text chunks from response
        """
        # Try local first
        if self._check_local_health():
            try:
                yield from self._local_chat_stream(
                    messages, temperature, max_tokens, usage_sink
                )
                return
            except Exception as e:
                logger.error("Local LLM stream failed, falling back to OpenAI",
                             error=str(e))

        # Fallback to OpenAI
        if self.openai_client:
            yield from self._openai_chat_stream(
                messages, model, temperature, max_tokens, usage_sink
            )
            return

        raise RuntimeError("No LLM provider available.")

    def _estimate_tokens(self, text: str) -> int:
        """
        Stima i token di un testo. Usato solo quando il provider non riporta
        `usage` (modello locale in streaming, o risposta senza usage).
        """
        if not text:
            return 0
        if self.encoding is not None:
            try:
                return len(self.encoding.encode(text))
            except Exception:
                pass
        # Ripiego grossolano: ~4 caratteri per token sull'italiano
        return max(1, len(text) // 4)

    # --- Local LLM methods ---

    def _local_chat(self, messages: list[dict], temperature: float,
                    max_tokens: int) -> LLMResult:
        """Chat completion via local llama-cpp-python server."""
        logger.debug("Local LLM chat request", num_messages=len(messages))

        response = self.local_client.chat.completions.create(
            model=self.local_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content or ""
        usage = getattr(response, "usage", None)
        logger.debug("Local LLM chat success",
                     tokens=getattr(usage, 'total_tokens', 'N/A'))

        # Il modello locale non ha costo per token: i valori servono solo
        # a tenere lo storico completo.
        return LLMResult(
            content=content,
            model=self.local_model,
            provider="local",
            prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
            estimated=usage is None,
        )

    def _local_chat_stream(self, messages: list[dict], temperature: float,
                           max_tokens: int,
                           usage_sink: Optional[dict] = None) -> Iterator[str]:
        """Streaming chat via local llama-cpp-python server."""
        logger.debug("Local LLM stream request", num_messages=len(messages))

        buffer = ""
        with self.local_client.chat.completions.create(
            model=self.local_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        ) as stream:
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    piece = chunk.choices[0].delta.content
                    buffer += piece
                    yield piece

        logger.debug("Local LLM stream finished")

        if usage_sink is not None:
            prompt_text = "\n".join(m.get("content", "") for m in messages)
            usage_sink.update(
                LLMResult(
                    content="",
                    model=self.local_model,
                    provider="local",
                    prompt_tokens=self._estimate_tokens(prompt_text),
                    completion_tokens=self._estimate_tokens(buffer),
                    estimated=True,
                ).as_usage_dict()
            )

    # --- OpenAI methods ---

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def _openai_chat(self, messages: list[dict], model: Optional[str],
                     temperature: float, max_tokens: int,
                     json_mode: bool = False) -> LLMResult:
        """Chat completion via OpenAI API (fallback)."""
        use_model = model or self.openai_model
        logger.debug("OpenAI chat request", model=use_model,
                     num_messages=len(messages), json_mode=json_mode)

        extra = {"response_format": {"type": "json_object"}} if json_mode else {}

        response = self.openai_client.chat.completions.create(
            model=use_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **extra,
        )

        content = response.choices[0].message.content or ""
        usage = getattr(response, "usage", None)
        prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
        completion_tokens = getattr(usage, "completion_tokens", 0) or 0

        logger.info("OpenAI chat success",
                    model=use_model,
                    usage_prompt=prompt_tokens,
                    usage_completion=completion_tokens)

        return LLMResult(
            content=content,
            model=use_model,
            provider="openai",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated=usage is None,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def _openai_chat_stream(self, messages: list[dict], model: Optional[str],
                            temperature: float, max_tokens: int,
                            usage_sink: Optional[dict] = None) -> Iterator[str]:
        """
        Streaming chat via OpenAI API.

        `stream_options={"include_usage": True}` fa arrivare un chunk finale
        con l'oggetto `usage`. Senza questa opzione OpenAI non riporta i token
        in streaming e il consumo della chat resterebbe invisibile.
        """
        use_model = model or self.openai_model
        logger.debug("OpenAI stream request", model=use_model)

        captured_usage = None
        buffer = ""

        with self.openai_client.chat.completions.create(
            model=use_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
        ) as stream:
            for chunk in stream:
                # Il chunk finale con usage arriva con choices vuoto
                if getattr(chunk, "usage", None):
                    captured_usage = chunk.usage
                if chunk.choices and chunk.choices[0].delta.content:
                    piece = chunk.choices[0].delta.content
                    buffer += piece
                    yield piece

        logger.debug("OpenAI stream finished")

        if usage_sink is not None:
            if captured_usage is not None:
                result = LLMResult(
                    content="",
                    model=use_model,
                    provider="openai",
                    prompt_tokens=getattr(captured_usage, "prompt_tokens", 0) or 0,
                    completion_tokens=getattr(captured_usage, "completion_tokens", 0) or 0,
                    estimated=False,
                )
            else:
                # Ripiego: alcuni proxy compatibili OpenAI ignorano stream_options
                prompt_text = "\n".join(m.get("content", "") for m in messages)
                result = LLMResult(
                    content="",
                    model=use_model,
                    provider="openai",
                    prompt_tokens=self._estimate_tokens(prompt_text),
                    completion_tokens=self._estimate_tokens(buffer),
                    estimated=True,
                )
                logger.warning("Streaming usage non riportato — token stimati",
                               model=use_model)
            usage_sink.update(result.as_usage_dict())

    # --- Embeddings (always OpenAI) ---

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def create_embedding(self, text: str) -> list[float]:
        """Create embedding for text (always uses OpenAI)."""
        if not self.openai_client:
            raise RuntimeError("OpenAI API key required for embeddings. Set OPENAI_API_KEY.")

        cached = cache_get("embedding", text)
        if cached:
            return cached

        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text,
        )
        embedding = response.data[0].embedding
        cache_set("embedding", text, embedding)
        return embedding

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def create_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Batch embedding creation (always uses OpenAI)."""
        if not texts:
            return []
        if not self.openai_client:
            raise RuntimeError("OpenAI API key required for embeddings.")

        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]

    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if self.encoding:
            try:
                return len(self.encoding.encode(text))
            except Exception:
                pass
        # Fallback: ~4 chars per token
        return len(text) // 4

    def get_provider_status(self) -> dict:
        """Return current provider status for health endpoint."""
        local_up = self._check_local_health() if self.local_enabled else False
        return {
            "local_llm": {
                "enabled": self.local_enabled,
                "healthy": local_up,
                "url": settings.local_llm_base_url if self.local_enabled else None,
                "model": self.local_model if self.local_enabled else None,
            },
            "openai": {
                "configured": self.openai_client is not None,
                "model": self.openai_model,
                "role": "fallback_llm + embeddings",
            },
            "active_llm_provider": "local" if local_up else (
                "openai" if self.openai_client else "none"
            ),
        }


# Backward-compatible alias
OpenAIClient = LLMClient

# Global instance
_llm_client: Optional[LLMClient] = None


def get_openai_client() -> LLMClient:
    """Get global LLM client instance (backward-compatible name)."""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
