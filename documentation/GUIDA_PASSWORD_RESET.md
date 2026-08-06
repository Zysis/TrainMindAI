# Gestione password — guida test locale e deploy

Implementa tre flussi:

1. **Cambio password da loggato** — Impostazioni → card "Password"
2. **Password dimenticata** — `/forgot-password` (il link nel login ora funziona)
3. **Reset via token** — `/reset-password?token=...`

---

## 1. File modificati

### Backend (`trainmind-app/apps/api`)

| File | Modifica |
|---|---|
| `src/schemas/auth.ts` | Estratto `passwordField` riusabile + 3 nuovi schemi Zod |
| `src/routes/auth.ts` | 4 nuove rotte (3 POST + 1 GET di verifica) |
| `src/services/email-service.ts` | `buildPasswordResetEmailHtml()`, `describeEmailMode()`, `getAuthFrom()` |
| `src/lib/load-env.ts` | **Nuovo** — caricamento esplicito dei file `.env` (vedi §3.2) |
| `src/server.ts` | Importa `load-env` per primo; logga la modalità email all'avvio |
| `.env.example` | `APP_PUBLIC_URL`, `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, `AUTH_FROM_EMAIL` |

### Database (`trainmind-app/packages/db`)

| File | Modifica |
|---|---|
| `prisma/schema.prisma` | `User`: `resetTokenHash`, `resetTokenExpiry`, `passwordChangedAt` |
| `prisma/migrations/20260729100000_add_password_reset/migration.sql` | Migration idempotente |

### Frontend (identico in `trainmind-app/apps/web` e `trainmind-mobile/web`)

| File | Modifica |
|---|---|
| `src/lib/auth/api.ts` | `changePassword`, `requestPasswordReset`, `verifyResetToken`, `resetPassword` |
| `src/app/(auth)/forgot-password/page.tsx` | Nuova pagina |
| `src/app/(auth)/reset-password/page.tsx` | Nuova pagina |
| `src/components/settings/change-password-card.tsx` | Nuovo componente |
| `src/app/dashboard/settings/page.tsx` | Inserita la card |
| `src/messages/{it,en,es}.json` | Blocco `settings.password` |

> `trainmind-mobile` non ha un backend proprio: inoltra a `trainmind-app/apps/api` tramite
> `src/app/api/v1/[...path]/route.ts`. Le nuove rotte funzionano senza toccare il proxy.

---

## 2. Endpoint

| Metodo | Rotta | Auth | Rate limit |
|---|---|---|---|
| POST | `/api/v1/auth/change-password` | JWT | globale (100/min) |
| POST | `/api/v1/auth/forgot-password` | no | **5 / 15 min** |
| POST | `/api/v1/auth/reset-password` | no | **10 / 15 min** |
| GET | `/api/v1/auth/reset-password/:token` | no | globale |

### Scelte di sicurezza

- **Token mai in chiaro nel DB.** Salviamo solo `SHA-256(token)`. Il token vero esiste solo nel link email.
- **Risposta uniforme su `forgot-password`.** Identica che l'email esista o no: altrimenti l'endpoint diventa un modo per scoprire quali indirizzi sono registrati.
- **Token monouso, TTL 60 minuti** (`RESET_TOKEN_TTL_MINUTES` in `routes/auth.ts`).
- **Cambio password invalida il `refreshToken`**, disconnettendo le altre sessioni.
- **`change-password` richiede la password attuale**: senza, chi ruba una sessione potrebbe bloccare fuori il proprietario.

---

## 3. Test in locale

### 3.1 Applicare lo schema e rigenerare il client

> **Non usare `prisma migrate dev` in locale su questo progetto.**
> Lo storico mostra che parte dello schema è stata applicata con `db push`
> (vedi il commento in `20260721120000_consent_record_audit_fields/migration.sql`),
> quindi il DB è *drifted* rispetto alle migration. `migrate dev` rileva la
> divergenza e propone un **reset del database**: perderesti i dati di sviluppo.

`db push` è additivo e sicuro qui: le tre colonne sono nullable e l'indice è nuovo,
nessuna operazione distruttiva.

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app

# Postgres deve essere in esecuzione (docker compose up -d postgres se lo usi)
pnpm --filter @trainmind/db exec prisma db push
pnpm --filter @trainmind/db exec prisma generate
```

**Entrambi i comandi sono necessari.** Saltare `generate` lascia il client Prisma
senza i nuovi campi: l'API risponde `500 An internal server error occurred`
su cambio password e reset, perché `passwordChangedAt` risulta un argomento sconosciuto.

Verifica che il client sia aggiornato prima di riavviare:

```powershell
findstr /C:"resetTokenHash" node_modules\.pnpm\@prisma+client*\node_modules\.prisma\client\index.d.ts
```

Se non stampa nulla, `generate` non è andato a buon fine. Riavvia poi l'API
(`pnpm dev`): il client Prisma viene caricato all'avvio, non a caldo.

Controllo delle colonne nel DB:

```powershell
pnpm --filter @trainmind/db exec prisma studio
```

La migration in `prisma/migrations/20260729100000_add_password_reset/` resta comunque
utile per il deploy sul server (vedi §5.2).

### 3.2 Configurare l'ambiente API — non serve nulla

In locale i default fanno già la cosa giusta:

| Variabile | Se assente | Effetto |
|---|---|---|
| `RESEND_API_KEY` | `isLogOnlyMode()` → `true` | Modalità **log-only**: nessuna email parte, il link finisce nei log |
| `APP_PUBLIC_URL` | fallback `http://localhost:3000` | Il link punta correttamente alla web app locale |

`LOG_LEVEL=info` è già impostato nel `.env` alla radice di `trainmind-app`, quindi la riga
`[RESET PASSWORD] Link generato` viene stampata.

#### Come l'API carica le variabili d'ambiente

Originariamente **l'API non caricava alcun file `.env`**. Funzionava lo stesso solo perché
Prisma carica per conto proprio il `.env` accanto al suo schema (`packages/db/.env`),
quindi `DATABASE_URL` arrivava. Tutte le altre variabili del `.env` alla radice
(`RESEND_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, `VAPID_*`) venivano **ignorate in
silenzio** e il codice ripiegava sui default.

È stato aggiunto `apps/api/src/lib/load-env.ts`, importato per primo in `server.ts`.
Ordine di precedenza, dal più forte al più debole:

1. Variabili già presenti in `process.env` (shell, Docker, CI)
2. `apps/api/.env`
3. `<root>/.env` — il file dove stanno oggi le tue variabili

`dotenv` non sovrascrive variabili già definite, quindi in produzione l'ambiente iniettato
dal container continua a prevalere.

**Conseguenza al primo riavvio dopo questa modifica**: l'API ora usa il `JWT_SECRET` vero
al posto del default, quindi i token già emessi diventano invalidi e occorre rifare il
login. Inoltre `NODE_ENV=development` viene finalmente applicato, il che attiva
`pino-pretty` e il logging delle query Prisma (log molto più verbosi).

#### Verifica immediata della configurazione email

All'avvio l'API stampa una riga che dichiara senza ambiguità la modalità:

```
Email: INVIO REALE via Resend (chiave re_Tt4..., mittente auth "...", mittente report "...")
```
oppure
```
Email: log-only (RESEND_API_KEY non definita — nessuna email verra inviata)
```

Serve a evitare il caso peggiore: credere di spedire davvero mentre si è in log-only,
senza alcun segnale visibile.

### 3.3 Avviare

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm dev
```

API su `:3001`, web su `:3000`. Per la PWA, in un secondo terminale:

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-mobile
pnpm dev
```

### 3.4 Test A — cambio password da loggato (UI)

1. Login su `http://localhost:3000`
2. Impostazioni → card **Password** → "Cambia password"
3. Inserisci password attuale + nuova (min 8 caratteri, 1 maiuscola, 1 numero)
4. Atteso: messaggio di conferma, redirect al login dopo ~2,5 s
5. Rientra con la **nuova** password

Controprova: ripeti sbagliando la password attuale. Atteso: *"La password attuale non e corretta"*.

### 3.5 Test B — password dimenticata (UI)

1. Login → "Password dimenticata?"
2. Inserisci la tua email → invia
3. **Nel terminale dell'API** cerca la riga:

   ```
   [RESET PASSWORD] Link generato  ... resetUrl: "http://localhost:3000/reset-password?token=..."
   ```

4. Apri quell'URL nel browser
5. Imposta la nuova password → login

Controprova: riapri lo **stesso** link. Atteso: *"Link non valido o scaduto"* (token monouso).

### 3.5-bis Attivare l'invio email reale in locale (Resend)

Procedura completa, comando per comando. Usa **PowerShell**, non il Prompt dei comandi.

Riferimenti ambiente: container Postgres `trainmind-postgres`, utente `trainmind`,
database `trainmind_db`.

---

#### STEP 1 — Vedi quali account esistono nel database

```powershell
docker exec -it trainmind-postgres psql -U trainmind -d trainmind_db -c "SELECT email, role, \"isActive\" FROM users ORDER BY \"createdAt\";"
```

Annota l'email dell'account con cui vuoi provare il reset. Ti servirà al passo 5.

---

#### STEP 2 — Procurati la API key di Resend

Nel setup attuale esiste già la chiave **`trainmind-prod`** (Full access), ed è quella
configurata nel `.env`. Se ti basta, salta al passo 3.

Per crearne una nuova: <https://resend.com/api-keys> → **Create API Key** → *Permission*
**Sending access** (sufficiente a spedire, e non permette di gestire domini o altre
chiavi: se il `.env` dovesse trapelare, il danno è minore) → **Add**. La chiave è mostrata
**una sola volta**.

> Il livello di permesso non incide sul limite della sandbox: anche una chiave Full access
> può spedire solo al proprio indirizzo finché non si verifica un dominio.

---

#### STEP 3 — Verifica la chiave e scopri a quale indirizzo puoi spedire

Questo test è il modo più rapido per sapere se l'indirizzo è ammesso: se non lo è,
Resend risponde 403 e **il messaggio d'errore nomina l'indirizzo consentito**.

```powershell
$key = "re_INCOLLA_QUI_LA_CHIAVE"
$dest = "alessandro.vispa@gmail.com"

$body = @{
  from    = "TrainMind AI <onboarding@resend.dev>"
  to      = @($dest)
  subject = "Test TrainMind"
  html    = "<p>Se leggi questo, l'invio funziona.</p>"
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri "https://api.resend.com/emails" -Method Post `
    -Headers @{ Authorization = "Bearer $key" } `
    -ContentType "application/json" -Body $body
  Write-Host "`nOK: email accettata da Resend. Controlla la posta (anche spam)." -ForegroundColor Green
} catch {
  Write-Host "`nERRORE Resend:" -ForegroundColor Red
  $_.ErrorDetails.Message
}
```

| Risultato | Significato | Cosa fare |
|---|---|---|
| Stampa un `id` + messaggio verde | L'indirizzo è ammesso | Prosegui allo STEP 4 |
| `403` con *"You can only send testing emails to your own email address"* | L'indirizzo non è quello del tuo account Resend | Usa l'indirizzo indicato nell'errore, o verifica un dominio |
| `401` | Chiave errata o incollata male | Rigenera la chiave |

---

#### STEP 4 — Aggiungi la chiave al `.env`

```powershell
$envFile = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\.env"
Add-Content -Path $envFile -Value "`nRESEND_API_KEY=$key"

# verifica che sia stata scritta
Select-String -Path $envFile -Pattern "RESEND_API_KEY"
```

> Non serve `REPORT_FROM_EMAIL`: il default in `getDefaultFrom()` è già
> `TrainMind AI <onboarding@resend.dev>`, l'unico mittente ammesso senza dominio verificato.

---

#### STEP 5 — Allinea l'email dell'account app (solo se necessario)

Salta questo passo se al passo 3 l'invio è andato a buon fine verso l'indirizzo che
volevi usare. Altrimenti, punta un account esistente all'indirizzo ammesso:

```powershell
$vecchia = "alessandro.vispa@gmail.com"
$nuova   = "EMAIL_DEL_TUO_ACCOUNT_RESEND"

docker exec -it trainmind-postgres psql -U trainmind -d trainmind_db -c "UPDATE users SET email='$nuova' WHERE email='$vecchia';"
```

> Cambia le credenziali di accesso: da quel momento farai login con la nuova email.

---

#### STEP 6 — Riavvia l'API

Il `.env` viene letto all'avvio del processo: senza riavvio la chiave non viene vista.

```powershell
# Ctrl+C nel terminale con pnpm dev, poi:
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm dev
```

---

#### STEP 7 — Lancia la richiesta di reset

```powershell
$email = "EMAIL_DELL_ACCOUNT"
$body  = @{ email = $email } | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/forgot-password" `
  -Method Post -ContentType "application/json" -Body $body
```

Risposta attesa (sempre questa, anche per email inesistenti):

```
success data
------- ----
   True @{message=Se esiste un account associato a questa email...}
```

In alternativa dall'interfaccia: `http://localhost:3000/login` → "Password dimenticata?".

---

#### STEP 8 — Leggi i log dell'API

Nel terminale di `pnpm dev` cerca una di queste righe:

| Log | Significato |
|---|---|
| `Email sent via Resend` con `id` | Inviata: controlla la posta, spam incluso |
| `Resend API error` con `status: 403` | Destinatario non ammesso (torna allo STEP 3) |
| `[EMAIL LOG-ONLY] Would send...` | La chiave non è stata letta: `.env` sbagliato o API non riavviata |
| Nessuna riga `[RESET PASSWORD]` | L'email non esiste nel DB, oppure account `isActive = false` |

Il link è comunque sempre nei log, anche a invio riuscito:

```
[RESET PASSWORD] Link generato ... resetUrl: "http://localhost:3000/reset-password?token=..."
```

---

#### STEP 9 — Completa il reset

Apri il link (dall'email o dai log), imposta la nuova password, poi verifica il login:

```powershell
$body = @{ email = $email; password = "NuovaPass1" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/login" `
  -Method Post -ContentType "application/json" -Body $body
```

Se restituisce `user` e `tokens`, il flusso è completo.

---

#### Tornare alla modalità log-only

```powershell
$envFile = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\.env"
(Get-Content $envFile) -replace '^RESEND_API_KEY=.*', 'RESEND_API_KEY=re_xxx_placeholder' | Set-Content $envFile
```

Poi riavvia l'API.

---

### 3.5-ter Mittente personalizzato: noreply@trainmind-app.com

**Obiettivo**: spedire da `noreply@trainmind-app.com` invece che da `onboarding@resend.dev`,
e poter scrivere a **qualsiasi** destinatario.

**Situazione di partenza**

| Voce | Stato |
|---|---|
| Dominio `trainmind-app.com` su Resend | ✅ già **Verified** |
| Chiave API `trainmind-prod` (Full access) | ✅ già nel `.env` |
| Casella `noreply@trainmind-app.com` su IONOS | ✅ già esistente |
| Record DNS | ✅ già a posto (il dominio è verificato) |
| Costo aggiuntivo | **Nessuno** — il piano gratuito Resend include 1 dominio, già in uso |

**Resta una sola cosa da fare: impostare `AUTH_FROM_EMAIL`.**

---

#### Due precisazioni che evitano errori

**Possedere la casella non basta.** Resend non spedisce da `noreply@trainmind-app.com`
perché quella mailbox esiste su IONOS: spedisce perché il **dominio** è verificato sul
tuo account Resend. Sono due cose indipendenti. La casella IONOS serve semmai a ricevere
le eventuali risposte; l'invio passa interamente da Resend.

**Non serve un secondo dominio.** Verificare un sottodominio dedicato (es.
`mail.trainmind-app.com`) avrebbe consumato l'unico slot gratuito, oppure richiesto il
piano Pro a 20 $/mese. Poiché `trainmind-app.com` è già verificato, ogni indirizzo su
quel dominio è utilizzabile subito e senza costi.

> **Nota sulla reputazione.** Usando il dominio radice, le email transazionali
> condividono la reputazione di invio con la posta ordinaria di `trainmind-app.com`.
> Per i volumi di un flusso di reset password è un rischio trascurabile. Se in futuro
> aggiungerai invii massivi (newsletter, report a molti destinatari), varrà la pena
> isolarli su un sottodominio — a quel punto il piano Pro sarà comunque giustificato.

---

#### STEP 1 — Configura il mittente (web-app, locale)

```powershell
$envFile = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\.env"
Add-Content -Path $envFile -Value "`nAUTH_FROM_EMAIL=TrainMind AI <noreply@trainmind-app.com>"

# verifica che sia stata scritta
Select-String -Path $envFile -Pattern "AUTH_FROM_EMAIL"
```

Se l'avevi già impostata con un valore diverso, sostituiscila invece di aggiungerla:

```powershell
(Get-Content $envFile) -replace '^AUTH_FROM_EMAIL=.*', 'AUTH_FROM_EMAIL=TrainMind AI <noreply@trainmind-app.com>' | Set-Content $envFile
Select-String -Path $envFile -Pattern "AUTH_FROM_EMAIL"
```

---

#### STEP 2 — Riavvia l'API e controlla la riga di avvio

Il `.env` viene letto all'avvio del processo: senza riavvio la variabile non viene vista.

```powershell
# Ctrl+C nel terminale con pnpm dev, poi:
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm dev
```

Attesa:

```
Email: INVIO REALE via Resend (chiave re_Tt4..., mittente auth "TrainMind AI <noreply@trainmind-app.com>", mittente report "...")
```

Se il mittente auth mostra ancora `onboarding@resend.dev`, la variabile non è stata letta:
ricontrolla il file e il riavvio.

---

#### STEP 3 — Il test decisivo

Richiedi il reset per un indirizzo **diverso** da quello del tuo account Resend
(`pispi29@hotmail.it`). È questo che dimostra il superamento della sandbox:

```powershell
$body = @{ email = "alessandro.vispa@gmail.com" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/forgot-password" `
  -Method Post -ContentType "application/json" -Body $body
```

Nei log dell'API deve comparire `Email sent via Resend` con un `id`.

| Log | Causa | Rimedio |
|---|---|---|
| `Email sent via Resend` | Tutto a posto | Controlla la casella, spam incluso |
| `403 ... only send testing emails` | `AUTH_FROM_EMAIL` non letta: si sta ancora usando `onboarding@resend.dev` | Verifica il `.env` e riavvia l'API |
| `403 ... verify a domain` | Il dominio in `AUTH_FROM_EMAIL` non coincide con quello verificato | Il mittente deve essere `@trainmind-app.com`, senza sottodomini |
| Nessuna riga `[RESET PASSWORD]` | L'email non esiste nel DB, oppure l'account ha `isActive = false` | Controlla con la query dello STEP 1 di §3.5-bis |

Completa il flusso aprendo il link ricevuto e reimpostando la password.

---

#### STEP 4 — Produzione

Sul server la stessa variabile va nell'ambiente del container, insieme alle altre:

```env
APP_PUBLIC_URL=https://app.trainmind-app.com
RESEND_API_KEY=re_Tt4...
AUTH_FROM_EMAIL=TrainMind AI <noreply@trainmind-app.com>
```

`APP_PUBLIC_URL` è critica: è la base del link contenuto nell'email. Se resta
`localhost`, gli utenti riceveranno link inutilizzabili.

---

#### Riepilogo operazioni per sistema

| Dove | Cosa fare |
|---|---|
| **Resend** | Nulla. Il dominio è già verificato e la chiave `trainmind-prod` è già in uso. |
| **IONOS** | Nulla. I record DNS sono già a posto, altrimenti il dominio non risulterebbe verificato. |
| **Web-app (locale)** | Aggiungere `AUTH_FROM_EMAIL` al `.env` alla radice di `trainmind-app`. Riavviare l'API. Controllare la riga `Email:`. |
| **Web-app (produzione)** | Stessa variabile nell'ambiente del container, insieme ad `APP_PUBLIC_URL` con l'URL HTTPS pubblico. |
| **Codice** | Nulla. `getAuthFrom()` in `email-service.ts` legge già `AUTH_FROM_EMAIL`, con fallback su `REPORT_FROM_EMAIL`. |

---

#### Appendice — se un giorno il dominio andasse ri-verificato

Non serve ora, ma è utile averlo scritto: se i record DNS venissero persi (migrazione
DNS, cambio nameserver) il dominio tornerebbe "not verified" e ogni invio fallirebbe
con 403.

Su IONOS: **Domini & SSL** → `trainmind-app.com` → scheda **DNS**. I record di Resend sono:

| Tipo | Nome (host) su IONOS | Scopo |
|---|---|---|
| MX | `send` | ricezione di bounce e reclami |
| TXT | `send` | SPF (`v=spf1 include:amazonses.com ~all`) |
| TXT | `resend._domainkey` | DKIM (chiave pubblica) |
| TXT | `_dmarc` | DMARC (opzionale ma consigliato) |

> ⚠️ **La particolarità di IONOS.** Al nome del record il pannello **aggiunge
> automaticamente il dominio**. Dove Resend mostra `send.trainmind-app.com` va scritto
> solo `send`. Incollando il valore completo si ottiene
> `send.trainmind-app.com.trainmind-app.com`: il pannello lo accetta senza segnalare
> nulla e la verifica non passa mai.

Controllo dello stato da PowerShell, senza dipendere dal pannello Resend:

```powershell
Write-Host "`n--- DKIM ---" -ForegroundColor Cyan
Resolve-DnsName -Type TXT "resend._domainkey.trainmind-app.com" -ErrorAction SilentlyContinue |
  Select-Object Name, Strings

Write-Host "`n--- SPF ---" -ForegroundColor Cyan
Resolve-DnsName -Type TXT "send.trainmind-app.com" -ErrorAction SilentlyContinue |
  Select-Object Name, Strings

Write-Host "`n--- MX (bounce) ---" -ForegroundColor Cyan
Resolve-DnsName -Type MX "send.trainmind-app.com" -ErrorAction SilentlyContinue |
  Select-Object Name, NameExchange, Preference
```

Se un blocco è vuoto, quel record manca. Se il nome restituito contiene
`trainmind-app.com.trainmind-app.com`, è l'errore del prefisso descritto sopra.

---

### 3.6 Test C — via curl (PowerShell)

```powershell
$api = "http://localhost:3001/api/v1"

# 1) Richiesta reset — risposta identica anche per email inesistenti
curl.exe -s -X POST "$api/auth/forgot-password" `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"tua@email.com\"}'

# 2) Copia il token dai log dell'API, poi:
$token = "INCOLLA_QUI_IL_TOKEN"

# Verifica validita (mostra l'email mascherata)
curl.exe -s "$api/auth/reset-password/$token"

# 3) Imposta la nuova password
curl.exe -s -X POST "$api/auth/reset-password" `
  -H "Content-Type: application/json" `
  -d "{\"token\":\"$token\",\"password\":\"NuovaPass1\"}"

# 4) Login con la nuova password
curl.exe -s -X POST "$api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"tua@email.com\",\"password\":\"NuovaPass1\"}'
```

Cambio password autenticato:

```powershell
# Estrai l'accessToken dalla risposta di login, poi:
$tk = "INCOLLA_ACCESS_TOKEN"

curl.exe -s -X POST "$api/auth/change-password" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $tk" `
  -d '{\"currentPassword\":\"NuovaPass1\",\"newPassword\":\"AltraPass2\"}'
```

### 3.7 Casi limite da verificare

| Caso | Atteso |
|---|---|
| Password senza maiuscola | 400, messaggio sulla regola violata |
| Nuova password uguale all'attuale | 400, *"deve essere diversa da quella attuale"* |
| Token inventato | 410, *"Link non valido o scaduto"* |
| Token riusato | 410 |
| 6ª richiesta di reset in 15 min | 429 (rate limit) |
| Email inesistente | 200 con messaggio generico, nessuna email inviata |

> Il rate limit ha `allowList: ['127.0.0.1', '::1']` in `app.ts`: **da localhost non scatta**.
> Per testarlo davvero serve l'ambiente su server.

---

## 4. Verifica pre-deploy

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm type-check
pnpm build

cd ..\trainmind-mobile
pnpm type-check
pnpm build
```

---

## 5. Deploy su VPS (aggiornamento di un'istanza già attiva)

Scenario: l'app gira già sul VPS, il codice viene trasferito via **scp** da Windows.

**Cosa NON va sul server.** Il compose builda `trainmind-app/apps/web` e
`trainmind-athlete`. `trainmind-mobile` **non è deployato**: le modifiche fatte lì
restano solo in locale e non vanno trasferite.

**Le migration arrivano.** `packages/db/prisma/migrations/` è in `.gitignore`, ma `scp`
non lo rispetta: la cartella viene copiata e `prisma migrate deploy` la trova. Se un
domani passassi a `git pull`, questo smetterebbe di funzionare — vedi §5.6.

---

### 5.1 Modifiche all'infrastruttura già applicate

Due variabili mancavano nel compose e sono state aggiunte al servizio `api`:

| Variabile | Se manca | Conseguenza |
|---|---|---|
| `APP_PUBLIC_URL` | fallback `http://localhost:3000` | I link nelle email puntano a localhost: **inutilizzabili** |
| `AUTH_FROM_EMAIL` | fallback su `REPORT_FROM_EMAIL`, poi `onboarding@resend.dev` | Invio possibile solo verso l'indirizzo dell'account Resend, 403 per tutti gli altri |

`APP_PUBLIC_URL` è cablata su `https://${APP_DOMAIN}`, quindi non serve aggiungerla al
`.env.deploy`. `AUTH_FROM_EMAIL` va invece impostata.

---

### 5.2 Verifica pre-deploy in locale

Non deployare senza aver fatto passare questi due comandi.

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm type-check
pnpm build
```

Se `build` fallisce sul server te ne accorgi dopo 15 minuti di compilazione, con l'app
già ferma.

#### Cosa deve passare davvero

**`pnpm type-check` deve passare del tutto.** Nessuna eccezione.

**`pnpm build` su Windows si ferma all'ultimo passo, ed è normale.** Il pacchetto
`@trainmind/web` fallisce con:

```
✓ Compiled successfully
   Checking validity of types ...
✓ Generating static pages (28/28)
   Collecting build traces ...
⚠ Failed to copy traced files ... EPERM: operation not permitted, symlink
```

Causa: `next.config.mjs` usa `output: 'standalone'`, che a fine build crea **symlink**
per replicare `node_modules`. Windows non permette di creare symlink senza privilegi
elevati, e la struttura a symlink di pnpm moltiplica il problema.

**Non è un errore del codice e non blocca il deploy**: il `Dockerfile` del web builda su
Linux, dove i symlink funzionano, e lo stage runner copia `.next/standalone` senza
problemi.

Le tre righe che contano sono quelle sopra l'errore:

| Riga | Cosa garantisce |
|---|---|
| `✓ Compiled successfully` | Il codice compila |
| `Checking validity of types ...` senza errori | I tipi sono corretti |
| `✓ Generating static pages (28/28)` | Tutte le pagine, incluse le due nuove, si generano |

Se vuoi una build locale completamente verde, attiva la **Modalità sviluppatore** di
Windows: *Impostazioni → Privacy e sicurezza → Per gli sviluppatori → Modalità
sviluppatore*. Consente la creazione di symlink senza privilegi di amministratore. In
alternativa, esegui PowerShell come amministratore.

> **Correzione preesistente inclusa.** Il primo `type-check` dopo `prisma generate` ha
> fatto emergere un errore in `packages/db/prisma/seed.ts`: la `create` di
> `trainingSession` non passava `organizationId`, che nello schema è obbligatorio.
> Non c'entra con il reset password — era latente perché il client Prisma generato era
> fermo a una versione precedente dello schema, quindi `tsc` confrontava i tipi vecchi.
> Rigenerando il client, l'incoerenza è venuta a galla. Corretto aggiungendo
> `organizationId: org.id`, coerentemente con `seed-demo.ts` che lo passava già.

> **Seconda correzione preesistente.** `pnpm build` falliva su `@trainmind/api` con
> `TS5074: Option '--incremental' can only be specified using tsconfig...`. Causa: lo
> script era `tsup src/server.ts --format esm --dts`, e la generazione dei `.d.ts`
> confligge con `"incremental": true` ereditato dal `tsconfig.json` alla radice.
>
> Il `--dts` è stato rimosso. Due motivi: l'API è un'**applicazione**, non una libreria
> (nessuno importa `@trainmind/api`, e il package non dichiara `main`/`types`), quindi
> le dichiarazioni di tipo non servono a nessuno; e soprattutto il `Dockerfile` alla
> riga 32 esegue già `tsup src/server.ts --format esm` **senza** `--dts`.
>
> Questo significa anche che **la build sul server non era compromessa**: falliva solo
> quella locale. Ora i due comandi sono identici, quindi la verifica pre-deploy testa
> davvero ciò che verrà costruito in produzione — che era il punto di farla.

---

### 5.3 Backup del database (sul server)

Primo comando in assoluto. La migration è additiva e reversibile, ma un backup prima di
toccare lo schema è la differenza tra un imprevisto e un disastro.

```bash
ssh root@IP_DEL_VPS

cd /opt/trainmind/trainmind-app
alias dc='docker compose -f docker-compose.deploy.yml --env-file .env.deploy'

docker exec -t trainmind-postgres pg_dump -U trainmind trainmind_db \
  > ~/backup_pre_password_$(date +%Y%m%d_%H%M).sql

ls -lh ~/backup_pre_password_*.sql   # deve pesare più di zero
```

---

### 5.4 Trasferimento dei file modificati

Un archivio unico invece di tanti `scp`: evita i problemi di quoting delle parentesi in
`(auth)` e crea da solo le cartelle nuove.

**Dal PC Windows** (`tar` è incluso in Windows 10 e 11):

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app

tar -czf ..\password-reset.tgz `
  docker-compose.deploy.yml `
  .env.deploy.example `
  apps/api/src/server.ts `
  apps/api/src/lib/load-env.ts `
  apps/api/src/routes/auth.ts `
  apps/api/src/schemas/auth.ts `
  apps/api/src/services/email-service.ts `
  apps/api/.env.example `
  apps/api/package.json `
  packages/db/prisma/schema.prisma `
  packages/db/prisma/seed.ts `
  packages/db/prisma/migrations/20260729100000_add_password_reset `
  apps/web/src/lib/auth/api.ts `
  "apps/web/src/app/(auth)/forgot-password" `
  "apps/web/src/app/(auth)/reset-password" `
  apps/web/src/components/settings `
  apps/web/src/app/dashboard/settings/page.tsx `
  apps/web/src/messages/it.json `
  apps/web/src/messages/en.json `
  apps/web/src/messages/es.json

# controlla il contenuto prima di spedire
tar -tzf ..\password-reset.tgz

scp ..\password-reset.tgz root@IP_DEL_VPS:/opt/trainmind/
```

**Sul server**, estrai e verifica:

```bash
cd /opt/trainmind/trainmind-app
tar -xzf ../password-reset.tgz

# i file nuovi devono esserci
ls -la apps/api/src/lib/load-env.ts
ls -la packages/db/prisma/migrations/20260729100000_add_password_reset/
ls -la "apps/web/src/app/(auth)/forgot-password/"
ls -la apps/web/src/components/settings/

# e il compose deve contenere le due variabili nuove
grep -E "APP_PUBLIC_URL|AUTH_FROM_EMAIL" docker-compose.deploy.yml
```

---

### 5.5 Configura il mittente

```bash
cd /opt/trainmind/trainmind-app

# controlla cosa c'è già
grep -E "RESEND_API_KEY|AUTH_FROM_EMAIL|REPORT_FROM_EMAIL" .env.deploy

# aggiungi il mittente delle email di autenticazione
echo 'AUTH_FROM_EMAIL=TrainMind AI <noreply@trainmind-app.com>' >> .env.deploy

# verifica che RESEND_API_KEY sia una chiave vera e non il placeholder re_...
grep RESEND_API_KEY .env.deploy
```

Se `RESEND_API_KEY` è ancora `re_...`, il sistema resterà in log-only e nessuna email
partirà. Inseriscila ora.

---

### 5.6 Migrazione, build e riavvio

```bash
cd /opt/trainmind/trainmind-app
alias dc='docker compose -f docker-compose.deploy.yml --env-file .env.deploy'

# 1) ricostruisci le immagini, MIGRATE INCLUSO
dc --profile tools build api web migrate

# 2) applica la migration (idempotente: sicura anche se le colonne esistessero già)
dc run --rm migrate

# 3) riavvia i servizi
dc up -d api web

# 4) attendi lo stato healthy
dc ps
```

**L'ordine di questi tre comandi è critico, per due motivi distinti.**

**`build` prima di `migrate`.** Il servizio `migrate` non legge le migration dal disco
del server: il suo Dockerfile fa `COPY . .` al momento della build, quindi usa il codice
**congelato nell'immagine**. Copiare i file via `scp` non basta — senza rebuild,
`prisma migrate deploy` gira sul codice vecchio e riporta `No pending migrations to
apply` pur essendoci migration nuove sul disco.

> **Come accorgersene.** L'output di `migrate` stampa `N migrations found in
> prisma/migrations`. Confronta `N` con il numero di cartelle in locale:
> ```powershell
> (Get-ChildItem C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\packages\db\prisma\migrations -Directory).Count
> ```
> Se i due numeri non coincidono, l'immagine è vecchia: rifai il `build`.

**`migrate` prima di `up`.** Al contrario, il nuovo codice interrogherebbe colonne non
ancora esistenti e l'API risponderebbe 500 su ogni richiesta che tocca `User`.

> `--profile tools` serve perché il servizio `migrate` è dichiarato sotto quel profilo in
> `docker-compose.deploy.yml`: senza, `build` lo ignorerebbe silenziosamente.

---

### 5.7 Verifica post-deploy

**a) La riga di avvio dichiara la configurazione email:**

```bash
dc logs api | grep -i "^.*Email:" | tail -1
```

Attesa:

```
Email: INVIO REALE via Resend (chiave re_Tt4..., mittente auth "TrainMind AI <noreply@trainmind-app.com>", mittente report "...")
```

Se leggi `log-only`, `AUTH_FROM_EMAIL` o `RESEND_API_KEY` non sono arrivate al container:
ricontrolla `.env.deploy` e rifai `dc up -d api`.

**b) Le colonne esistono nel database:**

```bash
docker exec -t trainmind-postgres psql -U trainmind -d trainmind_db \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('resetTokenHash','resetTokenExpiry','passwordChangedAt');"
```

Devono comparire tutte e tre.

**c) L'API risponde:**

```bash
curl -s https://api.trainmind-app.com/api/v1/health
```

**d) Il flusso completo, da browser:**

1. `https://app.trainmind-app.com/login` → "Password dimenticata?"
2. Inserisci un indirizzo reale registrato
3. L'email deve arrivare **con un link che punta al dominio pubblico**, non a localhost
4. Completa il reset e rientra con la nuova password

**e) Il token non finisce più nei log** (in produzione `NODE_ENV=production`):

```bash
dc logs api | grep "RESET PASSWORD" | tail -2
```

Deve mostrare `Link generato e inviato` con il solo `userId`, **senza** `resetUrl`.

---

### 5.8 Rollback

La migration aggiunge solo colonne nullable: il codice precedente continua a funzionare
senza toccarle. Per tornare indietro basta ripristinare i file precedenti e rifare
`dc build api web && dc up -d api web`.

Ripristino completo del database, se necessario:

```bash
docker exec -i trainmind-postgres psql -U trainmind -d trainmind_db < ~/backup_pre_password_AAAAMMGG_HHMM.sql
```

Rimozione delle colonne (raramente necessaria):

```sql
ALTER TABLE "users" DROP COLUMN IF EXISTS "resetTokenHash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "resetTokenExpiry";
ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordChangedAt";
```

---

### 5.9 Debito tecnico: le migration non sono su git

`trainmind-app/.gitignore` riga 35 contiene:

```
packages/db/prisma/migrations/
```

Con `scp` non è un problema, perché la cartella viene copiata comunque. **Lo diventa nel
momento in cui passi a `git pull` sul server**: le migration non arriverebbero,
`dc run --rm migrate` non applicherebbe nulla, le colonne non verrebbero create e l'API
andrebbe in errore su ogni query a `User`.

Correzione consigliata, da fare quando hai tempo:

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
# rimuovi la riga 35 da .gitignore, poi:
git add -f packages/db/prisma/migrations/
git status   # devono comparire TUTTE le migration, non solo l'ultima
```

Lo storico dello schema è parte del codice: tenerlo fuori dal repository significa che
un ambiente ricostruito da zero non è riproducibile.

---

## 6. Correzione collegata: accesso degli atleti alla dashboard staff

> Non riguarda il reset password, ma è stata rilevata durante i test di questo deploy
> ed è andata in produzione nella stessa finestra. Documentata qui per tracciabilità.

### 6.1 Il problema

Un account con ruolo `ATHLETE` che faceva login su `app.trainmind-app.com` entrava nella
dashboard dei preparatori. Il sintomo era visibile nell'interfaccia, ma la causa era più
profonda:

- `AuthGuard` verificava solo `isAuthenticated`, senza guardare il ruolo
- `middleware.ts` è un segnaposto che non esegue controlli
- **nell'API il controllo di ruolo era applicato alle scritture ma non alle letture**

Con un token ATHLETE valido erano leggibili circa 55 rotte, fra cui:

| Rotta | Dati esposti |
|---|---|
| `GET /athletes`, `/athletes/:id` | Anagrafica completa della rosa |
| `GET /athletes/:athleteId/injuries` | Infortuni di qualsiasi atleta |
| `GET /wellness`, `GET /metrics` | Wellness e misurazioni di tutti |
| `GET /analytics/*` | Heatmap wellness, panoramica squadra, ACWR |
| `GET /rtp`, `/rtp/:id` | Protocolli di return-to-play |

Infortuni e wellness sono dati sanitari ex art. 9 GDPR — gli stessi per cui l'app
raccoglie consenso esplicito in registrazione.

### 6.2 La correzione

**`apps/api/src/plugins/auth.ts`** — il controllo è nel decoratore `authenticate`, che
tutte le rotte protette attraversano. Il ruolo ATHLETE è respinto ovunque tranne su una
lista esplicita di eccezioni:

| Prefisso ammesso | Motivo |
|---|---|
| `/api/v1/athlete/` | API dell'app atleti |
| `/api/v1/auth/` | Login, refresh, logout, password |
| `/api/v1/gdpr/` | Opera solo sui dati dell'utente autenticato |
| `/api/v1/health` | Diagnostica |

**Perché in un punto solo e non 55 guardie.** Con la protezione per rotta il default è
"aperto" e ogni rotta nuova ripete la dimenticanza — è così che sono nate le 55. Qui il
default è "negato": una rotta nuova nasce protetta.

**Perché `/gdpr/` resta accessibile.** Quelle rotte filtrano su `where: { id: userId }`:
export, cancellazione account, consensi e audit log **propri**. Negarle priverebbe
l'atleta di diritti garantiti dal GDPR. L'unica rotta amministrativa del gruppo,
`/gdpr/erase/:id`, ha già una guardia `requireMinRole('ADMIN')`.

**Attenzione al confronto:** `/api/v1/athlete/` va scritto **con la barra finale**,
altrimenti combacia anche con `/api/v1/athletes`, che è la rosa lato preparatori.

**`apps/web/src/components/layout/auth-guard.tsx`** — controlla il ruolo e mostra agli
atleti una schermata dedicata con link all'app corretta. Niente redirect automatico: se
l'app atleti rimandasse indietro si creerebbe un ciclo.

Il blocco che conta è quello lato API: senza, basterebbe una chiamata diretta al backend
per aggirare l'interfaccia.

### 6.3 Verifica di non-regressione

Tutte e 12 le chiamate API dell'app atleti (`trainmind-athlete/src/lib/api.ts`) usano
`/athlete/*` o `/auth/login`, quindi rientrano nelle eccezioni.

Se in futuro una funzionalità legittima venisse bloccata, si riconosce dai log:

```bash
dc logs api | grep "ruolo ATHLETE su rotta riservata"
```

La riga riporta `userId` e `route`, così si decide se aggiungere l'eccezione o creare un
endpoint dedicato sotto `/athlete/`.

### 6.4 Cosa resta fuori da questa correzione

- I ruoli `VIEWER` e `MEDICAL` mantengono ampio accesso in lettura: è il comportamento
  atteso, ma non è stato riesaminato in dettaglio.
- `middleware.ts` resta un segnaposto. Un controllo lato server (cookie-based) darebbe
  un ulteriore strato, oggi assente.

---

## 7. Reset manuale d'emergenza

Se un tester resta bloccato fuori prima che l'invio email sia attivo:

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app\packages\db
node -e "console.log(require('bcrypt').hashSync('PasswordTemp1', 12))"
```

Poi in Prisma Studio (o via SQL) incolla l'hash nel campo `passwordHash` dell'utente.
