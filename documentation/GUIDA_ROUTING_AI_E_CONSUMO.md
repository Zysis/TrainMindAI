# Routing modelli AI e tracciamento consumo — guida operativa

**Cosa fa questo intervento:** riduce il costo AI da ~4,50 € a ~0,76 € al mese per cliente e comincia a registrare quanto consuma ogni organizzazione.

Nessun cambiamento visibile per l'utente finale.

---

## 1. Cosa è cambiato, in breve

| Prima | Dopo |
|---|---|
| Ogni operazione AI usava `gpt-4o` | Chat, coach, wellness e report usano `gpt-4o-mini` (16 volte più economico). Generazione piani e RTP restano su `gpt-4o` |
| I token consumati venivano loggati e buttati | Ogni chiamata scrive una riga in `ai_usage_logs` con token, costo in USD e durata |
| La chat rimandava tutta la conversazione a ogni turno | Solo gli ultimi 10 messaggi |
| L'ai-service cercava un server LLM locale inesistente prima di ogni chiamata | `LOCAL_LLM_ENABLED=false` |
| Il percorso di emergenza verso OpenAI era invisibile | Anch'esso registra il consumo, con endpoint marcato `[fallback]` |

### File toccati

**Nuovi**

- `apps/api/src/lib/ai-models.ts` — routing dei modelli, listino prezzi, costo in crediti
- `apps/api/src/services/ai-usage.ts` — scrittura del log, parsing dei token dallo streaming
- `packages/db/prisma/migrations/20260804090000_add_ai_usage_log/migration.sql`

**Modificati**

- `packages/db/prisma/schema.prisma` — enum `AiOperation`, model `AiUsageLog`
- `apps/api/src/routes/ai.ts` — passa il modello, registra il consumo, nuovo `GET /ai/usage`
- `apps/api/src/routes/reports.ts` — idem per il riassunto dei report
- `apps/api/src/lib/openai-fallback.ts` — accetta un modello, restituisce i token
- `apps/api/src/schemas/ai.ts` — troncamento dello storico chat
- `apps/ai-service/app/clients/openai_client.py` — `LLMResult`, `chat_completion_full()`, `stream_options`
- `apps/ai-service/app/models/schemas.py` — `UsageInfo`, campo `model` nelle richieste
- `apps/ai-service/app/routers/{chat,coach,generate,rtp,reports}.py`
- `apps/ai-service/app/services/cache.py` — il modello entra nella chiave di cache
- `apps/ai-service/app/services/prompts.py` — `SYSTEM_PROMPT_PLAN_JSON`
- `apps/ai-service/app/main.py` — health check: `disabled` invece di `down`
- `apps/ai-service/Dockerfile`, `app/config.py` — porta 3004
- `apps/api/src/routes/training.ts` — `teamId` sui piani generati dall'AI
- `apps/web/.../dashboard/training/page.tsx` e la copia in `trainmind-mobile`
- `.env`, `.env.example`, `.env.deploy.example`, `docker-compose.yml`,
  `docker-compose.deploy.yml`, `docker-compose.prod.yml`

**Correzione a parte (bug preesistente, non legato al routing).** L'ai-service girava
sulla porta 3002 dentro il container (il `CMD` del Dockerfile), ma il compose mappava
`3004:3004`: nessuno rispondeva sulla 3004 interna, quindi il servizio era
irraggiungibile e la chat mostrava "Offline". Allineato tutto alla **3004**, che è la
porta dell'ai-service nella convenzione del progetto:

- `apps/ai-service/Dockerfile` — `EXPOSE`, `HEALTHCHECK`, `CMD --port`
- `apps/ai-service/app/config.py` — `ai_service_port`
- `apps/ai-service/.env` e `.env.example` — `AI_SERVICE_PORT` (il Dockerfile fa
  `COPY .env.example .env`, quindi finisce nell'immagine)
- `docker-compose.yml`, `.prod.yml`, `.deploy.yml` — porte, healthcheck, `AI_SERVICE_URL`
- `apps/api/src/routes/{ai,reports}.ts` — il default hardcoded `localhost:3002`
- `apps/ai-service/scripts/test_integration.py` e `README_SERVICE.md`

La `localhost:3002` nella lista CORS di `apps/api/src/app.ts` **non** è stata toccata:
lì 3002 è l'origine di `trainmind-mobile`, che resta sulla sua porta.

**Seconda correzione a parte: "Usa questo piano" non si attivava.** Emersa subito dopo
la correzione della porta, ma preesistente. L'ai-service generava i piani in markdown e
restituiva un campo `structured_data` con tabelle generiche; il frontend invece legge
`structured_plan` con la forma `{planName, description, weeks[]}` e abilita il pulsante
solo se lo trova. Il campo non è mai combaciato.

Il pulsante funzionava perché finché l'ai-service era irraggiungibile **ogni**
generazione cadeva sul percorso di emergenza, che produce JSON valido. Rendendo
raggiungibile il percorso principale, il difetto è venuto a galla.

Correzione — l'ai-service ora produce la stessa forma del fallback:

- `app/services/prompts.py` — nuovo `SYSTEM_PROMPT_PLAN_JSON`
- `app/clients/openai_client.py` — parametro `json_mode` che attiva
  `response_format: {"type":"json_object"}`. Con `json_mode` il modello locale viene
  saltato: llama-cpp non garantisce JSON valido
- `app/routers/generate.py` — `parse_structured_plan()` valida la **forma**, non solo
  la sintassi (un JSON valido ma malformato farebbe esplodere la pagina invece di
  disabilitare il pulsante); `render_plan_as_text()` produce la versione leggibile;
  `max_tokens` a 4096 per i piani, perché il JSON è più verboso del markdown e con un
  tetto basso viene troncato a metà
- `app/models/schemas.py` — campo `structured_plan`

Nessuna modifica al frontend: web e mobile leggono già `structured_plan`.

Corretto anche il formato del recupero in entrambi i percorsi: 90 secondi venivano
mostrati come "2 min" (arrotondamento), ora come "1 min 30 sec". Su un parametro di
allenamento un errore del 33% non è accettabile.

**Terza correzione a parte: i piani generati dall'AI non comparivano nell'elenco.**
`POST /training/plans/from-ai` creava il piano con `athleteId` ma **senza `teamId`**,
mentre la creazione manuale la squadra la assegnava. La lista filtra per squadra
(`if (teamId) where.teamId = teamId`), quindi il piano esisteva ma restava invisibile
a chiunque avesse una squadra selezionata — sembrava non fosse stato creato.

Non si notava in locale perché il selettore era su "Tutte le squadre": nessun filtro.
In produzione, con una squadra attiva, il piano spariva.

- `apps/api/src/routes/training.ts` — la rotta accetta `teamId` e verifica che la
  squadra appartenga all'organizzazione (senza il controllo si potrebbe attaccare un
  piano alla squadra di un'altra società)
- `apps/web/.../dashboard/training/page.tsx` e la copia mobile — passano `selectedTeamId`

Per recuperare i piani già creati senza squadra, prima la `SELECT` e poi la `UPDATE`:
potrebbero esserci piani volutamente senza squadra.

```sql
SELECT id, name, "createdAt" FROM training_plans
WHERE "teamId" IS NULL AND "organizationId" = '<id-org>';
```

**Quarta correzione: health check fuorviante.** L'ai-service riportava
`local_llm: "down"` anche quando il modello locale è spento per scelta
(`LOCAL_LLM_ENABLED=false`, la configurazione normale). "Disabilitato" e "guasto" sono
stati diversi e confonderli fa scattare falsi allarmi. Ora risponde `"disabled"`.

Aggiunto anche `REDIS_URL` verso il container redis, in dev e in produzione: mancava,
quindi la cache delle risposte puntava a `localhost` dentro il container e non
funzionava. Ogni risposta identica veniva ripagata a OpenAI.

---

## 2. Test in locale (PowerShell)

Tutti i comandi partono da `C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app`.

### 2.1 Preparazione

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app

# Servizi di supporto (postgres, redis, ai-service)
docker compose up -d postgres redis

# Genera il client Prisma con il nuovo modello AiUsageLog.
# Senza questo passaggio il type-check fallisce su app.prisma.aiUsageLog
pnpm db:generate

# Applica la migration al database locale
pnpm db:migrate
```

Su `pnpm db:migrate` Prisma chiede conferma del nome: la migration esiste già come
`20260804090000_add_ai_usage_log`, quindi dovrebbe rilevarla come già applicata o
applicarla senza chiedere nulla. Se propone di creare una migration nuova, **fermati**:
significa che lo schema e la migration sono disallineati.

### 2.2 Type-check

Questo passaggio devi lanciarlo tu: non è eseguibile dall'ambiente in cui ho lavorato.

```powershell
pnpm type-check
```

Attese: zero errori. Se compare qualcosa su `aiUsageLog`, hai saltato `pnpm db:generate`.

### 2.3 Avvio

```powershell
# Terminale 1 — ai-service. Il --build è obbligatorio la prima volta:
# senza, Docker riusa l'immagine vecchia e le modifiche Python non ci sono.
docker compose up -d --build ai-service

# Prima di proseguire: l'ai-service deve rispondere sulla 3004
Invoke-RestMethod -Uri "http://localhost:3004/health"

# Terminale 2 — API
pnpm --filter @trainmind/api dev

# Terminale 3 — web
pnpm --filter @trainmind/web dev
```

All'avvio dell'API, nei log non deve più comparire alcun tentativo di health check
verso il server LLM locale.

> **Porte — convenzione del progetto.**
>
> | Porta | Servizio |
> |---|---|
> | 3000 | web |
> | 3001 | API |
> | 3002 | mobile |
> | 3003 | athlete |
> | 3004 | **ai-service** |
>
> Fino al 4 agosto 2026 l'ai-service era incoerente: il `CMD` del Dockerfile lanciava
> uvicorn sulla **3002** (che nella convenzione è mobile), mentre il compose mappava
> `3004:3004`. Nessuno ascoltava sulla 3004 interna, quindi il servizio era
> irraggiungibile e la chat mostrava "Offline". Ora è **3004 ovunque**: Dockerfile,
> `config.py`, i tre compose, gli healthcheck e `AI_SERVICE_URL`.
>
> Attenzione: la porta nel `CMD` del Dockerfile è fissa, `AI_SERVICE_PORT` da sola
> **non** la cambia. Per spostarla servono Dockerfile, compose e `AI_SERVICE_URL`
> insieme.

**Se la chat mostra "Offline":**

```powershell
# 1. Il container è su e sano?
docker compose ps ai-service

# 2. Risponde sulla porta mappata?
Invoke-RestMethod -Uri "http://localhost:3004/health"

# 3. Cosa dicono i log?
docker compose logs --tail=50 ai-service

# 4. L'API punta alla porta giusta?
#    Deve stampare http://localhost:3004
Select-String -Path .env -Pattern "AI_SERVICE_URL"
```

Se cambi `AI_SERVICE_URL` nel `.env`, riavvia l'API: la variabile viene letta
all'avvio.

### 2.4 Verifica del routing

```powershell
# Login (sostituisci con le credenziali dell'account di test ULTRA)
$body = @{ email = "TUA_EMAIL"; password = "TUA_PASSWORD" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/login" `
  -Method Post -Body $body -ContentType "application/json"

# ATTENZIONE: il token sta in data.tokens.accessToken, non in data.accessToken
$token = $login.data.tokens.accessToken
$headers = @{ Authorization = "Bearer $token" }

# Il token dura 15 minuti (JWT_EXPIRES_IN). Se durante i test compare
# {"code":"UNAUTHORIZED","message":"Token non valido o scaduto"}, rilancia
# le tre righe qui sopra: non è un problema del codice.

# Controllo che il token ci sia davvero, prima di usarlo
if (-not $token) { Write-Error "Token non estratto — controlla la risposta di login" }

# Il routing configurato
(Invoke-RestMethod -Uri "http://localhost:3001/api/v1/ai/usage" -Headers $headers).data.routing
```

Atteso:

```
CHAT     : gpt-4o-mini
COACH    : gpt-4o-mini
WELLNESS : gpt-4o-mini
REPORT   : gpt-4o-mini
GENERATE : gpt-4o
RTP      : gpt-4o
```

### 2.5 Verifica della registrazione del consumo

```powershell
# Una domanda al coach
$q = @{ question = "Come strutturo una settimana di forza per un playmaker?" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/ai/coach" `
  -Method Post -Headers $headers -Body $q -ContentType "application/json" | Out-Null

# Il consumo registrato
$u = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/ai/usage?days=1" -Headers $headers
$u.data.totals
$u.data.byOperation | Format-Table operation, model, calls, totalTokens, costUsd
```

Attese:

- una riga con `operation = COACH` e `model = gpt-4o-mini`
- `totalTokens` maggiore di zero
- `costUsd` dell'ordine di `0,0001`–`0,002`

**Se `totalTokens` è 0**, l'ai-service non sta restituendo `usage`: controlla di aver
riavviato il container **con `--build`** dopo le modifiche
(`docker compose up -d --build ai-service`). Senza `--build` Docker riusa l'immagine
precedente e il codice Python nuovo non entra mai in gioco.

### 2.6 Verifica dello streaming

È il caso più delicato: in SSE i token non arrivano se non li si chiede esplicitamente.

Apri la chat nell'interfaccia web, manda un messaggio, poi:

```powershell
$u = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/ai/usage?days=1" -Headers $headers
$u.data.byOperation | Where-Object { $_.operation -eq "CHAT" }
```

Deve comparire una riga `CHAT` con `totalTokens` maggiore di zero. Se è 0, i token sono
stati stimati invece che riportati: controlla il campo `estimated` a database.

> **Come lanciare query psql da PowerShell.** Le colonne create da Prisma sono
> camelCase (`createdAt`, `totalTokens`), quindi in SQL vanno fra virgolette doppie,
> altrimenti Postgres le converte in minuscolo e risponde
> `column "createdat" does not exist`. Il problema è che PowerShell **rimuove le
> virgolette doppie** quando passa gli argomenti a un comando esterno come `docker`,
> qualunque sia il tipo di apici usato attorno.
>
> La soluzione affidabile è mandare la SQL su **standard input** (`-T` disattiva il
> TTY, necessario per la pipe): così la stringa non attraversa mai il parsing degli
> argomenti. È il modello usato in tutta la guida.

```powershell
'SELECT operation, model, "totalTokens", "costUsd", estimated, success FROM ai_usage_logs ORDER BY "createdAt" DESC LIMIT 10;' |
  docker compose exec -T postgres psql -U trainmind -d trainmind_db
```

### 2.6-bis Verifica dei piani strutturati

Genera un piano dall'interfaccia (Allenamenti → Genera con AI). Attese:

- il pulsante **"Usa questo piano" è cliccabile**. Era disabilitato quando l'ai-service
  restituiva markdown invece di JSON
- dopo il salvataggio il piano **compare nell'elenco** (menu Allenamenti → Mesocicli,
  che punta a `/dashboard/training`). Se non compare, controlla il selettore di squadra
  in alto a sinistra: vedi la nota sul `teamId` più sotto
- l'anteprima mostra la vista a settimane e sessioni, non il testo grezzo
- nel log dell'ai-service compare `has_structured_plan=True`
- nel consumo la riga `GENERATE` è su **`gpt-4o`**, non su mini: conferma che il
  routing distingue davvero le operazioni invece di mandare tutto sul modello economico

```powershell
docker compose logs --tail=30 ai-service | Select-String "structured_plan"

'SELECT operation, model, "totalTokens", "costUsd" FROM ai_usage_logs ORDER BY "createdAt" DESC LIMIT 5;' |
  docker compose exec -T postgres psql -U trainmind -d trainmind_db
```

Se compare l'avviso *"Piano richiesto ma JSON non valido"*, il modello non ha rispettato
lo schema: la riga di log riporta quale modello era in uso. Il pulsante resta
disabilitato ma il testo del piano è comunque visibile — è il comportamento voluto,
meglio di una pagina che esplode.

### 2.7 Verifica del troncamento chat

Nella chat web fai una conversazione lunga (più di 10 messaggi). Il modello deve
continuare a rispondere in modo coerente sugli ultimi scambi. Controlla poi che
`promptTokens` non cresca oltre un certo tetto:

```powershell
'SELECT "promptTokens", "completionTokens", "createdAt" FROM ai_usage_logs WHERE operation = ''CHAT'' ORDER BY "createdAt" DESC LIMIT 15;' |
  docker compose exec -T postgres psql -U trainmind -d trainmind_db
```

(Gli apici singoli doppiati `''CHAT''` sono il modo di scrivere un apice letterale
dentro una stringa PowerShell a apici singoli.)

`promptTokens` deve stabilizzarsi invece di crescere a ogni messaggio.

### 2.8 Verifica del percorso di emergenza

```powershell
# Spegni l'ai-service
docker compose stop ai-service

# Una domanda al coach: deve rispondere lo stesso, via OpenAI diretto
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/ai/coach" `
  -Method Post -Headers $headers -Body $q -ContentType "application/json"

# Il consumo del fallback deve essere registrato
'SELECT endpoint, model, "totalTokens" FROM ai_usage_logs WHERE endpoint LIKE ''%fallback%'' ORDER BY "createdAt" DESC LIMIT 5;' |
  docker compose exec -T postgres psql -U trainmind -d trainmind_db

docker compose start ai-service
```

Atteso: una riga con `endpoint = /ai/coach[fallback]` e `model = gpt-4o-mini`.
Era il punto cieco principale: prima questo percorso non veniva contato da nessuna parte.

### 2.9 Controllo di sanità sul costo

Prima di fidarti dei numeri, verifica che i costi siano nell'ordine di grandezza giusto.

```powershell
$u = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/ai/usage?days=1" -Headers $headers
$u.data.byOperation | Format-Table operation, model, totalTokens, costUsd
```

Regola pratica: su `gpt-4o-mini` **1.000 token costano circa 0,0004 $**. Se vedi
qualcosa come 3.700 token per 0,024 $, il modello sta venendo prezzato come `gpt-4o`:
significa che la sua versione datata non viene riconosciuta dal listino (vedi § 5).

Righe scritte prima di una correzione al listino restano con il costo vecchio, per
scelta: `costUsd` non viene mai ricalcolato, altrimenti lo storico cambierebbe sotto
i piedi. Durante i test conviene ripulire:

```powershell
# Nessuna colonna camelCase: qui gli apici bastano
docker compose exec postgres psql -U trainmind -d trainmind_db -c "DELETE FROM ai_usage_logs;"
```

### 2.10 Confronto con la fattura OpenAI

Dopo qualche giorno d'uso:

```powershell
'SELECT DATE("createdAt") d, ROUND(SUM("costUsd"),4) usd, COUNT(*) chiamate FROM ai_usage_logs GROUP BY d ORDER BY d DESC LIMIT 7;' |
  docker compose exec -T postgres psql -U trainmind -d trainmind_db
```

Confronta con la dashboard di fatturazione OpenAI. Lo scarto atteso è sotto il 5%:
il residuo sono gli embedding, che non passano da qui.

---

## 3. Deploy sulla VPS

> **Attenzione — due trappole già viste sul campo.**
>
> 1. `packages/db/prisma/migrations/` è in `.gitignore` (riga 35). Con `git pull` la
>    migration **non arriverebbe** sul server e la tabella non verrebbe creata.
>    Va trasferita con `scp`.
> 2. Il servizio `migrate` legge le migration **dall'immagine Docker**, non dal disco.
>    Serve `dc build` **prima** di `dc run --rm migrate`, altrimenti Prisma risponde
>    "No pending migrations to apply" pur essendoci la migration sul disco.

### 3.1 Trasferimento (da PowerShell, in locale)

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app

$VPS = "root@31.70.77.212"
$DEST = "/opt/trainmind/trainmind-app"

# Codice modificato
scp apps/api/src/lib/ai-models.ts            "${VPS}:${DEST}/apps/api/src/lib/"
scp apps/api/src/services/ai-usage.ts        "${VPS}:${DEST}/apps/api/src/services/"
scp apps/api/src/routes/ai.ts                "${VPS}:${DEST}/apps/api/src/routes/"
scp apps/api/src/routes/reports.ts           "${VPS}:${DEST}/apps/api/src/routes/"
scp apps/api/src/lib/openai-fallback.ts      "${VPS}:${DEST}/apps/api/src/lib/"
scp apps/api/src/schemas/ai.ts               "${VPS}:${DEST}/apps/api/src/schemas/"

scp apps/ai-service/app/clients/openai_client.py "${VPS}:${DEST}/apps/ai-service/app/clients/"
scp apps/ai-service/app/models/schemas.py        "${VPS}:${DEST}/apps/ai-service/app/models/"
scp apps/ai-service/app/services/cache.py        "${VPS}:${DEST}/apps/ai-service/app/services/"
scp apps/ai-service/app/routers/chat.py          "${VPS}:${DEST}/apps/ai-service/app/routers/"
scp apps/ai-service/app/routers/coach.py         "${VPS}:${DEST}/apps/ai-service/app/routers/"
scp apps/ai-service/app/routers/generate.py      "${VPS}:${DEST}/apps/ai-service/app/routers/"
scp apps/ai-service/app/routers/rtp.py           "${VPS}:${DEST}/apps/ai-service/app/routers/"
scp apps/ai-service/app/routers/reports.py       "${VPS}:${DEST}/apps/ai-service/app/routers/"

scp packages/db/prisma/schema.prisma         "${VPS}:${DEST}/packages/db/prisma/"
scp docker-compose.deploy.yml                "${VPS}:${DEST}/"

# Cambio porta ai-service 3002 -> 3004: servono anche questi
scp apps/ai-service/Dockerfile               "${VPS}:${DEST}/apps/ai-service/"
scp apps/ai-service/.env.example             "${VPS}:${DEST}/apps/ai-service/"
scp apps/ai-service/app/config.py            "${VPS}:${DEST}/apps/ai-service/app/"
scp apps/ai-service/app/main.py              "${VPS}:${DEST}/apps/ai-service/app/"

# Piani strutturati ("Usa questo piano")
scp apps/ai-service/app/services/prompts.py  "${VPS}:${DEST}/apps/ai-service/app/services/"

# Squadra sui piani generati dall'AI (serve anche il rebuild di web)
scp apps/api/src/routes/training.ts          "${VPS}:${DEST}/apps/api/src/routes/"
scp apps/web/src/app/dashboard/training/page.tsx `
  "${VPS}:${DEST}/apps/web/src/app/dashboard/training/"

# La migration: cartella intera, perché è fuori da git
scp -r packages/db/prisma/migrations/20260804090000_add_ai_usage_log `
  "${VPS}:${DEST}/packages/db/prisma/migrations/"
```

### 3.2 Configurazione (sul server)

```bash
ssh root@31.70.77.212
cd /opt/trainmind/trainmind-app
nano .env.deploy
```

Aggiungi in fondo:

```bash
AI_MODEL_CHAT=gpt-4o-mini
AI_MODEL_COACH=gpt-4o-mini
AI_MODEL_WELLNESS=gpt-4o-mini
AI_MODEL_REPORT=gpt-4o-mini
AI_MODEL_GENERATE=gpt-4o
AI_MODEL_RTP=gpt-4o
AI_CHAT_HISTORY_LIMIT=10
LOCAL_LLM_ENABLED=false
```

### 3.3 Build, migrate, riavvio

L'ordine conta.

```bash
cd /opt/trainmind/trainmind-app

# 1. Build PRIMA della migration
dc build api ai-service migrate

# 2. Migration
dc --profile tools run --rm migrate
```

Nell'output cerca la riga `N migrations found`: **N deve essere 22** (era 21 prima di
questo intervento). Se è inferiore, la migration non è finita nell'immagine e il build
non ha preso il file.

```bash
ls packages/db/prisma/migrations/ | grep -v migration_lock | wc -l    # deve dare 22
```

Poi:

```bash
# 3. Riavvio dei servizi. `web` serve solo se hai trasferito la pagina training.
dc up -d api ai-service web

# 4. Log
dc logs -f api ai-service
```

#### Se `migrate` non vede la migration nuova

Sintomo: `N migrations found` con N inferiore al numero di cartelle in locale.

```bash
# Contare SOLO le cartelle: `ls | wc -l` include migration_lock.toml e falsa il conto
ls -d packages/db/prisma/migrations/*/ | wc -l

# Cosa c'è davvero DENTRO l'immagine, che è ciò che Prisma legge
dc --profile tools run --rm --entrypoint sh migrate -c 'ls /app/packages/db/prisma/migrations'
```

Se la cartella è sul disco ma non nell'immagine, il `COPY . .` è stato preso dalla
cache: `dc build --no-cache migrate`.

#### Se il database è avanti rispetto alle migration

Sintomo: lo schema in produzione è corretto (la tabella esiste) ma la migration non
risulta in `_prisma_migrations`, tipicamente perché la cartella non era mai arrivata
via `scp`. **Non rieseguire la migration**: fallirebbe su un `CREATE TABLE` già
esistente. Si registra e basta, dopo aver copiato la cartella sul server:

```bash
dc --profile tools run --rm --entrypoint sh migrate -c \
  'cd packages/db && npx prisma migrate resolve --applied <nome_migration>'
```

Caso reale: il 5 agosto 2026 `20260722132554_` (audit_logs + users.deletedAt) era
applicata in produzione ma la cartella non era mai stata trasferita.

Per confrontare gli elenchi:

```bash
ls packages/db/prisma/migrations/     # sul server
```

```powershell
ls packages/db/prisma/migrations/     # in locale
```

### 3.4 Verifica post-deploy

```bash
# La tabella esiste
dc exec postgres psql -U trainmind -d trainmind_db -c "\d ai_usage_logs"

# Salute dei servizi
curl -s https://api.trainmind-app.com/api/v1/health

# L'ai-service risponde sulla NUOVA porta 3004 (rete interna)
dc exec ai-service python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:3004/health').status)"

# Entrambi i container devono risultare healthy
dc ps api ai-service
```

> Il cambio di porta dell'ai-service (3002 → 3004) richiede il **rebuild
> dell'immagine**: la porta è nel `CMD` del Dockerfile. Il `dc build ai-service`
> del passo 3.3 lo copre. Se salti il rebuild, l'api cerca la 3004 mentre il
> container vecchio è ancora sulla 3002, e l'AI risulta irraggiungibile.

Poi dall'interfaccia web in produzione: genera un piano, manda un messaggio in chat,
chiedi un insight wellness. Infine:

```bash
dc exec postgres psql -U trainmind -d trainmind_db -c \
  "SELECT operation, model, COUNT(*) n, SUM(\"totalTokens\") tok, ROUND(SUM(\"costUsd\"),5) usd
   FROM ai_usage_logs GROUP BY operation, model ORDER BY usd DESC;"
```

Attese:

- `CHAT`, `COACH`, `WELLNESS`, `REPORT` → `gpt-4o-mini`
- `GENERATE`, `RTP` → `gpt-4o`
- nessuna riga con `success = false` che non sia spiegabile

### 3.5 Se qualcosa va storto

Il ritorno indietro non richiede un rollback del codice: basta rimettere i modelli
com'erano e riavviare.

```bash
# In .env.deploy: tutte le AI_MODEL_* a gpt-4o
sed -i 's/^AI_MODEL_.*=gpt-4o-mini/&/; s/gpt-4o-mini/gpt-4o/' .env.deploy
dc up -d api
```

La tabella `ai_usage_logs` può restare: è additiva e non tocca nulla di esistente.

---

## 4. Cosa guardare nelle prossime quattro settimane

L'obiettivo di questa fase è raccogliere i dati che servono a decidere se costruire
il sistema di crediti. Tre numeri:

```sql
-- 1. Costo medio mensile per organizzazione
SELECT "organizationId",
       ROUND(SUM("costUsd"), 4) AS usd_30gg,
       COUNT(*) AS chiamate
FROM ai_usage_logs
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY "organizationId"
ORDER BY usd_30gg DESC;

-- 2. Dove va la spesa
SELECT operation, model,
       COUNT(*) AS chiamate,
       ROUND(SUM("costUsd"), 4) AS usd,
       ROUND(AVG("totalTokens")) AS token_medi
FROM ai_usage_logs
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY operation, model
ORDER BY usd DESC;

-- 3. Affidabilità
SELECT operation,
       COUNT(*) FILTER (WHERE success) AS ok,
       COUNT(*) FILTER (WHERE NOT success) AS errori,
       COUNT(*) FILTER (WHERE estimated) AS token_stimati
FROM ai_usage_logs
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY operation;
```

I criteri per decidere se procedere con le quote e la ricarica sono nel § 8 di
`SPEC_TOKENIZZAZIONE_AI.md`.

---

## 5. Note tecniche

**Perché il routing sta nell'API e non nell'ai-service.** `/ai/wellness-insights` e
`/ai/rtp-suggest` riusano entrambi l'endpoint `/ai/coach` dell'ai-service. Tre
operazioni diverse, un solo endpoint: il modello non è deducibile dall'endpoint e va
passato esplicitamente nel corpo della richiesta.

**Perché lo streaming ha bisogno di `stream_options`.** In SSE OpenAI non invia
l'oggetto `usage` a meno che non venga richiesto con
`stream_options: {"include_usage": true}`. L'ai-service inoltra quel dato come evento
SSE `{"type":"usage"}`, che l'API intercetta mentre fa da pipe verso il browser. Il
frontend ignora i tipi di evento che non conosce, quindi non è stato necessario
modificarlo. Se un giorno il provider smettesse di riportare l'uso, il codice ripiega
su una stima con `tiktoken` e marca la riga con `estimated = true`.

**Perché le risposte dalla cache non vengono conteggiate.** L'ai-service esclude
`usage` da ciò che salva in Redis: una risposta servita dalla cache non consuma token,
e contarli di nuovo gonfierebbe lo storico dei costi. Il modello fa ora parte della
chiave di cache, così cambiando modello non si servono risposte del modello precedente.

**Perché il listino cerca per prefisso e non per nome esatto.** OpenAI non restituisce
il nome che gli hai passato: risolve l'alias nella versione datata concreta. Chiedi
`gpt-4o-mini` e nella risposta trovi `gpt-4o-mini-2024-07-18`. Con una ricerca per
uguaglianza il modello non risulta a listino, il costo ricade sulla stima prudenziale
(il prezzo di `gpt-4o`) e viene **sovrastimato di ~16 volte** — proprio il numero su
cui si baserà la decisione se costruire o no il sistema di crediti. `resolvePrice()`
cerca quindi il prefisso più lungo a listino: la lunghezza conta, perché `gpt-4o` è
prefisso anche di `gpt-4o-mini-2024-07-18` e vincerebbe se si prendesse la prima
corrispondenza utile.

**Perché la registrazione non può far fallire una richiesta.** `recordAiUsage` cattura
qualsiasi errore e si limita a loggarlo. Un problema di contabilità non deve mai
impedire a un preparatore di generare un piano.
