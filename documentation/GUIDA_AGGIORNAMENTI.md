# TrainMind AI — Guida operativa: aggiornamenti, backup e manutenzione

Server: VPS IONOS — IP `31.70.77.212` — codice in `/opt/trainmind/`

Indirizzi:

| Indirizzo | Cosa serve | Container |
|---|---|---|
| `trainmind-app.com/` | sito vetrina LAB21 | `lab21` |
| `trainmind-app.com/app` | web app TrainMind | `web` |
| `api.trainmind-app.com` | API | `api` |
| `atleti.trainmind-app.com` | app atleti | `athlete` |
| `app.trainmind-app.com` | vecchio indirizzo dell'app: 301 verso `/app` | — |

> Il passaggio da `app.trainmind-app.com` al sottopercorso `/app` è descritto nella sezione 1c. Finché non lo esegui, l'assetto online resta quello vecchio: le modifiche sono già nel codice ma **dormienti**, perché dipendono da variabili che nel `.env.deploy` del server non esistono ancora.

> Prerequisito: l'alias `dc` è salvato nel `~/.bashrc` del server. Se un comando `dc` non viene trovato:
> ```bash
> alias dc='docker compose -f /opt/trainmind/trainmind-app/docker-compose.deploy.yml --env-file /opt/trainmind/trainmind-app/.env.deploy'
> ```

---

## 1. Portare una modifica dal PC al server

### Caso A — Hai modificato pochi file (il più comune)

1. Copia i file modificati sul server ricalcando il percorso (PowerShell dal PC):
   ```powershell
   scp .\apps\web\src\percorso\file.tsx root@31.70.77.212:/opt/trainmind/trainmind-app/apps/web/src/percorso/file.tsx
   ```

   Per più file usa un tar (evita più scp e mantiene i percorsi):
   ```powershell
   tar -czf update.tar.gz apps/web/src/a.tsx apps/api/src/b.ts
   scp update.tar.gz root@31.70.77.212:/opt/trainmind/
   Remove-Item update.tar.gz
   ```
   ```bash
   # sul server
   tar -xzf /opt/trainmind/update.tar.gz -C /opt/trainmind/trainmind-app
   rm /opt/trainmind/update.tar.gz
   ```
2. Ricostruisci **solo il servizio toccato** e riavvia (SSH sul server - ssh root@31.70.77.212):
   ```bash
   dc build --no-cache web      # oppure: api, athlete, ai-service, lab21
   dc up -d --force-recreate web
   dc ps                        # attendi "healthy"
   ```

Quale servizio ricostruire: file in `apps/web/` o `packages/ui` → `web` · file in `apps/api/` o `packages/db|utils|types` → `api` (e spesso anche `web` se condivisi) · cartella `trainmind-athlete/` → `athlete` · `apps/ai-service/` → `ai-service` · cartella `webpage_LAB21/` → `lab21`.

> ⚠️ **Usa sempre `--no-cache`** quando aggiorni sorgenti TS/TSX. Il layer `COPY . .` del Dockerfile è ingannevole: Docker può considerarlo cached anche quando i file sono cambiati (soprattutto dopo un tar/scp), e servirti codice vecchio nel bundle mentre il sorgente nel container è quello nuovo. `--no-cache` costa 2 minuti in più ma ti garantisce che il bundle sia effettivamente rifatto. In alternativa, forza l'invalidamento con `touch /opt/trainmind/trainmind-app/apps/api/src/server.ts` prima del build.

> ⚠️ **`--force-recreate`** assicura che il nuovo container parta anche se l'immagine ha lo stesso tag: senza di lui, `dc up -d` può decidere che "il servizio è già up con quell'immagine" e non ricrearlo.

### Caso B — Tante modifiche / non ricordi cosa hai toccato

Ricarica l'intero progetto (esclude node_modules e build) e ricostruisci tutto:
```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI
robocopy trainmind-app deploy-stage /E /XD node_modules .next .turbo __pycache__ .venv venv playwright-report test-results .git dist /NFL /NDL /NJH /NJS
Remove-Item -Recurse -Force .\deploy-stage\apps\ai-service\models -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\deploy-stage\apps\ai-service\chroma_data -ErrorAction SilentlyContinue
cd deploy-stage; tar -czf ..\trainmind-app.tar.gz .; cd ..
scp .\trainmind-app.tar.gz root@31.70.77.212:/opt/trainmind/
Remove-Item -Recurse -Force .\deploy-stage; Remove-Item .\trainmind-app.tar.gz
```
```bash
# sul server
tar -xzf /opt/trainmind/trainmind-app.tar.gz -C /opt/trainmind/trainmind-app
rm /opt/trainmind/trainmind-app.tar.gz
dc build && dc up -d && dc ps
```
Stesso schema per `trainmind-athlete` (cartella e archivio dedicati, poi `dc build athlete`).

> ⚠️ Il `.env.deploy` sul server NON va mai sovrascritto o committato: contiene i segreti di produzione.

### Caso C — Hai modificato il sito vetrina LAB21

Il sito sta in un'altra cartella (`webpage_LAB21`), sorella di `trainmind-app` sia sul PC sia sul server: il `docker-compose.deploy.yml` lo cerca in `../webpage_LAB21`. Sul server deve quindi stare in `/opt/trainmind/webpage_LAB21`.

```powershell
# PowerShell dal PC
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI
robocopy webpage_LAB21 lab21-stage /E /XD node_modules dist .git sorgenti tools /NFL /NDL /NJH /NJS
cd lab21-stage; tar -czf ..\webpage_LAB21.tar.gz .; cd ..
scp .\webpage_LAB21.tar.gz root@31.70.77.212:/opt/trainmind/
Remove-Item -Recurse -Force .\lab21-stage; Remove-Item .\webpage_LAB21.tar.gz
```
```bash
# sul server
mkdir -p /opt/trainmind/webpage_LAB21
tar -xzf /opt/trainmind/webpage_LAB21.tar.gz -C /opt/trainmind/webpage_LAB21
rm /opt/trainmind/webpage_LAB21.tar.gz

dc build --no-cache lab21
dc up -d --force-recreate lab21
dc ps
```

> `sorgenti/` non va sul server: sono le immagini ad alta risoluzione di partenza, in `public/` ci sono già le versioni web. Sono decine di MB inutili da trasferire.

---

## 1c. Passaggio al dominio unico (una tantum)

Sposta l'app da `app.trainmind-app.com` a `trainmind-app.com/app` e mette il sito vetrina LAB21 alla radice. Da fare **una volta sola**: dopo, valgono le procedure normali della sezione 1.

Dettagli tecnici delle modifiche: `trainmind-app/docs/deploy-sottopercorso.md`.

### a) DNS — aggiungi il dominio nudo

Nel pannello DNS di `trainmind-app.com` serve un record **A** per la radice, che oggi probabilmente non c'è:

- `@` → `31.70.77.212`
- `www` → `31.70.77.212` (facoltativo ma consigliato)

**Non togliere** `app.` : resta puntato al VPS per servire il redirect. Verifica prima di procedere:
```powershell
nslookup trainmind-app.com
```

### b) Porta sul server il codice aggiornato

Sono cambiati sia `trainmind-app` (Caddyfile, compose, app Next) sia `webpage_LAB21` (che sul server ancora non esiste). Usa il **Caso B** per il primo e il **Caso C** per il secondo, fermandoti prima dei comandi `dc build`.

### c) Aggiungi le variabili nuove al `.env.deploy`

```bash
cd /opt/trainmind/trainmind-app
cp .env.deploy .env.deploy.bak-$(date +%F)          # rete di sicurezza

cat >> .env.deploy <<'EOF'

# ─── Dominio unico (LAB21 alla radice, TrainMind sotto /app) ───
SITE_DOMAIN=trainmind-app.com
APP_BASE_PATH=/app
# Vuota: il sito vetrina usa il percorso relativo /app dello stesso dominio.
VITE_TRAINMIND_URL=
EOF

grep -E 'SITE_DOMAIN|APP_BASE_PATH|APP_DOMAIN|VITE_' .env.deploy   # controlla
```
`APP_DOMAIN` resta dov'è: ora indica il vecchio indirizzo da reindirizzare.

### d) Ricostruisci e riavvia

```bash
dc build --no-cache web lab21
dc up -d --force-recreate web lab21 caddy
dc ps                                    # tutti "healthy"
```

`web` va **ricostruita**, non solo riavviata: il sottopercorso è una `NEXT_PUBLIC_*` e viene incastonato nel bundle durante la build. `caddy` va ricreato perché legge i domini dalle variabili d'ambiente.

### e) Verifica

```bash
curl -sI https://trainmind-app.com/            | head -1   # 200 → sito LAB21
curl -sI https://trainmind-app.com/app         | head -1   # 200 → landing TrainMind
curl -sI https://app.trainmind-app.com/dashboard | head -3 # 301 → .../app/dashboard
curl -s  https://trainmind-app.com/app/manifest.webmanifest | head -3   # icone con /app
dc logs --tail=30 caddy                                    # certificato del dominio nudo emesso
```

Dal browser: apri `trainmind-app.com`, premi "Scopri di più" (si apre in una scheda nuova sulla landing), fai login, chiedi un reset password e controlla che il link nell'email contenga `/app`.

### f) Se qualcosa va storto

Si torna indietro rimettendo il `.env.deploy` di prima e ricostruendo:
```bash
cd /opt/trainmind/trainmind-app
cp .env.deploy.bak-$(date +%F) .env.deploy
dc build --no-cache web && dc up -d --force-recreate web caddy
```
Senza `SITE_DOMAIN` e `APP_BASE_PATH` il Caddyfile nuovo non regge (servirebbe anche il Caddyfile vecchio): se devi rientrare in fretta, recupera la versione precedente di `infra/Caddyfile` da Git.

### Dopo il passaggio

- Chi aveva **installato la PWA** dal vecchio indirizzo deve reinstallarla: lo scope del service worker è legato al dominio, la vecchia registrazione resta su `app.trainmind-app.com`.
- Il redirect va **tenuto attivo a lungo**: i link di reset password già spediti e i segnalibri dei preparatori passano da lì.
- Se un domani il prodotto cambia nome: si aggiorna `SITE_DOMAIN`, si verifica il nuovo dominio su Resend, si rifà `dc build --no-cache web lab21`. Il Caddyfile non si tocca.

### Consiglio per il futuro: GitHub
Con un repo privato il flusso diventa `git push` dal PC e `git pull && dc build && dc up -d` sul server — niente più scp/tar. Quando vuoi, lo configuriamo.

---

## 2. Modifiche allo schema del database (schema.prisma)

Dopo aver caricato il nuovo `schema.prisma` sul server:
```bash
# a) BACKUP prima di toccare lo schema
/opt/trainmind/backup.sh

# b) RIBUILDA anche l'immagine "migrate" — senza questo, prisma db push
#    usa lo schema.prisma CONGELATO nell'immagine vecchia e ti dice
#    "Already in sync" senza fare nulla.
dc --profile tools build migrate

# c) Applica lo schema al DB
dc run --rm migrate pnpm --filter @trainmind/db exec prisma db push --accept-data-loss

# d) Verifica che le colonne siano davvero cambiate
docker exec trainmind-postgres psql -U trainmind -d trainmind_db -c "\d NOMETABELLA"

# e) Rigenera il client Prisma nell'immagine API e riavvia
dc build --no-cache api && dc up -d --force-recreate api
```
> `db push` allinea il DB allo schema. Con dati importanti fai PRIMA un backup manuale (sez. 3).

### Alternativa quando il servizio `migrate` è problematico

Se il `db push` non risponde (ad es. per un problema di rebuild dell'immagine `migrate`) e hai già un file di migrazione SQL idempotente in `packages/db/prisma/migrations/*/migration.sql`, puoi applicarlo direttamente al DB:
```bash
docker exec -i trainmind-postgres psql -U trainmind -d trainmind_db < \
  /opt/trainmind/trainmind-app/packages/db/prisma/migrations/DATA_NOME/migration.sql
```
Usa questo bypass solo se lo script usa `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — altrimenti rischi di rompere il DB.

## 2b. Script one-shot (seed, fix dati)

Monta lo script nel container migrate senza ricostruire nulla:
```bash
dc run --rm -v /opt/trainmind/trainmind-app/packages/db/prisma/NOME_SCRIPT.ts:/app/packages/db/prisma/NOME_SCRIPT.ts migrate \
  pnpm --filter @trainmind/db exec tsx prisma/NOME_SCRIPT.ts
```

---

## 3. Backup del database

### Configurazione (una tantum) — crea script + cron giornaliero alle 03:30
```bash
mkdir -p /opt/trainmind/backups
cat > /opt/trainmind/backup.sh <<'EOF'
#!/bin/bash
set -e
BACKUP_DIR=/opt/trainmind/backups
docker exec trainmind-postgres pg_dump -U trainmind -Fc trainmind_db > "$BACKUP_DIR/trainmind_$(date +%F_%H%M).dump"
# conserva solo gli ultimi 14 backup
ls -1t "$BACKUP_DIR"/trainmind_*.dump | tail -n +15 | xargs -r rm
EOF
chmod +x /opt/trainmind/backup.sh
(crontab -l 2>/dev/null; echo "30 3 * * * /opt/trainmind/backup.sh >> /opt/trainmind/backups/backup.log 2>&1") | crontab -
/opt/trainmind/backup.sh && ls -lh /opt/trainmind/backups   # test immediato
```

### Backup manuale (prima di operazioni rischiose)
```bash
/opt/trainmind/backup.sh
```

### Ripristino da un backup
```bash
docker exec -i trainmind-postgres pg_restore -U trainmind -d trainmind_db --clean --if-exists < /opt/trainmind/backups/trainmind_YYYY-MM-DD_HHMM.dump
```

### Copia dei backup sul tuo PC (consigliato ogni tanto)
```powershell
scp root@31.70.77.212:/opt/trainmind/backups/trainmind_*.dump C:\Users\TeamDS\Documents\backup-trainmind\
```
> I backup vivono sullo stesso VPS: se il server muore, muoiono anche loro. Scaricarli periodicamente (o inviarli a uno storage esterno) è la vera assicurazione.

---

## 4. Diagnosi rapida

```bash
dc ps                        # stato container (tutti "healthy"?)
dc logs --tail=50 api        # log di un servizio (web, api, athlete, ai-service, lab21, caddy)
dc logs -f api               # log in diretta (Ctrl+C per uscire)
dc restart api               # riavvio singolo servizio
curl https://api.trainmind-app.com/api/v1/health   # test API dall'esterno
df -h /                      # spazio disco
docker system prune -f       # pulizia immagini vecchie (se il disco si riempie)
```

Problemi noti già risolti (non reintrodurli):
- Healthcheck: usare `127.0.0.1`, mai `localhost` (risolve in IPv6 nei container)
- Prisma su Alpine: serve `apk add openssl libc6-compat` nel Dockerfile api
- Next.js standalone in monorepo: `server.js` sta in `apps/web/`, non nella radice
- Le variabili `NEXT_PUBLIC_*` sono "cotte" nella build: cambiarle richiede `dc build web`
- **Docker cache del `COPY . .`**: dopo un tar/scp Docker può considerare il layer cached e servire il **bundle vecchio** anche se il sorgente nel container è nuovo. Sintomo classico: `docker exec trainmind-api cat /app/apps/api/src/lib/legal.ts` mostra la nuova versione, ma il DB salva ancora la vecchia. Fix: usa sempre `dc build --no-cache` (vedi sez. 1).
- **Servizio `migrate` con schema stale**: il servizio `migrate` è buildato con lo stesso Dockerfile dell'API e ha lo `schema.prisma` congelato al momento della build. Dopo un cambio schema, PRIMA di `dc run --rm migrate ...` devi lanciare `dc --profile tools build migrate` (vedi sez. 2), altrimenti prisma dirà "Already in sync" ma il DB non verrà toccato.
- **Healthcheck di `web` con il basePath attivo**: la radice dell'app risponde 404 quando è servita sotto `/app`, quindi il controllo punta a `http://127.0.0.1:3000/app`. Se cambi `APP_BASE_PATH` e il container resta "unhealthy" pur rispondendo dal browser, è quasi sempre questo.
- **Sito vetrina fuori dal monorepo**: `webpage_LAB21` è una cartella sorella, non un workspace pnpm (pnpm non accetta percorsi di workspace fuori dalla root). Sul server deve stare in `/opt/trainmind/webpage_LAB21`, altrimenti `dc build lab21` fallisce con "context not found".
- **`handle` in Caddy accetta un solo matcher scritto in linea**: `handle /app /app/* { ... }` non è sintassi valida e manda il container in restart loop con *"wrong argument count or unexpected line ending"*. Per più percorsi serve un matcher con nome: `@app path /app /app/*` seguito da `handle @app { ... }`. Il resto dello stack continua a girare, ma senza Caddy nulla è raggiungibile dall'esterno: il sintomo lato browser è `ERR_CONNECTION_REFUSED` su tutti i domini.
- **Il Caddyfile è montato, non copiato nell'immagine**: dopo averlo modificato basta `dc restart caddy`, non serve alcun `build`.

---

## 5. Promemoria

- [x] **Fine rimborso IONOS (14/08)** e **fine prezzo promo (metà ottobre)**: promemoria automatici impostati in Claude (11/08 e 10/10, ore 9:00). Migrazione eventuale = step 4-8 della GUIDA_DEPLOY_TEST + ripristino backup + aggiornamento DNS.
- [ ] **Chiudere la registrazione pubblica** quando i preparatori sono iscritti: sul server `echo "DISABLE_REGISTRATION=true" >> /opt/trainmind/trainmind-app/.env.deploy && dc up -d api` (per riaprire: rimettere `false` e ripetere `dc up -d api`). Gli inviti atleti restano attivi.
- [ ] **Email inviti atleti**: l'invio automatico è un TODO nel codice (`apps/api/src/routes/athlete.ts`) — per ora il link si copia a mano.
- [ ] **Lint da ripulire** in `apps/web` (build con `eslint.ignoreDuringBuilds`).
- [ ] **Type-check da ripulire** in `trainmind-athlete` (build con `typescript.ignoreBuildErrors`; primo errore noto in `src/app/(app)/sessions/[id]/page.tsx:62`).
- [ ] **Seed ufficiale rotto** (`packages/db/prisma/seed.ts`: manca `organization` nelle sessioni).
