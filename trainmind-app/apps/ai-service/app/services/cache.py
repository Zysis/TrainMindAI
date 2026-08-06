"""
TrainMind AI Service — Redis Caching Layer.

Gestisce il caching di:
- Embedding queries (TTL 24h)
- Risposte AI simili (similarity matching via hash)
- Contesto atleta frequente (TTL 5min)

Se Redis non è disponibile, le operazioni falliscono silenziosamente
(graceful degradation), e l'applicazione funziona senza cache.
"""

import hashlib
import json
import time
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)

# TTL defaults (in secondi)
TTL_EMBEDDINGS = 86400       # 24 ore
TTL_AI_RESPONSE = 3600       # 1 ora
TTL_ATHLETE_CONTEXT = 300    # 5 minuti
TTL_HEALTH = 60              # 1 minuto

# In-process cache fallback quando Redis non è disponibile
_local_cache: dict[str, dict[str, Any]] = {}
_redis_client = None
_redis_available = False


def _get_redis():
    """Lazy-init del client Redis."""
    global _redis_client, _redis_available
    if _redis_client is not None:
        return _redis_client if _redis_available else None

    try:
        import redis
        _redis_client = redis.Redis(
            host="localhost",
            port=6379,
            db=1,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        _redis_client.ping()
        _redis_available = True
        logger.info("✓ Redis cache connected", db=1)
        return _redis_client
    except Exception as e:
        _redis_available = False
        _redis_client = True  # sentinel to avoid retrying every call
        logger.warning("Redis not available, using in-memory fallback", error=str(e))
        return None


def _make_key(prefix: str, data: str) -> str:
    """Crea una chiave cache normalizzata con hash SHA256."""
    h = hashlib.sha256(data.encode("utf-8")).hexdigest()[:16]
    return f"tm:ai:{prefix}:{h}"


def _local_get(key: str) -> Optional[str]:
    """Get da cache locale con expiry check."""
    entry = _local_cache.get(key)
    if entry is None:
        return None
    if entry["exp"] < time.time():
        del _local_cache[key]
        return None
    return entry["val"]


def _local_set(key: str, value: str, ttl: int):
    """Set in cache locale con expiry."""
    # Limita dimensione cache locale a ~500 entry
    if len(_local_cache) > 500:
        # Rimuovi entry scadute
        now = time.time()
        expired = [k for k, v in _local_cache.items() if v["exp"] < now]
        for k in expired:
            del _local_cache[k]
        # Se ancora troppo piena, rimuovi le più vecchie
        if len(_local_cache) > 400:
            oldest = sorted(_local_cache.items(), key=lambda x: x[1]["exp"])[:100]
            for k, _ in oldest:
                del _local_cache[k]

    _local_cache[key] = {"val": value, "exp": time.time() + ttl}


# ── Public API ──────────────────────────────────────────────


def cache_get(prefix: str, identifier: str) -> Optional[Any]:
    """
    Recupera un valore dalla cache.

    Args:
        prefix: Categoria cache (embedding, response, context)
        identifier: Stringa univoca per la richiesta

    Returns:
        Valore deserializzato o None se non trovato / scaduto
    """
    key = _make_key(prefix, identifier)

    r = _get_redis()
    if r:
        try:
            val = r.get(key)
            if val:
                logger.debug("Cache HIT (Redis)", prefix=prefix, key=key[:30])
                return json.loads(val)
        except Exception as e:
            logger.warning("Redis get error", error=str(e))
    else:
        val = _local_get(key)
        if val:
            logger.debug("Cache HIT (local)", prefix=prefix, key=key[:30])
            return json.loads(val)

    logger.debug("Cache MISS", prefix=prefix, key=key[:30])
    return None


def cache_set(prefix: str, identifier: str, value: Any, ttl: Optional[int] = None):
    """
    Salva un valore nella cache.

    Args:
        prefix: Categoria cache
        identifier: Stringa univoca per la richiesta
        value: Valore da cacheare (deve essere JSON-serializable)
        ttl: Time-to-live in secondi (default basato sul prefix)
    """
    if ttl is None:
        ttl = {
            "embedding": TTL_EMBEDDINGS,
            "response": TTL_AI_RESPONSE,
            "context": TTL_ATHLETE_CONTEXT,
            "health": TTL_HEALTH,
        }.get(prefix, TTL_AI_RESPONSE)

    key = _make_key(prefix, identifier)
    serialized = json.dumps(value, ensure_ascii=False)

    r = _get_redis()
    if r:
        try:
            r.setex(key, ttl, serialized)
            logger.debug("Cache SET (Redis)", prefix=prefix, key=key[:30], ttl=ttl)
        except Exception as e:
            logger.warning("Redis set error, falling back to local", error=str(e))
            _local_set(key, serialized, ttl)
    else:
        _local_set(key, serialized, ttl)


def cache_invalidate(prefix: str, identifier: str):
    """Invalida una entry specifica."""
    key = _make_key(prefix, identifier)

    r = _get_redis()
    if r:
        try:
            r.delete(key)
        except Exception:
            pass

    if key in _local_cache:
        del _local_cache[key]


def cache_clear_prefix(prefix: str):
    """Invalida tutte le entry con un dato prefix."""
    pattern = f"tm:ai:{prefix}:*"

    r = _get_redis()
    if r:
        try:
            keys = r.keys(pattern)
            if keys:
                r.delete(*keys)
                logger.info("Cache cleared (Redis)", prefix=prefix, count=len(keys))
        except Exception as e:
            logger.warning("Redis clear error", error=str(e))

    # Clear local
    to_del = [k for k in _local_cache if k.startswith(f"tm:ai:{prefix}:")]
    for k in to_del:
        del _local_cache[k]


def get_cache_stats() -> dict[str, Any]:
    """Restituisce statistiche della cache per monitoring."""
    stats: dict[str, Any] = {
        "backend": "redis" if _redis_available else "local",
        "local_entries": len(_local_cache),
    }

    r = _get_redis()
    if r:
        try:
            info = r.info("stats")
            stats["redis_hits"] = info.get("keyspace_hits", 0)
            stats["redis_misses"] = info.get("keyspace_misses", 0)
            total = stats["redis_hits"] + stats["redis_misses"]
            stats["hit_rate"] = (
                round(stats["redis_hits"] / total * 100, 1) if total > 0 else 0
            )
            db_info = r.info("keyspace").get("db1", {})
            stats["redis_keys"] = db_info.get("keys", 0) if isinstance(db_info, dict) else 0
        except Exception:
            pass

    return stats


def build_response_cache_key(
    prompt: str,
    namespaces: Optional[list[str]] = None,
    athlete_id: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """
    Costruisce un identificatore univoco per caching di risposte AI.
    Normalizza il prompt per aumentare la cache hit rate.

    `model` fa parte della chiave: cambiando modello le risposte in cache
    non sono più rappresentative, e servirle sarebbe fuorviante durante
    una valutazione di qualità fra modelli diversi.
    """
    normalized = prompt.strip().lower()
    parts = [normalized]
    if namespaces:
        parts.append("|".join(sorted(namespaces)))
    if athlete_id:
        parts.append(athlete_id)
    if model:
        parts.append(model)
    return "::".join(parts)
