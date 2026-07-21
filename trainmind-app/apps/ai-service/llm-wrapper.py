"""
Wrapper per llama-cpp-python server.
Avvia llama_cpp.server su porta interna 8100, espone su PORT (default 8000):
  - GET /health  -> 200 se il modello e' caricato (probe via /v1/models)
  - tutto il resto -> reverse proxy verso 127.0.0.1:8100 (streaming-safe)

Motivazione: l'ai-service di TrainMind interroga /health al boot per
attivare il provider locale. llama-cpp-python non espone /health.
Questo wrapper colma quella lacuna senza toccare il codice di ai-service.
"""
import asyncio
import os
import signal
import subprocess
import sys
import time

import httpx
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

PORT          = int(os.environ.get("PORT", 8000))
INTERNAL_PORT = int(os.environ.get("INTERNAL_PORT", 8100))
MODEL_PATH    = os.environ["MODEL_PATH"]
LORA_PATH     = os.environ.get("LORA_PATH", "")
N_CTX         = os.environ.get("N_CTX", "8192")
N_THREADS     = os.environ.get("N_THREADS", "4")

# ---------- Start llama_cpp.server as subprocess ----------
cmd = [
    sys.executable, "-m", "llama_cpp.server",
    "--model",        MODEL_PATH,
    "--n_ctx",        N_CTX,
    "--n_threads",    N_THREADS,
    "--host",         "127.0.0.1",
    "--port",         str(INTERNAL_PORT),
    "--chat_format",  "mistral-instruct",
]
if LORA_PATH and os.path.exists(LORA_PATH):
    print(f"[wrapper] loading LoRA: {LORA_PATH}", flush=True)
    cmd += ["--lora_path", LORA_PATH]
else:
    print(f"[wrapper] no LoRA at {LORA_PATH}, base only", flush=True)

print("[wrapper] starting llama_cpp.server:", " ".join(cmd), flush=True)
# llama_cpp.server (via pydantic-settings) legge anche env PORT/HOST. Sovrascrivo
# nell'env del subprocess per evitare collisione con la porta del wrapper.
sub_env = os.environ.copy()
sub_env["HOST"] = "127.0.0.1"
sub_env["PORT"] = str(INTERNAL_PORT)
proc = subprocess.Popen(cmd, env=sub_env)

def _stop(*_):
    print("[wrapper] shutting down", flush=True)
    try:
        proc.terminate()
        proc.wait(timeout=10)
    except Exception:
        proc.kill()
    sys.exit(0)

signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT,  _stop)

# ---------- FastAPI wrapper ----------
app = FastAPI(title="llm-server wrapper")

INTERNAL_BASE = f"http://127.0.0.1:{INTERNAL_PORT}"
client = httpx.AsyncClient(base_url=INTERNAL_BASE, timeout=httpx.Timeout(600.0, connect=5.0))

# Cache di health: una volta che /v1/models ha risposto 200 ALMENO UNA VOLTA,
# marca il servizio "ready" e per HEALTH_CACHE_TTL secondi torna 200 senza
# ri-probare. Cosi' durante una generazione (in cui llama_cpp.server e'
# single-threaded e non risponde) /health resta 200 e il client (ai-service)
# non chiude la stream. Ma se il modello NON e' mai stato pronto -> 503 vero,
# evitiamo che ai-service mandi chat_completion al subprocess non bindato.
HEALTH_CACHE_TTL = 600  # 10 min
_ever_ready: bool = False
_last_ok_ts: float = 0.0

@app.get("/health")
async def health():
    """200 quando il modello e' caricato.

    Stati possibili:
      - subprocess morto -> 503
      - mai visto /v1/models OK -> probe; se 200 marca _ever_ready, altrimenti 503
      - gia' ready, cache fresca -> 200 senza probe
      - gia' ready, cache scaduta -> re-probe; busy/timeout = 200 (sta lavorando)
    """
    global _ever_ready, _last_ok_ts
    import time as _time

    if proc.poll() is not None:
        return JSONResponse({"status": "down", "detail": "subprocess exited"}, status_code=503)

    now = _time.time()

    # Caso 1: mai pronto. Probe obbligatorio, 503 se non risponde 200.
    if not _ever_ready:
        try:
            r = await client.get("/v1/models", timeout=3)
            if r.status_code == 200:
                _ever_ready = True
                _last_ok_ts = now
                return JSONResponse({"status": "ok"})
        except Exception:
            pass
        return JSONResponse({"status": "loading"}, status_code=503)

    # Caso 2: gia' pronto, cache fresca.
    if (now - _last_ok_ts) < HEALTH_CACHE_TTL:
        return JSONResponse({"status": "ok", "cached": True})

    # Caso 3: gia' pronto, cache scaduta. Re-probe ma non penalizziamo busy.
    try:
        r = await client.get("/v1/models", timeout=2)
        if r.status_code == 200:
            _last_ok_ts = now
            return JSONResponse({"status": "ok"})
    except Exception:
        # subprocess vivo + gia' visto ready: probabilmente busy. 200 OK.
        return JSONResponse({"status": "ok", "detail": "busy"})
    return JSONResponse({"status": "ok", "detail": "busy"})

@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def reverse_proxy(request: Request, path: str):
    url = "/" + path
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    body = await request.body()

    req = client.build_request(
        method=request.method,
        url=url,
        headers=headers,
        content=body,
        params=dict(request.query_params),
    )
    upstream = await client.send(req, stream=True)

    async def gen():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    # Filter hop-by-hop response headers
    hbh = {"content-encoding", "transfer-encoding", "connection", "keep-alive"}
    out_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in hbh}

    return StreamingResponse(gen(), status_code=upstream.status_code, headers=out_headers)

if __name__ == "__main__":
    # Wait briefly for subprocess to bind port before serving
    for _ in range(20):
        if proc.poll() is not None:
            print("[wrapper] llama_cpp.server exited prematurely, aborting", flush=True)
            sys.exit(1)
        time.sleep(0.5)
        try:
            with httpx.Client(timeout=1.0) as c:
                if c.get(f"{INTERNAL_BASE}/v1/models").status_code in (200, 404):
                    break
        except Exception:
            pass

    print(f"[wrapper] serving on 0.0.0.0:{PORT}, proxying to {INTERNAL_BASE}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
