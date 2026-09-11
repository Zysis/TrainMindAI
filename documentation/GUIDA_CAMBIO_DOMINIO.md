# TrainMind — Guida operativa: trasloco su `lab21sport.com`

Server: VPS IONOS — IP `31.70.77.212` — codice in `/opt/trainmind/`

Operazione **una tantum**. Sposta tutto da `trainmind-app.com` a `lab21sport.com`,
tenendo il vecchio dominio vivo come redirect. Dopo, valgono le procedure normali
della sezione 1 di `GUIDA_AGGIORNAMENTI.md`.

## Assetto prima e dopo

| Cosa | Prima | Dopo | Container |
|---|---|---|---|
| Sito vetrina LAB21 | `trainmind-app.com/` | `lab21sport.com/` | `lab21` |
| Web app TrainMind | `trainmind-app.com/app` | `lab21sport.com/app` | `web` |
| API | `api.trainmind-app.com` | `api.lab21sport.com` | `api` |
| App atleti (PWA) | `atleti.trainmind-app.com` | `atleti.lab21sport.com` | `athlete` |
| Console admin | `admin.trainmind-app.com` | `admin.lab21sport.com` | `admin` |
| Vecchio indirizzo app | `app.trainmind-app.com` → 301 | `app.lab21sport.com` → 301 | — |

`APP_BASE_PATH` **resta `/app`**: la landing del prodotto passa da
`https://trainmind-app.com/app?landing=%2F` a `https://lab21sport.com/app?landing=%2F`
senza altre modifiche. Il parametro `?landing=` è attribuzione
(`apps/web/src/lib/attribution.ts`), non ha niente a che vedere col dominio.

> ⚠️ Il vecchio dominio **non si spegne e non si lascia scadere**. Da lì passano i
> link di reset password già spediti, i segnalibri dei preparatori e le PWA già
> installate sui telefoni degli atleti. Tienilo rinnovato e puntato al VPS.

> Prerequisito: alias `dc` nel `~/.bashrc` del server. Se manca:
> ```bash
> alias dc='docker compose -f /opt/trainmind/trainmind-app/docker-compose.deploy.yml --env-file /opt/trainmind/trainmind-app/.env.deploy'
> ```

---

## Passo 0 — Acquista il dominio

`lab21sport.com` risulta **libero** (nessuna registrazione nel registro `.com`).
Compralo su **IONOS**, stesso pannello DNS degli altri: eviti il giro di deleghe
e i record li gestisci da un posto solo.

Al checkout: rifiuta gli upsell (sito, SSL, "protezione"). Sulla casella email
vedi il Passo 7b: può convenire attivarla qui, ma non è obbligatoria adesso.
La privacy WHOIS inclusa va bene. Attiva il rinnovo automatico.

### Sì, per un periodo paghi due domini

| | Oggi | Dal 14/07/2027 |
|---|---|---|
| `trainmind-app.com` | 5,00 EUR netti/anno (scontato fino al 13/07/2027) | 18,30 EUR lordi/anno |
| `lab21sport.com` | ~1 EUR il primo anno, poi ~18,30 EUR lordi | 18,30 EUR lordi/anno |

Da qui a luglio 2027 la sovrapposizione costa **circa 7 EUR in tutto**. A regime
sarebbero ~36,60 EUR/anno invece di 18,30: +1,50 EUR/mese su un ricorrente che a
ottobre 2026 sale comunque a ~22 EUR/mese per il VPS. È rumore di fondo.

**Non è per sempre.** Il vecchio dominio serve finché esiste qualcosa che ci
punta: i link di reset già spediti (scadono in ore), i segnalibri dei
preparatori (sono quattro persone, basta avvisarle), le PWA installate sui
telefoni degli atleti (questo è il vincolo vero) e il posizionamento della
vetrina su Google.

Il rinnovo di `trainmind-app.com` cade il **13/07/2027**: è la data in cui
decidere. Se a giugno 2027 i log di Caddy mostrano che sul vecchio dominio non
arriva più nessuno, non lo rinnovi e torni a un dominio solo. Se ci arriva
ancora qualcuno, 18,30 EUR l'anno per non rompere niente sono soldi ben spesi:
un dominio dismesso e ricomprato da altri è un problema serio, non un fastidio.

## Passo 1 — Abbassa il TTL sul vecchio dominio

Nel DNS di `trainmind-app.com` porta i TTL a **300 secondi** e aspetta almeno
mezza giornata. Serve solo a poter tornare indietro in fretta: se lasci il TTL a
un'ora, un errore resta in giro per un'ora.

## Passo 2 — DNS del nuovo dominio

Nel pannello DNS di `lab21sport.com`, record **A** verso `31.70.77.212`:

| Nome | Tipo | Valore |
|---|---|---|
| `@` | A | `31.70.77.212` |
| `www` | A | `31.70.77.212` |
| `app` | A | `31.70.77.212` |
| `api` | A | `31.70.77.212` |
| `atleti` | A | `31.70.77.212` |
| `admin` | A | `31.70.77.212` |

Verifica dal PC **prima** di andare avanti:
```powershell
nslookup lab21sport.com
nslookup api.lab21sport.com
nslookup atleti.lab21sport.com
```

> ⚠️ Non ricostruire niente finché i nomi non risolvono davvero. Caddy chiede i
> certificati a Let's Encrypt al primo avvio: i tentativi falliti consumano il
> rate limit (5 fallimenti per host per ora) e poi ti tocca aspettare.

---

## Passo 3 — Modifiche al codice (sul PC)

> ✅ **Già applicate il 7/09/2026.** I cinque file elencati qui sotto sono
> stati modificati sul PC; di ognuno esiste una copia dell'originale con
> suffisso `.bak-cambio-dominio` accanto al file (cancellabili dopo che il
> deploy è andato a buon fine). Quanto segue resta come documentazione di
> *cosa* è cambiato e perché — non va rieseguito.

Cinque file. Nessuno di questi contiene il dominio "per caso": sono i punti dove
il nome finisce dentro un bundle o dentro un certificato.

### 3.1 `trainmind-app/infra/Caddyfile` — blocchi del vecchio dominio

Le direttive esistenti usano le variabili (`{$SITE_DOMAIN}`, `{$API_DOMAIN}`…) e
dopo il Passo 5 indicheranno il dominio nuovo: si aggiornano da sole. Ma i
**vecchi** nomi spariscono dal file, e un nome che Caddy non conosce non ottiene
il certificato: chi ci arriva vede un errore di sicurezza, non un redirect.

Aggiungi in fondo al file, con i nomi **scritti per esteso**:

```caddyfile
# ─────────────────────────────────────────────────────────────────────
# VECCHIO DOMINIO trainmind-app.com — da tenere attivo a lungo.
# Nomi letterali e non variabili: le variabili ormai indicano il dominio
# nuovo. Senza questi blocchi Caddy non emette più il certificato per i
# vecchi nomi.
# ─────────────────────────────────────────────────────────────────────

trainmind-app.com, www.trainmind-app.com {
	redir https://{$SITE_DOMAIN}{uri} permanent
}

app.trainmind-app.com {
	redir https://{$SITE_DOMAIN}{$APP_BASE_PATH}{uri} permanent
}

# API e app atleti: proxy veri, NON redirect.
# Due motivi: un 301 su una POST fa perdere il corpo della richiesta ai
# client vecchi, e la PWA già installata sui telefoni degli atleti è
# legata a questo dominio — finché non la reinstallano, qui deve
# rispondere l'applicazione, non un rimando.
api.trainmind-app.com {
	reverse_proxy api:3001
	encode gzip
}

atleti.trainmind-app.com {
	reverse_proxy athlete:3003
	encode gzip
}
```

> ⚠️ Metti `www.trainmind-app.com` nel primo blocco **solo se quel record A
> esiste davvero** nel DNS del vecchio dominio. Un nome che non risolve fa
> fallire la richiesta del certificato e Caddy continua a riprovare a vuoto.
> Nel dubbio, controlla con `nslookup www.trainmind-app.com` e in caso togli
> quella voce.

### 3.2 `trainmind-app/docker-compose.deploy.yml` — build arg per l'app atleti

Oggi il servizio `athlete` non riceve l'URL della web app, e il codice ripiega su
un indirizzo cablato. Aggiungi gli `args` al blocco `athlete:` (riga ~195):

```yaml
  athlete:
    build:
      context: ../trainmind-athlete
      dockerfile: Dockerfile
      args:
        # Base dei link a Termini e Cookie, che vivono nella web app.
        # Next la incastona nel bundle: è una ARG di build, non una
        # variabile a runtime.
        NEXT_PUBLIC_APP_WEB_URL: https://${SITE_DOMAIN}${APP_BASE_PATH:-/app}
```

**Facoltativo ma consigliato per il periodo di transizione** — nel servizio `api`
(riga ~147) allarga il CORS ai vecchi indirizzi. La variabile accetta un elenco
separato da virgole (`apps/api/src/app.ts:84`), e serve anche alla CSP:

```yaml
      CORS_ORIGIN: https://${SITE_DOMAIN},https://trainmind-app.com,https://app.trainmind-app.com
```
Fra qualche settimana rimetti il solo `https://${SITE_DOMAIN}`.

### 3.3 `trainmind-athlete/Dockerfile` — accetta la ARG

Nello stage `builder`, subito **prima** di `RUN pnpm build`:

```dockerfile
# URL pubblico della web app. Next lo inlinea nel bundle a build time:
# passarlo solo come variabile d'ambiente del container non avrebbe effetto.
ARG NEXT_PUBLIC_APP_WEB_URL
ENV NEXT_PUBLIC_APP_WEB_URL=$NEXT_PUBLIC_APP_WEB_URL
```

### 3.4 `trainmind-athlete/src/components/layout/legal-links.tsx` (riga 19)

```diff
-const APP_WEB_URL =
-  process.env.NEXT_PUBLIC_APP_WEB_URL || 'https://app.trainmind-app.com';
+const APP_WEB_URL =
+  process.env.NEXT_PUBLIC_APP_WEB_URL || 'https://lab21sport.com/app';
```

### 3.5 `trainmind-athlete/src/app/(auth)/register/page.tsx` (riga 169)

Il link ai Termini è cablato. Sostituiscilo con la stessa variabile:

```diff
-              <a href="https://app.trainmind-app.com/terms" target="_blank" rel="noreferrer" className="font-medium text-teal-600 underline">
+              <a href={`${process.env.NEXT_PUBLIC_APP_WEB_URL || 'https://lab21sport.com/app'}/terms`} target="_blank" rel="noreferrer" className="font-medium text-teal-600 underline">
```

### 3.6 Ritocchi non urgenti (non bloccano il deploy)

- `trainmind-app/.env.deploy.example` — sostituisci gli esempi `tuodominio.com` e
  i mittenti `noreply@trainmind-app.com`.
- `trainmind-app/apps/api/.env.example` righe 41-42 — commento con il dominio Resend.
- `webpage_LAB21/index.html` riga 16 — `og:image` è relativo: quando condividi il
  sito su WhatsApp/LinkedIn l'anteprima non carica. Colto il momento, mettilo
  assoluto e aggiungi `og:url`:
  ```html
  <meta property="og:url" content="https://lab21sport.com/">
  <meta property="og:image" content="https://lab21sport.com/assets/img/hero3-1920.webp">
  ```

---

## Passo 4 — Porta il codice sul server

Due cartelle toccate: `trainmind-app` e `trainmind-athlete`.

```powershell
# dalla cartella trainmind-app
tar -czf update.tar.gz infra/Caddyfile docker-compose.deploy.yml
scp update.tar.gz root@31.70.77.212:/opt/trainmind/
Remove-Item update.tar.gz

# dalla cartella trainmind-athlete
tar -czf athlete.tar.gz Dockerfile src/components/layout/legal-links.tsx "src/app/(auth)/register/page.tsx"
scp athlete.tar.gz root@31.70.77.212:/opt/trainmind/
Remove-Item athlete.tar.gz
```

```bash
# sul server — ssh root@31.70.77.212
tar -xzf /opt/trainmind/update.tar.gz  -C /opt/trainmind/trainmind-app
tar -xzf /opt/trainmind/athlete.tar.gz -C /opt/trainmind/trainmind-athlete
rm /opt/trainmind/update.tar.gz /opt/trainmind/athlete.tar.gz
```

## Passo 5 — `.env.deploy` sul server

```bash
cd /opt/trainmind/trainmind-app
cp .env.deploy .env.deploy.bak-$(date +%F)          # rete di sicurezza

sed -i \
  -e 's|^SITE_DOMAIN=.*|SITE_DOMAIN=lab21sport.com|' \
  -e 's|^APP_DOMAIN=.*|APP_DOMAIN=app.lab21sport.com|' \
  -e 's|^API_DOMAIN=.*|API_DOMAIN=api.lab21sport.com|' \
  -e 's|^ATHLETE_DOMAIN=.*|ATHLETE_DOMAIN=atleti.lab21sport.com|' \
  -e 's|^ADMIN_DOMAIN=.*|ADMIN_DOMAIN=admin.lab21sport.com|' \
  .env.deploy

grep -E '^(SITE|APP|API|ATHLETE|ADMIN)_DOMAIN|^APP_BASE_PATH|^VITE_' .env.deploy
```

`APP_BASE_PATH=/app` e `VITE_TRAINMIND_URL=` (vuota) **non si toccano**: il sito
vetrina usa il percorso relativo dello stesso dominio, quindi segue il trasloco
da solo.

`CORS_ORIGIN`, `APP_PUBLIC_URL` e `ATHLETE_APP_URL` non stanno nel `.env.deploy`:
sono composti dentro `docker-compose.deploy.yml` a partire da queste variabili.
Si aggiornano da soli — ma il Passo 8 li verifica lo stesso.

## Passo 6 — Ricostruisci e riavvia

```bash
cd /opt/trainmind/trainmind-app
dc build --no-cache web athlete lab21
dc up -d --force-recreate web athlete lab21 api caddy
dc ps                          # attendi che siano tutti "healthy"
dc logs --tail=40 caddy        # deve emettere i certificati dei nomi nuovi
```

Perché proprio questi:

- **`web`** va *ricostruita*: `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_APP_URL` sono
  build arg, Next li scrive dentro il bundle. Riavviare non basta.
- **`athlete`** idem, per il link ai Termini.
- **`lab21`** per sicurezza (build arg `VITE_TRAINMIND_URL`, anche se vuoto).
- **`api`** solo ricreata: legge i domini a runtime.
- **`caddy`** ricreata perché prende i domini dalle variabili d'ambiente.
- **`admin`**, **`ai-service`**, `postgres` e `redis` non si toccano: nessuno
  dei tre conosce il dominio. Ad `admin` ci pensa Caddy dall'esterno.

> ⚠️ `--no-cache` non è pignoleria: il layer `COPY . .` viene spesso considerato
> valido dalla cache dopo un tar/scp, e ti ritrovi il dominio vecchio nel bundle
> mentre il sorgente nel container è quello nuovo.

## Passo 7 — Resend (email di reset e inviti)

> ✅ **Fatto il 7/09/2026**: `lab21sport.com` risulta *Verified* su Resend
> accanto a `trainmind-app.com`. **I due domini convivono**: contrariamente a
> quanto si legge sulla documentazione del piano gratuito, l'account non ha
> imposto il limite di un solo dominio, quindi non c'è stata nessuna finestra
> senza email. Il vecchio resta verificato e spedisce finché non lo togli tu.

1. Su Resend → *Domains* → **Add domain**: nome `lab21sport.com`, region
   **Ireland (eu-west-1)**, *Custom Return-Path* `send` (da non toccare: è ciò
   che tiene gli MX di Resend fuori dalla radice), *Tracking Subdomain* vuoto —
   riscrivere i link in un'email di reset password peggiora solo la
   consegnabilità. *Enable Receiving* spento.
2. Copia i tre record nel pannello IONOS di `lab21sport.com`. Nella colonna
   "Nome host" va **solo l'etichetta**, senza il dominio: IONOS lo aggiunge da sé.

   | Tipo | Nome host | Valore | Priorità |
   |---|---|---|---|
   | TXT | `resend._domainkey` | la chiave `p=MIGf…IDAQAB` | — |
   | MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | `10` |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

   Copia i valori con l'icona di copia di Resend, mai a mano: la chiave DKIM
   supera i 200 caratteri. Niente virgolette (le mette IONOS), nessuno spazio o
   a capo dentro la chiave. Non usare "Auto configure": funziona solo con i
   provider DNS integrati, e IONOS non è tra questi.
   Poi *Verify DNS Records* su Resend — in genere pochi minuti.
3. Sul server, mittenti nuovi:
   ```bash
   cd /opt/trainmind/trainmind-app
   sed -i \
     -e 's|^REPORT_FROM_EMAIL=.*|REPORT_FROM_EMAIL=TrainMind <noreply@lab21sport.com>|' \
     -e 's|^AUTH_FROM_EMAIL=.*|AUTH_FROM_EMAIL=TrainMind <noreply@lab21sport.com>|' \
     .env.deploy
   dc up -d --force-recreate api
   dc logs --tail=20 api | grep -i '^Email\|Email:'
   ```
   La riga `Email: ...` all'avvio dichiara la modalità attiva. Se dice *log-only*
   la chiave non è valida e non parte nulla, pur senza errori visibili.

## Passo 7b — Casella `info@lab21sport.com`

Facoltativo e indipendente dal deploy: nessuna variabile, nessun rebuild, è solo
DNS. Ma va fatto **dopo** il Passo 7, perché l'ordine dei record conta.

### Perché non va in conflitto con Resend

Resend mette i suoi record su un **sottodominio dedicato**, non sulla radice:

| Record | Host | A chi serve |
|---|---|---|
| MX | `send.lab21sport.com` | Resend (gestione bounce) |
| TXT SPF | `send.lab21sport.com` | Resend |
| TXT DKIM | `resend._domainkey` | Resend |
| **MX** | **`@` (radice)** | **la casella `info@`** |
| TXT SPF | `@` (radice) | la casella `info@` |

L'MX della radice — quello che decide dove arriva la posta indirizzata a
`info@lab21sport.com` — Resend non lo tocca. Quindi `noreply@` che parte da
Resend e `info@` che arriva nella casella convivono sullo stesso dominio.

> ⚠️ Due record sono **unici per tutto il dominio** e sono l'unico punto in cui i
> due mondi si toccano:
> - **SPF della radice**: elenca solo il provider della casella.
>   **Non** aggiungerci `include:amazonses.com` — Resend usa il suo sottodominio.
> - **`_dmarc`**: ne esiste uno solo. Vedi sotto.

### Due strade

**A — Inoltro (alias).** `info@lab21sport.com` -> `pispi29@hotmail.it`. Su IONOS
è incluso o costa pochissimo, si attiva in due minuti, non richiede MX propri.
Ricevi tutto, ma per **rispondere da** `info@` serve comunque un SMTP: da Hotmail
la risposta partirebbe con l'indirizzo personale.

**B — Casella vera (IONOS).** Stesso pannello del dominio, gli MX li configura da
solo. Qualche euro al mese. Serve quando cominci a scrivere ai clienti e vuoi che
la risposta arrivi da `info@`.

Consiglio: parti con **A**, passa a **B** ai primi contratti. Nelle fatture di
luglio 2026 non c'è nessuna voce email, quindi oggi una casella non esiste.

Terza strada, Google Workspace o Zoho, solo se un domani servono più indirizzi
(`info@`, `commerciale@`, uno per persona) o calendario e drive condivisi.

### Ordine di inserimento

1. **Prima Resend** (Passo 7): DKIM + SPF + MX sul sottodominio `send`. Aspetta
   che il dominio risulti *Verified*.
2. **Poi la casella**: MX di radice e SPF di radice, dal pannello IONOS. Se scegli
   la casella IONOS li scrive lui; con un altro provider li copi a mano.
3. **`_dmarc` per ultimo**, quando entrambi funzionano. Si parte permissivi:
   ```
   Nome:   _dmarc
   Tipo:   TXT
   Valore: v=DMARC1; p=none; rua=mailto:info@lab21sport.com
   ```
   Si stringe a `p=quarantine` solo dopo aver visto nei report che **sia** Resend
   **sia** la casella passano. Mettere subito una policy severa è il modo classico
   per far finire nello spam le proprie email di reset password.

### Verifica

```powershell
nslookup -type=mx lab21sport.com              # provider della casella
nslookup -type=mx send.lab21sport.com         # feedback-smtp...amazonses.com
nslookup -type=txt lab21sport.com             # SPF della casella, senza amazonses
nslookup -type=txt _dmarc.lab21sport.com
```

Poi la prova vera: manda un'email **a** `info@lab21sport.com` da un indirizzo
esterno, e chiedi un reset password dall'app per controllare che il messaggio da
`noreply@` arrivi ancora e non finisca in spam.

### Stato al 7/09/2026 (verificato interrogando il DNS)

Casella **Mail Basic** `info@lab21sport.com` creata. IONOS ha scritto da sé tutto
il necessario, e **non ha toccato i record di Resend**:

| Record | Valore |
|---|---|
| MX `@` | `mx00.ionos.it`, `mx01.ionos.it` (priorità 10) |
| TXT `@` (SPF) | `v=spf1 include:_spf-eu.ionos.com ~all` |
| CNAME `s1-ionos._domainkey` | `s1.dkim.ionos.com` |
| CNAME `s2-ionos._domainkey` | `s2.dkim.ionos.com` |
| TXT `_dmarc` | `v=DMARC1; p=none;` |
| MX/TXT `send`, TXT `resend._domainkey` | intatti |

Quindi SPF, DKIM e DMARC ci sono già tutti: il `_dmarc` non va creato a mano come
dice il punto 3 qui sopra, semmai arricchito con un `rua=mailto:...` per ricevere
i report.

### Se la prima email in uscita finisce in spam

È successo, ed è **normale**: un dominio registrato da poche ore non ha nessuna
storia di invio, e Gmail nel dubbio sceglie la cartella spam. Prima di mettere
mano al DNS, accerta se è davvero un problema di configurazione:

1. In Gmail apri il messaggio → menù ⋮ → **Mostra originale**.
2. Leggi le tre righe in cima: devono dire `SPF: PASS`, `DKIM: PASS`,
   `DMARC: PASS`.

Se passano tutte e tre, **la configurazione è a posto e non c'è niente da
correggere**: è reputazione. Si risolve col tempo e con questi accorgimenti:

- Segna "Non è spam" e aggiungi `info@` ai contatti: addestra quell'account.
- Manda messaggi veri, non `test` con corpo vuoto — un'email di una riga senza
  oggetto né firma ha esattamente la forma di uno spam.
- Le risposte dentro una conversazione già avviata non vengono quasi mai
  classificate come spam: i primi scambi con qualcuno partono meglio se sei tu a
  rispondere.

Se invece una delle tre righe dice `FAIL`, allora sì che c'è un record da
sistemare — ed è quello nominato nella riga che fallisce.

Nota: tutto questo riguarda **solo** `info@`. Le email dell'app partono da
`noreply@` attraverso `send.lab21sport.com`, con DKIM proprio e l'infrastruttura
di Amazon SES dietro: hanno una reputazione separata e non risentono di questo.

### Regola da non rompere

`info@` è posta umana, `noreply@` è transazionale via Resend. Non far mai
partire le email dell'app dalla casella umana: se un filtro antispam se la prende
con le automatiche, non deve trascinarsi dietro la posta con cui parli ai
preparatori.

---

## Passo 8 — Verifica

```bash
# nuovo dominio
curl -sI https://lab21sport.com/        | head -1    # 200 → vetrina LAB21
curl -sI https://lab21sport.com/app     | head -1    # 200 → landing TrainMind
curl -s  https://api.lab21sport.com/api/v1/health
curl -sI https://atleti.lab21sport.com/ | head -1
curl -sI https://admin.lab21sport.com/  | head -1    # 401 → basic_auth attivo

# vecchio dominio: deve rimandare, non rompersi
curl -sI https://trainmind-app.com/               | head -3   # 301 → lab21sport.com/
curl -sI https://app.trainmind-app.com/dashboard  | head -3   # 301 → .../app/dashboard
curl -s  https://api.trainmind-app.com/api/v1/health          # deve rispondere ancora

# variabili viste dall'API
dc exec api printenv | grep -E 'APP_PUBLIC_URL|CORS_ORIGIN|ATHLETE_APP_URL'
```

Dal browser, in ordine:

1. `lab21sport.com` → "Scopri di più" → deve aprire `/app`.
2. `https://lab21sport.com/app?landing=%2F` → la landing del prodotto.
3. Login con un account di prova; poi una richiesta di **reset password** e
   controlla che il link nell'email contenga `lab21sport.com/app`.
4. Registrazione atleta dall'app atleti: il link "Termini di Servizio" deve
   portare a `lab21sport.com/app/terms`, non al vecchio dominio.
5. Console admin: rifai il segnalibro su `admin.lab21sport.com`.

## Passo 9 — Fuori dal repo

- **Stripe** (quando lo attiverai): endpoint webhook su `api.lab21sport.com`.
- **Google Search Console**: aggiungi `lab21sport.com` come nuova proprietà e usa
  *Cambio di indirizzo* dalla vecchia. I 301 trasferiscono il posizionamento, ma
  vanno tenuti su per mesi.
- Link nei profili social, nel materiale marketing, nelle firme email.
- Avvisa i preparatori: vecchi segnalibri funzionano, ma è meglio rifarli.
- **Atleti**: chi ha installato la PWA da `atleti.trainmind-app.com` continua a
  usarla (il proxy del Passo 3.1 la tiene viva), ma per passare al dominio nuovo
  deve **reinstallarla**: lo scope del service worker è legato all'origine.

---

## Se qualcosa va storto

Il vecchio dominio non è mai stato spento, quindi non si perde nulla.

```bash
cd /opt/trainmind/trainmind-app
cp .env.deploy.bak-$(date +%F) .env.deploy
dc build --no-cache web athlete && dc up -d --force-recreate web athlete api caddy
```

I blocchi letterali aggiunti al `Caddyfile` al Passo 3.1 restano innocui anche
dopo il rollback: puntano a `{$SITE_DOMAIN}`, che tornerebbe a essere
`trainmind-app.com`, creando un redirect su sé stesso. In quel caso commentali
finché non riprovi.

**Sintomi tipici e causa:**

| Sintomo | Causa quasi certa |
|---|---|
| Errore di certificato sul dominio nuovo | DNS non ancora propagato al momento del build (Passo 2) |
| Errore di certificato sul dominio vecchio | mancano i blocchi letterali del Passo 3.1 |
| La web app carica ma le chiamate API falliscono | `CORS_ORIGIN` non aggiornato: `dc up -d --force-recreate api` |
| Link di reset con dominio vecchio | `api` non ricreata dopo il Passo 5 |
| Il bundle mostra ancora il vecchio dominio | build senza `--no-cache` |

---

## Dopo il passaggio

- Rinnova **entrambi** i domini. `trainmind-app.com` scade e i redirect muoiono
  con lui.
- Fra qualche settimana: riporta `CORS_ORIGIN` al solo `https://${SITE_DOMAIN}`.
- I blocchi `api.trainmind-app.com` e `atleti.trainmind-app.com` come proxy
  possono diventare `redir` quando sarai ragionevolmente sicuro che nessuna PWA
  vecchia sia più in giro (mesi, non settimane).
- La nota finale della sezione 1c di `GUIDA_AGGIORNAMENTI.md` ("il Caddyfile non
  si tocca") vale solo per un cambio di nome in cui il vecchio dominio viene
  abbandonato. Qui il vecchio dominio resta vivo, quindi il Caddyfile si tocca.
