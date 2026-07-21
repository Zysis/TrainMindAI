"""
TrainMind AI Service - FastAPI Application.

Servizio IA per la piattaforma di allenamento atletico TrainMind.
Gestisce LLM interactions, RAG, e vector search via OpenAI e Pinecone.
"""

import logging
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import time

from app.config import settings
from app.models.schemas import HealthCheckResponse
from app.clients.openai_client import get_openai_client
from app.clients.vector_client import get_vector_client
from app.routers import generate, coach, embed, chat, reports
from app.services.cache import get_cache_stats, cache_clear_prefix
from app.services.metrics import get_metrics, init_sentry

# Configura il logging con structlog
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

# Configura il logging standard
logging.basicConfig(
    format="%(message)s",
    level=getattr(logging, settings.log_level.upper()),
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestisce gli eventi di startup e shutdown dell'applicazione.

    Inizializza i client OpenAI e ChromaDB all'avvio,
    e esegue la pulizia al shutdown.
    """
    # Startup
    logger.info("🚀 TrainMind AI Service starting up")

    try:
        # Inizializza i client LLM (local + OpenAI fallback)
        llm_client = get_openai_client()
        provider_status = llm_client.get_provider_status()
        logger.info("✓ LLM client initialized",
                    active_provider=provider_status["active_llm_provider"],
                    local_enabled=provider_status["local_llm"]["enabled"],
                    openai_configured=provider_status["openai"]["configured"])

        vector_client = get_vector_client()
        logger.info(
            "✓ ChromaDB client initialized",
            persist_directory=settings.chroma_persist_directory,
        )

        # Inizializza Sentry (se configurato)
        init_sentry()

        logger.info("✓ All services initialized successfully")

    except Exception as e:
        logger.error("✗ Failed to initialize services", error=str(e), exc_info=True)
        raise

    yield

    # Shutdown
    logger.info("🛑 TrainMind AI Service shutting down")
    logger.info("✓ Service shutdown completed")


# Crea l'applicazione FastAPI
app = FastAPI(
    title="TrainMind AI Service",
    description="FastAPI AI Service per la piattaforma TrainMind di allenamento atletico",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In produzione, specificate i domini
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Aggiunge header X-Response-Time e logga la latenza delle richieste."""
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)
    response.headers["X-Response-Time"] = f"{duration_ms}ms"

    # Log solo per endpoint non-health e non-root
    path = request.url.path
    if path not in ("/", "/health", "/docs", "/openapi.json"):
        logger.info(
            "request_completed",
            method=request.method,
            path=path,
            status=response.status_code,
            duration_ms=duration_ms,
        )

    return response


# Global exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Gestisce le eccezioni HTTP."""
    logger.error(
        "HTTP exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Gestisce le eccezioni non previste."""
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Errore interno del server"},
    )


# Health check endpoint
@app.get("/health", response_model=HealthCheckResponse)
async def health_check() -> dict[str, Any]:
    """
    Endpoint di health check.

    Verifica lo stato del servizio e dei servizi dipendenti.

    Returns:
        HealthCheckResponse con status e stato dei servizi dipendenti
    """
    try:
        logger.debug("Health check requested")

        # Verifica lo stato dei client
        llm_client = get_openai_client()
        provider_status = llm_client.get_provider_status()

        services_status = {
            "llm_provider": provider_status["active_llm_provider"],
            "local_llm": "operational" if provider_status["local_llm"]["healthy"] else "down",
            "openai": "operational" if provider_status["openai"]["configured"] else "not_configured",
            "chroma": "operational",
        }

        try:
            vector_client = get_vector_client()
            vector_client.describe_index_stats()
        except Exception as e:
            logger.warning("ChromaDB health check failed", error=str(e))
            services_status["chroma"] = "degraded"

        logger.debug("Health check passed", services=services_status)

        return {
            "status": "healthy",
            "version": "1.0.0",
            "services": services_status,
            "providers": provider_status,
        }

    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "version": "1.0.0",
            "services": {},
        }


# Includi i router
app.include_router(generate.router)
app.include_router(coach.router)
app.include_router(embed.router)
app.include_router(chat.router)
app.include_router(reports.router)


# Metrics endpoint
@app.get("/metrics")
async def metrics() -> dict:
    """Restituisce metriche AI per monitoring dashboard."""
    collector = get_metrics()
    summary = collector.get_summary()
    # Aggiungi cache stats
    summary["cache"] = get_cache_stats()
    return summary


# Cache stats endpoint
@app.get("/cache/stats")
async def cache_stats() -> dict:
    """Restituisce statistiche sulla cache AI."""
    return get_cache_stats()


@app.delete("/cache/{prefix}")
async def clear_cache(prefix: str) -> dict[str, str]:
    """Svuota la cache per un dato prefix (embedding, response, context)."""
    cache_clear_prefix(prefix)
    return {"status": "ok", "cleared": prefix}


# Root endpoint
@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint con informazioni sul servizio."""
    return {
        "service": "TrainMind AI Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.ai_service_host,
        port=settings.ai_service_port,
        log_level=settings.log_level,
    )
