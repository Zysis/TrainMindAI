# ============================================
# TrainMind — Backend Dockerfile (Fastify)
# ============================================

# Stage 1: Builder — full workspace install (pnpm puts each
# package's bins in its own node_modules, so partial copies break)
FROM node:20-alpine AS builder

# openssl serve a Prisma per rilevare la versione giusta del motore
# (senza, ripiega su openssl-1.1 che non esiste su Alpine recenti);
# libc6-compat è raccomandato da Prisma su Alpine
RUN apk add --no-cache openssl libc6-compat

# Chromium di sistema per Puppeteer (report PDF). Il browser che Puppeteer
# scarica da solo è compilato per glibc e su Alpine (musl) non parte: si
# installa quello dei pacchetti e si salta il download.
# Il pacchetto installa sia `chromium` sia `chromium-browser`: NON creare
# symlink, si finisce per sovrascrivere il launcher con un link a se stesso.
# `--version` in coda serve da verifica: se il nome cambiasse, il build
# fallisce qui invece di produrre un'immagine senza browser.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont \
    && chromium-browser --version
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN npm install -g pnpm

WORKDIR /app

# Non-interactive pnpm (no prompts in Docker)
ENV CI=true

# Copy entire monorepo
COPY . .

# Full install of all workspace packages
RUN pnpm install --frozen-lockfile

# Generate the Prisma client (needed at runtime by @trainmind/db)
RUN pnpm --filter @trainmind/db generate

# Build the API (senza --dts: le dichiarazioni TypeScript non servono
# a runtime e falliscono con TS5074 dentro il container)
RUN pnpm --filter @trainmind/api exec tsup src/server.ts --format esm

# ============================================

# Stage 2: Runner
# NOTE: the bundle produced by tsup keeps external imports
# (fastify, @trainmind/db, ecc.), so the runner needs the full
# workspace node_modules. We run via tsx because @trainmind/db
# is consumed as TypeScript source.
FROM builder AS runner

ENV NODE_ENV=production

WORKDIR /app/apps/api

EXPOSE 3001

# tsx è nelle devDependencies di apps/api → il bin è in apps/api/node_modules/.bin
CMD ["./node_modules/.bin/tsx", "dist/server.js"]
