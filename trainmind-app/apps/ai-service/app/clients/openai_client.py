"""
LLM client wrapper with dual-provider support.

Primary:  Local model via llama-cpp-python (OpenAI-compatible API on port 8000)
Fallback: OpenAI API (GPT-4o)

Embeddings always use OpenAI (better quality for RAG, low cost).
"""

import logging
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

    def chat_completion(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """
        Chat completion — tries local model first, falls back to OpenAI.

        Args:
            messages: OpenAI-format message list
            model: Model override (None = use configured default)
            temperature: Creativity (0-1)
            max_tokens: Max response tokens

        Returns:
            Response content string
        """
        # Try local first
        if self._check_local_health():
            try:
                return self._local_chat(messages, temperature, max_tokens)
            except Exception as e:
                logger.error("Local LLM chat failed, falling back to OpenAI",
                             error=str(e))

        # Fallback to OpenAI
        if self.openai_client:
            return self._openai_chat(messages, model, temperature, max_tokens)

        raise RuntimeError(
            "No LLM provider available. "
            "Start local model server (python scripts/start_model_server.py) "
            "or set OPENAI_API_KEY in .env"
        )

    def chat_completion_stream(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Iterator[str]:
        """
        Streaming chat completion — tries local first, falls back to OpenAI.

        Yields:
            Text chunks from response
        """
        # Try local first
        if self._check_local_health():
            try:
                yield from self._local_chat_stream(messages, temperature, max_tokens)
                return
            except Exception as e:
                logger.error("Local LLM stream failed, falling back to OpenAI",
                             error=str(e))

        # Fallback to OpenAI
        if self.openai_client:
            yield from self._openai_chat_stream(messages, model, temperature, max_tokens)
            return

        raise RuntimeError("No LLM provider available.")

    # --- Local LLM methods ---

    def _local_chat(self, messages: list[dict], temperature: float,
                    max_tokens: int) -> str:
        """Chat completion via local llama-cpp-python server."""
        logger.debug("Local LLM chat request", num_messages=len(messages))

        response = self.local_client.chat.completions.create(
            model=self.local_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content
        logger.debug("Local LLM chat success",
                     tokens=getattr(response.usage, 'total_tokens', 'N/A'))
        return content or ""

    def _local_chat_stream(self, messages: list[dict], temperature: float,
                           max_tokens: int) -> Iterator[str]:
        """Streaming chat via local llama-cpp-python server."""
        logger.debug("Local LLM stream request", num_messages=len(messages))

        with self.local_client.chat.completions.create(
            model=self.local_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        ) as stream:
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        logger.debug("Local LLM stream finished")

    # --- OpenAI methods ---

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def _openai_chat(self, messages: list[dict], model: Optional[str],
                     temperature: float, max_tokens: int) -> str:
        """Chat completion via OpenAI API (fallback)."""
        use_model = model or self.openai_model
        logger.debug("OpenAI fallback chat request", model=use_model,
                     num_messages=len(messages))

        response = self.openai_client.chat.completions.create(
            model=use_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content
        logger.debug("OpenAI chat success",
                     usage_prompt=response.usage.prompt_tokens,
                     usage_completion=response.usage.completion_tokens)
        return content or ""

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def _openai_chat_stream(self, messages: list[dict], model: Optional[str],
                            temperature: float, max_tokens: int) -> Iterator[str]:
        """Streaming chat via OpenAI API (fallback)."""
        use_model = model or self.openai_model
        logger.debug("OpenAI fallback stream request", model=use_model)

        with self.openai_client.chat.completions.create(
            model=use_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        ) as stream:
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        logger.debug("OpenAI stream finished")

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
