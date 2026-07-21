"""
TrainMind AI Service — Performance Metrics & Monitoring.

Sprint 2.5.4: Raccoglie metriche custom per:
- AI latency (per endpoint)
- Token usage (prompt + completion)
- Cache hit rate
- Embedding latency
- Error rates

Le metriche vengono esposte via endpoint /metrics in formato JSON.
Opzionalmente integra Sentry per error tracking.
"""

import os
import time
from collections import defaultdict
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)

# ── Sentry Integration (lazy) ───────────────────────────────

_sentry_initialized = False


def init_sentry():
    """Inizializza Sentry SDK se DSN configurato."""
    global _sentry_initialized
    if _sentry_initialized:
        return

    dsn = os.getenv("SENTRY_DSN", "")
    if not dsn:
        logger.info("Sentry DSN not configured, skipping init")
        _sentry_initialized = True
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("ENVIRONMENT", "development"),
            traces_sample_rate=0.2,
            profiles_sample_rate=0.1,
            integrations=[
                FastApiIntegration(),
                StarletteIntegration(),
            ],
        )
        _sentry_initialized = True
        logger.info("✓ Sentry initialized for AI service")
    except ImportError:
        logger.warning("sentry-sdk not installed, skipping Sentry init")
        _sentry_initialized = True
    except Exception as e:
        logger.error("Failed to initialize Sentry", error=str(e))
        _sentry_initialized = True


def capture_exception(error: Exception, context: Optional[dict] = None):
    """Invia un'eccezione a Sentry (se configurato)."""
    try:
        import sentry_sdk
        if sentry_sdk.is_initialized():
            with sentry_sdk.push_scope() as scope:
                if context:
                    for k, v in context.items():
                        scope.set_extra(k, v)
                sentry_sdk.capture_exception(error)
    except ImportError:
        pass


# ── In-Memory Metrics Store ──────────────────────────────────

class MetricsCollector:
    """Raccoglie e aggrega metriche AI in-memory."""

    def __init__(self):
        self._counters: dict[str, int] = defaultdict(int)
        self._histograms: dict[str, list[float]] = defaultdict(list)
        self._gauges: dict[str, float] = {}
        self._start_time = time.time()

    def increment(self, name: str, value: int = 1, tags: Optional[dict] = None):
        """Incrementa un contatore."""
        key = self._make_key(name, tags)
        self._counters[key] += value

    def record(self, name: str, value: float, tags: Optional[dict] = None):
        """Registra un valore in un istogramma (per medie, percentili)."""
        key = self._make_key(name, tags)
        hist = self._histograms[key]
        hist.append(value)
        # Mantieni solo gli ultimi 1000 valori
        if len(hist) > 1000:
            self._histograms[key] = hist[-500:]

    def gauge(self, name: str, value: float, tags: Optional[dict] = None):
        """Imposta un gauge (valore puntuale)."""
        key = self._make_key(name, tags)
        self._gauges[key] = value

    def _make_key(self, name: str, tags: Optional[dict] = None) -> str:
        if not tags:
            return name
        tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}[{tag_str}]"

    def get_summary(self) -> dict[str, Any]:
        """Restituisce un riepilogo di tutte le metriche."""
        uptime = round(time.time() - self._start_time, 0)

        summary: dict[str, Any] = {
            "uptime_seconds": uptime,
            "counters": dict(self._counters),
            "gauges": dict(self._gauges),
            "histograms": {},
        }

        for key, values in self._histograms.items():
            if not values:
                continue
            sorted_vals = sorted(values)
            n = len(sorted_vals)
            summary["histograms"][key] = {
                "count": n,
                "mean": round(sum(values) / n, 2),
                "min": round(sorted_vals[0], 2),
                "max": round(sorted_vals[-1], 2),
                "p50": round(sorted_vals[n // 2], 2),
                "p95": round(sorted_vals[int(n * 0.95)], 2) if n > 1 else round(sorted_vals[0], 2),
                "p99": round(sorted_vals[int(n * 0.99)], 2) if n > 1 else round(sorted_vals[0], 2),
            }

        return summary


# ── Global Instance ──────────────────────────────────────────

_metrics = MetricsCollector()


def get_metrics() -> MetricsCollector:
    """Ottiene l'istanza globale del collector."""
    return _metrics


# ── Convenience Functions ────────────────────────────────────


def track_ai_request(endpoint: str, duration_ms: float, tokens_prompt: int = 0, tokens_completion: int = 0):
    """Registra metriche per una richiesta AI."""
    m = get_metrics()
    m.increment("ai.requests.total", tags={"endpoint": endpoint})
    m.record("ai.latency_ms", duration_ms, tags={"endpoint": endpoint})

    if tokens_prompt:
        m.increment("ai.tokens.prompt", tokens_prompt, tags={"endpoint": endpoint})
    if tokens_completion:
        m.increment("ai.tokens.completion", tokens_completion, tags={"endpoint": endpoint})


def track_cache_hit(hit: bool, prefix: str):
    """Registra hit/miss della cache."""
    m = get_metrics()
    if hit:
        m.increment("cache.hits", tags={"prefix": prefix})
    else:
        m.increment("cache.misses", tags={"prefix": prefix})


def track_embedding(duration_ms: float, text_length: int):
    """Registra metriche per una richiesta embedding."""
    m = get_metrics()
    m.record("embedding.latency_ms", duration_ms)
    m.record("embedding.text_length", text_length)
    m.increment("embedding.requests.total")


def track_error(endpoint: str, error_type: str):
    """Registra un errore."""
    m = get_metrics()
    m.increment("ai.errors.total", tags={"endpoint": endpoint, "type": error_type})
