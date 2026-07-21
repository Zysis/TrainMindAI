# TrainMind AI — Guida operativa: aggiornamenti, backup e manutenzione

Server: VPS IONOS — IP `31.70.77.212` — codice in `/opt/trainmind/`
Domini: `app.trainmind-app.com` (web) · `api.trainmind-app.com` (API) · `atleti.trainmind-app.com` (app atleti)

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
2. Ricostruisci **solo il servizio toccato** e riavvia (SSH sul server - ssh root@31.70.77.212):
   ```bash
   dc build web      # oppure: api, athlete, ai-service
   dc up -d
   dc ps             # attendi "healthy"
   ```

Quale servizio ricostruire: file in `apps/web/` o `packages/ui` → `web` · file in `apps/api/` o `packages/db|utils|types` → `api` (e spesso anche `web` se condivisi) · cartella `trainmind-athlete/` → `athlete` · `apps/ai-service/` → `ai-service`.

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

### Consiglio per il futuro: GitHub
Con un repo privato il flusso diventa `git push` dal PC e `git pull && dc build && dc up -d` sul server — niente più scp/tar. Quando vuoi, lo configuriamo.

---

## 2. Modifiche allo schema del database (schema.prisma)

Dopo aver caricato il nuovo `schema.prisma` sul server:
```bash
dc run --rm migrate pnpm --filter @trainmind/db exec prisma db push --accept-data-loss
dc build api && dc up -d      # rigenera il client Prisma nell'immagine
```
> `db push` allinea il DB allo schema. Con dati importanti fai PRIMA un backup manuale (sez. 3).

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
dc logs --tail=50 api        # log di un servizio (web, api, athlete, ai-service, caddy)
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

---

## 5. Promemoria

- [x] **Fine rimborso IONOS (14/08)** e **fine prezzo promo (metà ottobre)**: promemoria automatici impostati in Claude (11/08 e 10/10, ore 9:00). Migrazione eventuale = step 4-8 della GUIDA_DEPLOY_TEST + ripristino backup + aggiornamento DNS.
- [ ] **Chiudere la registrazione pubblica** quando i preparatori sono iscritti: sul server `echo "DISABLE_REGISTRATION=true" >> /opt/trainmind/trainmind-app/.env.deploy && dc up -d api` (per riaprire: rimettere `false` e ripetere `dc up -d api`). Gli inviti atleti restano attivi.
- [ ] **Email inviti atleti**: l'invio automatico è un TODO nel codice (`apps/api/src/routes/athlete.ts`) — per ora il link si copia a mano.
- [ ] **Lint da ripulire** in `apps/web` (build con `eslint.ignoreDuringBuilds`).
- [ ] **Type-check da ripulire** in `trainmind-athlete` (build con `typescript.ignoreBuildErrors`; primo errore noto in `src/app/(app)/sessions/[id]/page.tsx:62`).
- [ ] **Seed ufficiale rotto** (`packages/db/prisma/seed.ts`: manca `organization` nelle sessioni).
