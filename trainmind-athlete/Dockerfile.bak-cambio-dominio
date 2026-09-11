# ============================================
# TrainMind AI — Athlete App Dockerfile (Next.js standalone)
# ============================================

# Stage 1: Builder
FROM node:20-alpine AS builder

# Versione bloccata, la stessa di `packageManager` in package.json.
# Senza il numero, npm installa l'ultima pnpm: la 10 verifica la propria
# identita' contro il lockfile e con un lock v9 fallisce con
# ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE. Un build riproducibile non
# puo' dipendere da cosa e' stato pubblicato su npm stamattina.
RUN npm install -g pnpm@9.15.4

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm build

# ============================================

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --gid 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# App singola (non monorepo): server.js sta nella radice dello standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3003

ENV HOSTNAME=0.0.0.0
ENV PORT=3003

CMD ["node", "server.js"]
