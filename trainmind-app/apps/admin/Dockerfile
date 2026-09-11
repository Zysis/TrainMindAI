# ============================================
# TrainMind — Console di amministrazione (Next.js)
# ============================================
#
# Ricalca il Dockerfile della web app, con due differenze volute:
#  - nessun ARG NEXT_PUBLIC_*: questa app non ha nulla da inlinare a build
#    time, legge tutto da variabili a runtime;
#  - nessun `prisma generate`: la console parla con Postgres via `pg`, quindi
#    niente engine binari e niente openssl/libc6-compat su Alpine.

FROM node:20-alpine AS builder

# Versione bloccata come negli altri Dockerfile del monorepo: pnpm 10
# verifica la propria identita' contro il lockfile e con un lock v9 fallisce.
RUN npm install -g pnpm@9.15.4

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm turbo build --filter=@trainmind/admin

# ============================================

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --gid 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Nel monorepo lo standalone replica l'albero: server.js finisce in apps/admin/
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs

EXPOSE 3005

ENV HOSTNAME=0.0.0.0
ENV PORT=3005

CMD ["node", "apps/admin/server.js"]
