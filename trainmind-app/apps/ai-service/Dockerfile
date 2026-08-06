# ============================================
# TrainMind AI Service - Dockerfile
# ============================================

FROM python:3.11-slim

WORKDIR /app

# Installa le dipendenze di sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copia i requirements
COPY requirements.txt .

# Installa le dipendenze Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia l'applicazione
COPY app/ ./app/

# Copia i file di configurazione
COPY .env.example .env

# Espone la porta
# 3004 è la porta dell'ai-service nella convenzione del progetto:
# 3000 web · 3001 api · 3002 mobile · 3003 athlete · 3004 ai-service
EXPOSE 3004

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3004/health')" || exit 1

# Avvia l'applicazione.
# ATTENZIONE: la porta qui è fissa e AI_SERVICE_PORT non la cambia. Se la
# modifichi, aggiorna anche EXPOSE, l'healthcheck qui sopra, i tre
# docker-compose e AI_SERVICE_URL.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3004"]
