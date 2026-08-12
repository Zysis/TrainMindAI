# ============================================
# LAB21 — sito vetrina (Vite, output statico)
# Serve la radice del dominio; TrainMind vive sotto /app.
# ============================================

# Stage 1: build del sito
FROM node:20-alpine AS builder

WORKDIR /site

ENV CI=true

# Prima le dipendenze, così il layer resta in cache finché
# package-lock.json non cambia.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Indirizzo dell'app TrainMind, letto da src/js/config.js e incastonato
# nel bundle al momento della build (le VITE_* non sono leggibili a runtime).
# Vuoto = il default del config, cioè il sottopercorso relativo /app.
ARG VITE_TRAINMIND_URL=
ENV VITE_TRAINMIND_URL=$VITE_TRAINMIND_URL

RUN npm run build

# ============================================

# Stage 2: server statico
# Caddy anche qui, per coerenza con il proxy davanti: stessa immagine
# già scaricata sul VPS, nessun runtime aggiuntivo da mantenere.
FROM caddy:2-alpine AS runner

COPY --from=builder /site/dist /srv

# Server statico puro, in HTTP: il TLS lo termina il proxy davanti.
# try_files manda su index.html i percorsi senza estensione, così le
# ancore condivise (/#products) restano valide anche entrando da fuori.
RUN printf '%s\n' \
	':80 {' \
	'	root * /srv' \
	'	encode gzip' \
	'	try_files {path} {path}/ /index.html' \
	'	file_server' \
	'}' > /etc/caddy/Caddyfile

EXPOSE 80
