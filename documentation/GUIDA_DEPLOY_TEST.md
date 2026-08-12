# TrainMind AI — Guida al deploy per i test con i preparatori

Obiettivo: mettere online `trainmind-app` su un VPS IONOS (trial 30 giorni gratuito), accessibile da internet con HTTPS, e dare accesso a 3–4 preparatori tramite **auto-registrazione**.

Stack: monorepo pnpm/turbo con **web** Next.js (3000), **api** Fastify (3001), **ai-service** Python (3004), **PostgreSQL**, **Redis**, più il **sito vetrina LAB21** (statico, cartella `webpage_LAB21`). Auth JWT; la registrazione crea un'organizzazione con l'utente come **ADMIN**.

> **File già pronti nel progetto** (creati il 14/07/2026):
> - `trainmind-app/docker-compose.deploy.yml` — compose per il VPS (build sul server, include Caddy e migrazioni)
> - `trainmind-app/infra/Caddyfile` — reverse proxy con HTTPS automatico
> - `trainmind-app/.env.deploy.example` — variabili da compilare
> - Dockerfile `api` e `web` **corretti** (l'api non partiva: CMD errato e dipendenze mancanti; il web non riceveva l'URL API in build)
>
> **Aggiornamento 11/08/2026 — dominio unico.** Il sito vetrina LAB21 sta alla
> radice del dominio e l'app è passata sotto `/app`. Se il server è già in piedi
> con il vecchio assetto, non rifare questa guida da capo: la procedura di
> migrazione è nella sezione 1c di `GUIDA_AGGIORNAMENTI.md`. I dettagli tecnici
> stanno in `trainmind-app/docs/deploy-sottopercorso.md`.

> **Runpod non serve qui**: è per noleggio GPU. Per una web-app 24/7 usa Hetzner.

---

## 1. Di cosa hai bisogno

| Cosa | Indicazione | Costo |
|---|---|---|
| **VPS IONOS** | Ubuntu 24.04, piano **VPS L+** (6 vCore / 8 GB / 240 GB NVMe). 5€/mese +IVA per 3 mesi, poi 18€; attivazione 10€. Garanzia rimborso 30 giorni | ~16€ i primi 3 mesi |
| **Dominio** | es. su Cloudflare Registrar o Namecheap | ~10€/anno |
| **Chiave OpenAI** | già pronta ✔ | a consumo |
| (Opz.) Resend | invio email/report | free tier |
| (Opz.) Stripe test | solo se testi i pagamenti | gratis |

**Perché serve RAM:** i limiti di memoria dei container sommano ~5 GB e la **build sul server** (Next.js + pnpm) è pesante. Gli 8 GB del piano L+ sono il minimo giusto (XL+ con 16 GB solo se vuoi margine: 9€/mese per 3 mesi, poi 38€).

> **Dominio**: conviene comprarlo direttamente su IONOS (~1€ il primo anno) così DNS e server stanno nello stesso pannello.

> **Nota prezzi (luglio 2026):** Hetzner ha aumentato i listini il 15/06/2026 (CPX32 → ~35€+IVA), per questo si è passati a IONOS. Alternativa stabile a lungo termine: Netcup VPS 1000 G11 (~9€/mese). **Prima della fine del trial IONOS**: decidere se restare (prezzo pieno) o migrare (basta rifare gli step 4-8 sul nuovo server + ripristinare il backup del DB).

---

## 2. Architettura online

```
                    Internet (preparatori)
                            │ HTTPS 443
                            ▼
                Caddy (reverse proxy, container)
    ┌───────────────┬───────┴────────┬──────────────────┐
    │ tuodominio/   │ tuodominio/app │ api.tuodominio   │ atleti.tuodominio
    ▼               ▼                ▼                  ▼
 lab21:80        web:3000         api:3001 ──► ai-service:3004
 (sito vetrina)  (web app)           │
                                postgres / redis

 app.tuodominio → 301 verso tuodominio/app  (vecchio indirizzo dell'app)
```

Il percorso utente parte dal sito vetrina: `tuodominio.com` racconta LAB21 e
TrainMind, il pulsante "Scopri di più" apre la landing dell'app su
`tuodominio.com/app`, da cui si fa login o registrazione.

Solo 80/443 esposte; 3000/3001/3004 restano interne alla rete Docker.

---

## 3. Step-by-step

### Step 1 — Compra il dominio (~10 min)
1. Vai su un registrar (consigliati: **Cloudflare Registrar** per il prezzo, o Namecheap per semplicità).
2. Compra un dominio (es. `trainmind-test.com` va benissimo per i test).
3. Non serve altro per ora: il DNS lo configuri allo Step 3.

### Step 2 — Crea il VPS su IONOS (~15 min)
1. Vai su ionos.it → Server → Hosting VPS → piano **VPS L+** (6 vCore / 8 GB / 240 GB, "Più venduto") → Continua. Nota: il "gratis 30 giorni" è una garanzia di rimborso, non un mancato addebito (recesso entro 14 gg, rimborso totale entro 30 gg).
2. Scegli **Ubuntu 24.04**, **senza Plesk** (+5€/mese inutili), datacenter EU (Germania o Spagna). **Rifiuta tutti gli extra** proposti al checkout (backup, IPv4 extra, email, MyDefender).
3. Se possibile aggiungi la tua **chiave SSH** (se non ne hai una, su PowerShell: `ssh-keygen -t ed25519`, poi incolla il contenuto di `C:\Users\TeamDS\.ssh\id_ed25519.pub`); altrimenti IONOS ti dà la password di root iniziale — cambiala al primo accesso con `passwd`.
4. Annota l'**IP pubblico** (pannello Cloud → Server).
5. ⚠️ **Firewall IONOS**: oltre al firewall del server (Step 4), IONOS applica una **policy firewall esterna** dal pannello. Vai su Rete → Policy firewall e assicurati che siano aperte le porte **22 (SSH), 80 (HTTP), 443 TCP e UDP (HTTPS)**. Se salti questo passo, il sito non risponderà anche se sul server è tutto ok.
6. 📅 **Metti un promemoria a ~25 giorni da oggi**: decidere se tenere IONOS a prezzo pieno o migrare (es. Netcup ~9€/mese).

### Step 3 — Punta il DNS al VPS (~5 min + attesa)
Nel pannello DNS del dominio crea i record **A**:
- `@` (dominio nudo) → IP del VPS — è il sito vetrina LAB21, con l'app sotto `/app`
- `www` → IP del VPS (facoltativo)
- `api` → IP del VPS
- `atleti` → IP del VPS
- `app` → IP del VPS — non serve più a servire l'app, ma tenerlo puntato fa
  funzionare il redirect verso `/app` per i link già in circolazione

Propagazione: da minuti a qualche ora. Verifica con `nslookup tuodominio.com`.

### Step 4 — Prepara il server (~10 min)
```bash
ssh root@IP_DEL_VPS

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version

apt install -y ufw
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
```

### Step 5 — Porta il codice sul server

Sul server servono **due cartelle sorelle**, perché il compose costruisce il sito
vetrina da `../webpage_LAB21`:

```
/opt/trainmind/
├── trainmind-app/     monorepo (web, api, ai-service) + docker-compose.deploy.yml
└── webpage_LAB21/     sito vetrina LAB21
```

Consigliato: repo **privato** su GitHub (semplifica gli aggiornamenti con `git pull`):
```bash
# sul server
mkdir -p /opt/trainmind && cd /opt/trainmind
git clone <URL_REPO_PRIVATO> .
cd trainmind-app
```
In alternativa, copia da locale **escludendo node_modules** (PowerShell dal tuo PC):
```powershell
scp -r C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\apps `
       C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\packages `
       C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\infra `
       C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\*.json `
       C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\*.yaml `
       C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\*.yml `
       C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\.env.deploy.example `
       root@IP_DEL_VPS:/opt/trainmind/trainmind-app/
```
E il sito vetrina, nella cartella accanto:
```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI
robocopy webpage_LAB21 lab21-stage /E /XD node_modules dist .git sorgenti tools /NFL /NDL /NJH /NJS
cd lab21-stage; tar -czf ..\webpage_LAB21.tar.gz .; cd ..
scp .\webpage_LAB21.tar.gz root@IP_DEL_VPS:/opt/trainmind/
Remove-Item -Recurse -Force .\lab21-stage; Remove-Item .\webpage_LAB21.tar.gz
```
```bash
# sul server
mkdir -p /opt/trainmind/webpage_LAB21
tar -xzf /opt/trainmind/webpage_LAB21.tar.gz -C /opt/trainmind/webpage_LAB21
rm /opt/trainmind/webpage_LAB21.tar.gz
```
> Attenzione: gli `node_modules` locali NON devono finire sul server (sono enormi e specifici per Windows). Con git il problema non si pone (`.gitignore`). Della cartella `sorgenti/` di LAB21 non serve nulla: contiene le immagini ad alta risoluzione di partenza, in `public/` ci sono già le versioni web.

### Step 6 — Configura le variabili (~10 min)
```bash
cd /opt/trainmind/trainmind-app
cp .env.deploy.example .env.deploy
nano .env.deploy
```
Compila:
- `SITE_DOMAIN` → il dominio nudo (es. `tuodominio.com`): vetrina alla radice, app sotto `/app`
- `APP_BASE_PATH` → `/app` (cambiandolo vanno ricostruiti `web` e `lab21`)
- `APP_DOMAIN` → il vecchio `app.tuodominio.com`, che verrà reindirizzato
- `API_DOMAIN` / `ATHLETE_DOMAIN` → i sottodomini di API e app atleti
- `POSTGRES_PASSWORD` → output di `openssl rand -hex 24`
- `JWT_SECRET` → output di `openssl rand -hex 32`
- `OPENAI_API_KEY` → la tua chiave
- `VITE_TRAINMIND_URL` → lasciala **vuota**: il sito vetrina usa il percorso
  relativo `/app` dello stesso dominio. Si valorizza solo se un domani l'app
  finisce su un dominio diverso dalla vetrina.
- Il resto può restare vuoto per i test.

### Step 7 — Build e avvio (~15–30 min la prima volta)
```bash
docker compose -f docker-compose.deploy.yml --env-file .env.deploy build
docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d
docker compose -f docker-compose.deploy.yml --env-file .env.deploy ps   # attendi "healthy"
```
> Comodo: `alias dc='docker compose -f docker-compose.deploy.yml --env-file .env.deploy'` e poi usa solo `dc ps`, `dc logs -f api`, ecc.

### Step 8 — Migrazioni e seed del database
```bash
dc run --rm migrate                                    # applica lo schema (prisma migrate deploy)
dc run --rm migrate pnpm --filter @trainmind/db seed   # dati di riferimento (esercizi, ecc.)
```

### Step 9 — Smoke test
1. `https://tuodominio.com` → carica il sito vetrina LAB21 (HTTPS valido, lucchetto verde: ci pensa Caddy da solo).
2. Premi **"Scopri di più"** → si apre in una scheda nuova `https://tuodominio.com/app`, la landing di TrainMind con login e registrazione.
3. `https://app.tuodominio.com/dashboard` → deve rispondere **301** verso `https://tuodominio.com/app/dashboard`.
4. `curl https://api.tuodominio.com/api/v1/health` → risposta OK.
5. Registra un account di prova, fai login, naviga la dashboard.
6. Reset password: il link nell'email deve contenere `/app`.
7. `curl -s https://tuodominio.com/app/manifest.webmanifest` → i percorsi delle icone iniziano con `/app`.
8. Prova una funzione AI per verificare l'ai-service.
9. `dc logs -f` per controllare eventuali errori.

---

## 4. Accesso ai preparatori (auto-registrazione)

1. Manda ai 3–4 preparatori il link `https://tuodominio.com` (partono dal sito vetrina) oppure direttamente `https://tuodominio.com/app` con due righe di istruzioni: "Registrati, crea la tua organizzazione, sei ADMIN del tuo spazio".
2. Ogni preparatore ottiene un workspace **isolato** — testano anche l'onboarding reale.
3. **Quando si sono registrati tutti, chiudi la porta**: la registrazione è pubblica e chiunque trovi l'URL potrebbe iscriversi. Opzioni (posso preparartele):
   - basic-auth temporaneo davanti al sito via Caddy (una password condivisa in più);
   - flag lato API per disabilitare le nuove registrazioni.

---

## 5. Sicurezza e manutenzione (minimo indispensabile)

- **Backup DB giornaliero** (cron sul server):
  ```bash
  dc exec postgres pg_dump -U trainmind trainmind_db > /root/backup_$(date +%F).sql
  ```
- **Aggiornamenti codice**: `git pull` poi `dc up -d --build`.
- **Costi OpenAI**: monitora il consumo su platform.openai.com (l'ai-service usa GPT-4o).
- Mai committare `.env.deploy`.

---

## 6. Checklist

- [ ] Dominio comprato
- [ ] VPS IONOS L+ Ubuntu 24.04 creato, IP annotato
- [ ] Policy firewall IONOS: porte 22/80/443 (TCP+UDP) aperte dal pannello
- [ ] Promemoria fine trial (~25 giorni) impostato
- [ ] Record A `@`, `www`, `api.`, `atleti.`, `app.` → IP
- [ ] Docker + firewall sul server
- [ ] Codice in `/opt/trainmind/trainmind-app` **e** `/opt/trainmind/webpage_LAB21`
- [ ] `.env.deploy` compilato (`SITE_DOMAIN`, `APP_BASE_PATH`, segreti con openssl)
- [ ] `build` + `up -d` → tutti healthy (`lab21` compreso)
- [ ] `migrate` + `seed` eseguiti
- [ ] Smoke test ok (vetrina, "Scopri di più" → `/app`, redirect da `app.`, login, /health, funzione AI)
- [ ] Link inviato ai preparatori
- [ ] Registrazione chiusa dopo le iscrizioni
- [ ] Backup schedulato

---

*Quando arrivi a uno step e qualcosa non torna (errore di build, container non healthy, DNS), incollami l'output e lo risolviamo insieme.*
