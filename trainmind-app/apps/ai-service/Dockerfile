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
EXPOSE 3002

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3002/health')" || exit 1

# Avvia l'applicazione
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3002"]
