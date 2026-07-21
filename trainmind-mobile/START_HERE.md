# TrainMind Mobile — Come avviarlo (senza toccare il codice della versione web)

Questa guida ti porta dalla cartella `trainmind-mobile` appena creata fino all'app installata sul telefono o tablet, **senza modificare nulla** della versione web in `trainmind-app`.

## Cosa contiene `trainmind-mobile/`

```
trainmind-mobile/
├── package.json            ← workspace pnpm
├── pnpm-workspace.yaml     ← elenca web/ e packages/
├── web/                    ← l'app Next.js mobile-ottimizzata (porta 3003)
│   ├── package.json        (nome: @trainmind/web-mobile)
│   ├── next.config.mjs     (proxy verso API trainmind-app)
│   ├── .env.example
│   └── src/                (UI con sidebar drawer + bottom-nav)
├── packages/
│   ├── ui/                 ← copia di @trainmind/ui
│   ├── utils/              ← copia di @trainmind/utils
│   └── types/              ← copia di @trainmind/types
├── INSTALL_MOBILE.md       ← installazione PWA su iOS/Android
└── START_HERE.md           ← questo file
```

`trainmind-mobile` è **autonoma**: ha già una copia dei pacchetti condivisi `@trainmind/ui|utils|types`. Non condivide `node_modules` con `trainmind-app`.

## Come funziona "senza toccare" la versione web

- **Backend** (`trainmind-app/apps/api` su porta `3001`): resta acceso così com'è. Mobile lo usa via HTTP.
- **Frontend web** (`trainmind-app/apps/web` su porta `3000`): resta acceso. Lo puoi tenere attivo in parallelo.
- **AI service** (`trainmind-app/apps/ai-service` su porta `3002`, container Docker): resta acceso. Mobile lo raggiunge via proxy `/api/ai-svc/*`.
- **LLM server locale** (container `llm-server` su porta `8000`): resta acceso. Servito dall'ai-service.
- **DB Postgres** (porta `5432`) e **Redis** (`6379`): container Docker, sempre attivi.
- **Frontend mobile** (`trainmind-mobile/web` su porta `3003`): si avvia separatamente. Le sue chiamate API non vanno direttamente a `:3001` o `:3002` (causerebbero errore CORS), ma passano dai **proxy interni** di Next.js, che le inoltrano ai servizi backend. Risultato: il browser pensa che tutto sia sullo stesso dominio, niente CORS, niente modifiche a `trainmind-app`.

## Prerequisiti

- Node.js ≥ 20 e pnpm ≥ 9 installati (stessi requisiti di `trainmind-app`).
- Il backend di `trainmind-app` deve essere acceso prima di avviare mobile.

## Passo 1 — Avvia il backend di `trainmind-app` (porta 3001)

Apri un primo terminale:

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm dev
```

Questo comando, grazie a `turbo dev`, fa partire tutto il monorepo originale (`apps/api` su 3001, `apps/web` su 3000, ecc.). Lascialo in esecuzione.

> Se vuoi avviare **solo** l'API senza la versione web desktop:
> ```powershell
> pnpm --filter @trainmind/api dev
> ```

## Passo 2 — Configura `.env.local` per mobile

In **un secondo terminale**, dalla cartella `trainmind-mobile/web`:

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-mobile\web
copy .env.example .env.local
```

Apri `.env.local` con un editor di testo. **Non cambiare nulla** se il backend gira in locale su 3001: i valori di default sono già giusti.

Contenuto minimo:

```dotenv
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3003
NEXT_PUBLIC_APP_NAME=TrainMind AI
API_INTERNAL_URL=http://localhost:3001
AI_INTERNAL_URL=http://localhost:3002
```

> `NEXT_PUBLIC_API_URL` deve restare **vuoto**: forza le chiamate API a essere relative (`/api/v1/...`) e a passare dal proxy.
> `API_INTERNAL_URL` (backend Fastify) e `AI_INTERNAL_URL` (FastAPI AI service) sono usati solo dal server Next.js per inoltrare le richieste ai due servizi. Mai esposti al browser.

## Passo 3 — Installa le dipendenze di mobile

Nello stesso secondo terminale, **dalla root di `trainmind-mobile`** (non da `web/`):

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-mobile
pnpm install
```

`pnpm` legge `pnpm-workspace.yaml`, vede che dentro `packages/*` ci sono `@trainmind/ui|utils|types` e li collega automaticamente a `web/` come dipendenze locali. Tempo stimato: 1–2 minuti la prima volta.

## Passo 4 — Avvia l'app mobile (porta 3003)

```powershell
pnpm dev
```

Quando vedi:

```
- Local:        http://localhost:3003
- Network:      http://192.168.x.x:3003
- Ready in 4.2s
```

apri `http://localhost:3003` nel browser e fai login con un account già esistente nel backend di `trainmind-app` (database condiviso).

> **Importante**: ora hai 3 server attivi insieme, e va bene:
> - `:3000` → `trainmind-app/apps/web` (versione desktop originale, intatta)
> - `:3001` → `trainmind-app/apps/api` (backend, intatto)
> - `:3003` → `trainmind-mobile/web` (versione mobile)
>
> Il backend non vede differenza tra i due frontend perché le richieste arrivano sempre dalla stessa origine (`localhost:3001`), grazie al proxy.

## Passo 5 — Installa la PWA sul device

Una volta che `:3003` risponde, segui il file [`INSTALL_MOBILE.md`](./INSTALL_MOBILE.md):

- Per testare da telefono/tablet sulla **stessa rete Wi-Fi**, usa l'IP `http://192.168.x.x:3003` (lo mostra `pnpm dev`). Funziona ma senza HTTPS la PWA non è installabile.
- Per **installare davvero la PWA** servono HTTPS. Modo più rapido:

```powershell
# In un terzo terminale
npx ngrok http 3003
```

ngrok stampa un URL `https://abcd1234.ngrok.io`. Aprilo da Safari (iPhone/iPad) o Chrome (Android) e segui i passi di `INSTALL_MOBILE.md`.

## Comandi utili (riassunto)

| Cosa | Comando |
|---|---|
| Avvia backend trainmind-app | `cd trainmind-app && pnpm dev` |
| Installa dipendenze mobile | `cd trainmind-mobile && pnpm install` |
| Avvia mobile in dev | `cd trainmind-mobile && pnpm dev` |
| Build produzione mobile | `cd trainmind-mobile && pnpm build` |
| Avvia mobile produzione | `cd trainmind-mobile && pnpm start` |
| Type-check | `cd trainmind-mobile && pnpm type-check` |
| Esponi mobile in HTTPS | `npx ngrok http 3003` |

## Architettura

```
        ┌────────────────────────────────┐
        │ tuo PC / server                │
        │                                │
        │ ┌──────────────┐  ┌──────────┐ │
        │ │ trainmind-app│  │trainmind │ │
        │ │              │  │_mobile   │ │
        │ │ apps/api     │◄─┤web (3003)│◄─── browser
        │ │   (3001)     │  │ Next.js  │     mobile
        │ │              │  │  proxy   │     /tablet
        │ │ apps/web     │  └──────────┘ │
        │ │   (3000)     │               │
        │ │              │◄────────────── desktop
        │ │ DB Postgres  │                │
        │ └──────────────┘                │
        └────────────────────────────────┘
```

Le due frontend (web 3000 + mobile 3003) parlano allo **stesso** backend (3001), sullo **stesso** database. Stessi utenti, stessi dati, stesso login. Cambia solo l'interfaccia.

## Domande frequenti

**Posso spegnere `apps/web` originale e tenere solo mobile?**
Sì. La versione mobile è completa e si adatta a desktop, tablet e mobile. Ferma `apps/web` se non ti serve.

**Devo aggiornare `trainmind-app` quando faccio modifiche al backend?**
Sì, ma non c'è nulla da fare sul mobile: il proxy passa qualsiasi nuovo endpoint API.

**Le modifiche fatte nei `packages/` (ui/utils/types) di trainmind-app vengono ereditate?**
No. La cartella mobile ha una **copia** dei pacchetti. Se cambi un componente UI in `trainmind-app/packages/ui`, devi copiare anche la modifica in `trainmind-mobile/packages/ui`. (Lo abbiamo fatto così perché tu hai chiesto di non dipendere da `trainmind-app`.)

Se preferisci farli convergere senza duplicazione, posso convertire `trainmind-mobile/packages/*` in symlink verso `trainmind-app/packages/*`. Chiedimelo.

**Come deployo mobile in produzione?**
Il `next.config.mjs` ha già `output: 'standalone'`. Dockerfile è presente. In `.env` di produzione metti `API_INTERNAL_URL=https://api.tuodominio.com` e `NEXT_PUBLIC_API_URL=` (vuoto). Deploy su Vercel/Fly/Render come una qualsiasi app Next.js.

## Se qualcosa non funziona

| Sintomo | Cosa controllare |
|---|---|
| `pnpm install` fallisce con "workspace protocol" | Sei nella root sbagliata? Esegui da `trainmind-mobile/`, non da `trainmind-mobile/web/` |
| 502 sul mobile alla chiamata API | Il backend `trainmind-app` non è avviato (porta 3001) |
| "Failed to fetch" nel browser | `.env.local` ha `NEXT_PUBLIC_API_URL` valorizzato? Deve essere **vuoto** |
| Mobile parte ma vedo layout desktop | Restringi la finestra sotto 768px o apri sul telefono |
| Login non riconosce le credenziali | Stai usando lo stesso DB? Le sessioni e gli utenti sono nel backend, non nel frontend |
| Porta 3003 occupata | Cambia in `web/package.json` lo script `dev` da `--port 3003` a `--port 3003`, idem in `.env.local` per `NEXT_PUBLIC_APP_URL` |
