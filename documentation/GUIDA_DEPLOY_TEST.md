# TrainMind AI — Guida al deploy per i test con i preparatori

Obiettivo: mettere online `trainmind-app` su un VPS IONOS (trial 30 giorni gratuito), accessibile da internet con HTTPS, e dare accesso a 3–4 preparatori tramite **auto-registrazione**.

Stack: monorepo pnpm/turbo con **web** Next.js (3000), **api** Fastify (3001), **ai-service** Python (3002), **PostgreSQL**, **Redis**. Auth JWT; la registrazione crea un'organizzazione con l'utente come **ADMIN**.

> **File già pronti nel progetto** (creati il 14/07/2026):
> - `trainmind-app/docker-compose.deploy.yml` — compose per il VPS (build sul server, include Caddy e migrazioni)
> - `trainmind-app/infra/Caddyfile` — reverse proxy con HTTPS automatico
> - `trainmind-app/.env.deploy.example` — variabili da compilare
> - Dockerfile `api` e `web` **corretti** (l'api non partiva: CMD errato e dipendenze mancanti; il web non riceveva l'URL API in build)

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
   app.tuodominio │ api.tuodominio
        ▼                  ▼
     web:3000          api:3001 ──► ai-service:3002
                           │
                    postgres / redis
```

Solo 80/443 esposte; 3000/3001/3002 restano interne alla rete Docker.

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
Nel pannello DNS del dominio crea due record **A**:
- `app` → IP del VPS
- `api` → IP del VPS

Propagazione: da minuti a qualche ora. Verifica con `nslookup app.tuodominio.com`.

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
> Attenzione: gli `node_modules` locali NON devono finire sul server (sono enormi e specifici per Windows). Con git il problema non si pone (`.gitignore`).

### Step 6 — Configura le variabili (~10 min)
```bash
cd /opt/trainmind/trainmind-app
cp .env.deploy.example .env.deploy
nano .env.deploy
```
Compila:
- `APP_DOMAIN` / `API_DOMAIN` → i tuoi sottodomini
- `POSTGRES_PASSWORD` → output di `openssl rand -hex 24`
- `JWT_SECRET` → output di `openssl rand -hex 32`
- `OPENAI_API_KEY` → la tua chiave
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
1. `https://app.tuodominio.com` → carica la pagina di login/registrazione (HTTPS valido, lucchetto verde: ci pensa Caddy da solo).
2. `curl https://api.tuodominio.com/api/v1/health` → risposta OK.
3. Registra un account di prova, fai login, naviga la dashboard.
4. Prova una funzione AI per verificare l'ai-service.
5. `dc logs -f` per controllare eventuali errori.

---

## 4. Accesso ai preparatori (auto-registrazione)

1. Manda ai 3–4 preparatori il link `https://app.tuodominio.com` con due righe di istruzioni: "Registrati, crea la tua organizzazione, sei ADMIN del tuo spazio".
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
- [ ] Record A `app.` e `api.` → IP
- [ ] Docker + firewall sul server
- [ ] Codice in `/opt/trainmind/trainmind-app`
- [ ] `.env.deploy` compilato (segreti generati con openssl)
- [ ] `build` + `up -d` → tutti healthy
- [ ] `migrate` + `seed` eseguiti
- [ ] Smoke test ok (login, /health, funzione AI)
- [ ] Link inviato ai preparatori
- [ ] Registrazione chiusa dopo le iscrizioni
- [ ] Backup schedulato

---

*Quando arrivi a uno step e qualcosa non torna (errore di build, container non healthy, DNS), incollami l'output e lo risolviamo insieme.*
