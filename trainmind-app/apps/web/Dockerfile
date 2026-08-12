# ============================================
# TrainMind — Frontend Dockerfile (Next.js)
# ============================================

# Stage 1: Builder — full workspace install (pnpm puts each
# package's bins in its own node_modules, so partial copies break)
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

# Non-interactive pnpm + no Next.js telemetry
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

# Copy entire monorepo
COPY . .

# Full install of all workspace packages
RUN pnpm install --frozen-lockfile

# NEXT_PUBLIC_* vars are inlined at BUILD time by Next.js:
# they must be passed as build args, not runtime env
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_ATHLETE_APP_URL=
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# Sottopercorso sotto cui l'app viene servita: vuoto se sta alla radice del
# dominio, '/app' quando alla radice c'e' il sito vetrina LAB21. Il valore
# finisce dentro il bundle: per cambiarlo serve ricostruire l'immagine.
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_ATHLETE_APP_URL=$NEXT_PUBLIC_ATHLETE_APP_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

# Build the web app with turbo
RUN pnpm turbo build --filter=@trainmind/web

# ============================================

# Stage 2: Runner (standalone output, small image)
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --gid 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy standalone output from builder
# (in un monorepo lo standalone replica l'albero: server.js sta in apps/web/)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static files accanto al server.js dentro apps/web
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy public directory
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
