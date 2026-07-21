# ============================================
# TrainMind AI — Backend Dockerfile (Fastify)
# ============================================

# Stage 1: Builder — full workspace install (pnpm puts each
# package's bins in its own node_modules, so partial copies break)
FROM node:20-alpine AS builder

# openssl serve a Prisma per rilevare la versione giusta del motore
# (senza, ripiega su openssl-1.1 che non esiste su Alpine recenti);
# libc6-compat è raccomandato da Prisma su Alpine
RUN apk add --no-cache openssl libc6-compat

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
