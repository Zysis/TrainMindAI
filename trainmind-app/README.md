# TrainMind

Piattaforma SaaS con intelligenza artificiale per preparatori fisici nel basket.

## Struttura del Progetto

```
trainmind-app/
│
├── apps/                         # Applicazioni
│   ├── web/                      # FRONTEND — Next.js 14, React 18, Tailwind CSS
│   │   ├── src/
│   │   │   ├── app/              #   App Router (pagine e layout)
│   │   │   ├── components/       #   Componenti React (ui/, layout/)
│   │   │   ├── lib/              #   Utility, costanti, hooks
│   │   │   └── styles/           #   CSS globali e design tokens
│   │   └── public/               #   Asset statici
│   │
│   ├── api/                      # BACKEND — Fastify, REST API
│   │   └── src/
│   │       ├── routes/           #   Endpoint API (/api/v1/*)
│   │       ├── plugins/          #   Plugin Fastify (auth, db, cache)
│   │       ├── middleware/        #   Middleware (RBAC, validation)
│   │       ├── schemas/          #   Schemi Zod per validazione
│   │       └── lib/              #   Config, error handler, utility
│   │
│   └── ai-service/               # AI SERVICE — Python, FastAPI (Sprint 4)
│
├── packages/                     # Codice condiviso (frontend + backend)
│   ├── db/                       #   Database — Prisma ORM, schema, migrazioni
│   │   └── prisma/schema.prisma  #   Schema con 16 entita (User, Athlete, ...)
│   ├── types/                    #   TypeScript types condivisi
│   ├── utils/                    #   Funzioni utility (sRPE, ACWR, wellness)
│   ├── ui/                       #   Componenti UI riusabili (Button, ...)
│   └── ai-sdk/                   #   Client SDK per il servizio AI
│
├── infra/                        # Configurazioni infrastruttura
├── docs/                         # Documentazione tecnica
├── seed/                         # Dati di seed per il database
│
├── docker-compose.yml            # PostgreSQL 16 + Redis 7
├── turbo.json                    # Configurazione Turborepo
├── pnpm-workspace.yaml           # Workspace pnpm
└── .github/workflows/ci.yml     # CI/CD — lint, test, build
```

## Quick Start

```bash
# 1. Installa le dipendenze
pnpm install

# 2. Copia e configura le variabili d'ambiente
copy .env.example .env

# 3. Avvia PostgreSQL e Redis
docker compose up -d

# 4. Genera il client Prisma e sincronizza il DB
pnpm db:generate
pnpm db:push

# 5. Avvia in modalita sviluppo
pnpm dev
```

Frontend: http://localhost:3000 | API: http://localhost:3001 | API Health: http://localhost:3001/api/v1/health

## Tech Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, Radix UI |
| Backend | Node.js, Fastify, Prisma ORM, Zod |
| AI Service | Python, FastAPI, LangChain, RAG |
| Database | PostgreSQL 16, Redis 7, Pinecone |
| Auth | JWT + Refresh Token, RBAC |
| Monorepo | Turborepo, pnpm workspaces |
| CI/CD | GitHub Actions |

## Comandi Principali

| Comando | Descrizione |
|---------|------------|
| `pnpm dev` | Avvia tutti i servizi in dev mode |
| `pnpm build` | Build di produzione |
| `pnpm lint` | Lint del codice |
| `pnpm type-check` | Controllo tipi TypeScript |
| `pnpm test` | Esegui i test |
| `pnpm db:generate` | Genera il client Prisma |
| `pnpm db:push` | Sincronizza schema con il DB |
| `pnpm db:migrate` | Crea una migrazione |
| `pnpm db:seed` | Popola il DB con dati di test |
