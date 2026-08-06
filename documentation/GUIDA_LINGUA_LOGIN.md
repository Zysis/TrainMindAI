# Continuità della lingua: landing → login → app

Guida operativa alla modifica che fa "sopravvivere" la lingua scelta sulla landing
quando si passa alla pagina di login, e che rende la lingua usata al login la
lingua di default dell'account.

Server: VPS IONOS — IP `31.70.77.212` — codice in `/opt/trainmind/`

---

## 1. Cosa è cambiato e perché

**Il problema.** La landing page (`apps/web/src/app/page.tsx`) teneva la lingua in
uno `useState` locale. Uscendo dalla pagina, quello stato spariva. Le pagine di
login/registrazione, per di più, avevano tutti i testi scritti a mano in italiano:
non avrebbero comunque potuto tradursi.

**La soluzione.** Un'unica sorgente di verità: lo store `lib/i18n/store.ts`
(zustand + `localStorage`), già usato dalle Impostazioni. Ora ci scrivono anche la
landing e le pagine di autenticazione, e la preferenza viene salvata sul profilo
utente nel database.

### Regola di precedenza della lingua

| Situazione | Lingua usata |
|---|---|
| Prima visita in assoluto | Lingua del browser (`it`/`en`/`es`), fallback italiano |
| Visite successive | Ultima scelta salvata in `localStorage` |
| Login, con lingua scelta a mano dallo switcher | **Vince la scelta** e viene salvata sul profilo |
| Login su un dispositivo nuovo, senza scelta manuale | Vince la lingua salvata sul profilo |
| Cambio lingua in Impostazioni | Vince e viene salvata sul profilo |

La distinzione "scelta a mano" vs "rilevata dal browser" è tenuta dal flag
`localStorage['trainmind-locale-explicit']`, scritto solo dallo switcher.

### File modificati

**Database e API** (`trainmind-app`)

| File | Modifica |
|---|---|
| `packages/db/prisma/schema.prisma` | Nuovo campo `locale String?` sul model `User` |
| `packages/db/prisma/migrations/20260804090000_add_user_locale/migration.sql` | Migrazione idempotente (`ADD COLUMN IF NOT EXISTS`) |
| `apps/api/src/routes/auth.ts` | `locale` salvato alla registrazione, restituito da login e `/auth/me`; nuovo `PATCH /auth/locale` |
| `apps/api/src/routes/athlete.ts` | `locale` restituito da `GET /athlete/profile` |

**App preparatori** (`trainmind-app/apps/web`)

| File | Modifica |
|---|---|
| `src/lib/i18n/store.ts` | Rilevamento lingua browser, flag scelta esplicita, `pushLocaleToServer`, `applyServerLocale` |
| `src/components/i18n/lang-switcher.tsx` | **Nuovo** — switcher condiviso, scrive sullo store |
| `src/components/auth/auth-shell.tsx` | **Nuovo** — guscio comune alle pagine auth, con switcher in alto a destra |
| `src/app/page.tsx` | Landing agganciata allo store; rimosso lo switcher locale duplicato |
| `src/app/(auth)/login\|register\|forgot-password\|reset-password/page.tsx` | Testi da `useTranslations('auth')` |
| `src/lib/auth/context.tsx` | `syncLocaleWithUser` al login, alla registrazione e al bootstrap |
| `src/lib/auth/api.ts` | Campo `locale` su `AuthUser` |
| `src/lib/i18n/provider.tsx` | `timeZone="Europe/Rome"` sul provider (vedi §5) |
| `src/messages/{it,en,es}.json` | +15 chiavi nel namespace `auth` |

**PWA mobile** (`trainmind-mobile/web`) — stesse modifiche, più la landing resa
multilingua (nuovo namespace `landing`, +54 chiavi per lingua).

**App atleti** (`trainmind-athlete`) — i18n creato da zero:
`src/lib/i18n/store.ts`, `src/lib/i18n/provider.tsx`, `src/messages/{it,en,es}.json`,
`src/components/i18n/lang-switcher.tsx`, provider montato in `app/layout.tsx`,
login tradotto con switcher, header e bottom-nav tradotti, `stores/auth-store.ts`
allinea la lingua al profilo dopo login e al riavvio dell'app.

---

## 2. Verifica in locale (PowerShell)

### 2.1 Rigenera il client Prisma (obbligatorio: c'è un campo nuovo)

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm db:generate
```

> Senza questo passaggio TypeScript non conosce `user.locale` e il type-check fallisce.

### 2.2 Type-check e build

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm type-check
pnpm build
```

> Su Windows `pnpm build` fallisce in fondo con `EPERM ... symlink`: è un limite
> di Windows sullo step `standalone` di Next.js, non un errore del codice.
> Vedi §5 per come aggirarlo. Se leggi `✓ Compiled successfully` e
> `✓ Generating static pages`, il codice è a posto.

> `@trainmind/api` può risultare **cache hit** anche dopo aver modificato le
> route: turbo riusa il risultato precedente. Dopo un cambio a `schema.prisma`
> usa sempre `pnpm type-check --force`, altrimenti l'errore su un campo nuovo
> salta fuori solo al build sul server.

App atleti e PWA mobile (workspace separati):

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-athlete
pnpm type-check

cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-mobile
pnpm type-check
```

**Attenzione: questi due workspace non erano puliti già prima di questa modifica.**
Stato rilevato il 04/08/2026, dopo aver verificato che nessuno di questi errori
ricade nei file toccati qui:

| Workspace | Errori | Natura | Blocca la build? |
|---|---|---|---|
| `trainmind-app` | 0 | — | no |
| `trainmind-athlete` | 5 | `ApiResponse<unknown>` non ristretto nelle `.then()` di sessions/wellness/register + `Uint8Array` in `pwa-register` | **No** — `typescript.ignoreBuildErrors: true` |
| `trainmind-mobile` | 34 | import non usati, `res is of type 'unknown'` in `game/[eventId]`, `TierDef.features`, `formatDate` con un argomento | **Sì** — nessun `ignoreBuildErrors`, ma la PWA non è nel compose di deploy |

Sono debiti tecnici preesistenti, non regressioni. Il criterio per distinguerli:
nessuno dei file elencati negli errori compare fra quelli modificati nella
tabella al §1. L'unica eccezione era `trainmind-mobile/web/src/lib/i18n/provider.tsx`
(`Record<string, unknown>` non assegnabile a `AbstractIntlMessages`), già
sistemata allineandolo alla versione di `apps/web`.

### 2.3 Applica il campo `locale` al DB locale

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm --filter @trainmind/db exec prisma migrate deploy
```

Se il DB locale è fuori sincrono e non ti interessa lo storico migrazioni:

```powershell
pnpm db:push
```

### 2.4 Avvia e prova

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm dev
```

Checklist manuale su `http://localhost:3000`:

1. Landing → switcher su **EN** → clicca **Accedi** → la pagina di login deve essere in inglese.
2. Sulla pagina di login cambia in **ES** → fai il login → la dashboard parte in spagnolo.
3. Impostazioni → la lingua selezionata è **ES**.
4. Logout, poi login di nuovo → resta spagnolo.
5. Finestra in incognito → login con lo stesso account senza toccare lo switcher → l'app parte in spagnolo (lingua letta dal profilo).
6. Incognito, senza login, browser in inglese → la landing si apre già in inglese.

Verifica che la colonna sia valorizzata:

```powershell
# se usi il postgres in docker anche in locale
docker exec trainmind-postgres psql -U trainmind -d trainmind_db -c "SELECT email, locale FROM users;"
```

---

## 3. Deploy sul server

> Prima di tutto: `ssh root@31.70.77.212` e verifica che l'alias `dc` esista.
> Se non c'è: `alias dc='docker compose -f /opt/trainmind/trainmind-app/docker-compose.deploy.yml --env-file /opt/trainmind/trainmind-app/.env.deploy'`

### 3.1 Backup del database (prima di toccare lo schema)

```bash
# sul server
/opt/trainmind/backup.sh
```

### 3.2 Carica i file modificati (PowerShell, dal PC)

**trainmind-app** — schema, migrazione, API e web:

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app

tar -czf update-locale.tar.gz `
  packages/db/prisma/schema.prisma `
  packages/db/prisma/migrations/20260804090000_add_user_locale `
  apps/api/src/routes/auth.ts `
  apps/api/src/routes/athlete.ts `
  apps/web/src/lib/i18n/store.ts `
  apps/web/src/lib/auth/api.ts `
  apps/web/src/lib/auth/context.tsx `
  apps/web/src/lib/i18n/provider.tsx `
  apps/web/src/components/i18n/lang-switcher.tsx `
  apps/web/src/components/auth/auth-shell.tsx `
  "apps/web/src/app/page.tsx" `
  "apps/web/src/app/(auth)/login/page.tsx" `
  "apps/web/src/app/(auth)/register/page.tsx" `
  "apps/web/src/app/(auth)/forgot-password/page.tsx" `
  "apps/web/src/app/(auth)/reset-password/page.tsx" `
  apps/web/src/messages/it.json `
  apps/web/src/messages/en.json `
  apps/web/src/messages/es.json

scp .\update-locale.tar.gz root@31.70.77.212:/opt/trainmind/
Remove-Item .\update-locale.tar.gz
```

**trainmind-athlete** — cartella separata sul server:

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-athlete

tar -czf update-athlete-locale.tar.gz `
  src/lib/i18n `
  src/messages `
  src/components/i18n `
  src/components/layout/app-header.tsx `
  src/components/layout/bottom-nav.tsx `
  src/stores/auth-store.ts `
  src/app/layout.tsx `
  "src/app/(auth)/login/page.tsx"

scp .\update-athlete-locale.tar.gz root@31.70.77.212:/opt/trainmind/
Remove-Item .\update-athlete-locale.tar.gz
```

### 3.3 Estrai sul server

```bash
# sul server
tar -xzf /opt/trainmind/update-locale.tar.gz -C /opt/trainmind/trainmind-app
rm /opt/trainmind/update-locale.tar.gz

tar -xzf /opt/trainmind/update-athlete-locale.tar.gz -C /opt/trainmind/trainmind-athlete
rm /opt/trainmind/update-athlete-locale.tar.gz
```

### 3.4 Applica la migrazione al database

```bash
# sul server — ricostruisci PRIMA l'immagine migrate, altrimenti usa
# lo schema.prisma congelato nell'immagine vecchia
dc --profile tools build migrate
dc run --rm migrate pnpm --filter @trainmind/db exec prisma migrate deploy

# verifica che la colonna esista davvero
docker exec trainmind-postgres psql -U trainmind -d trainmind_db -c "\d users" | grep locale
```

Se il servizio `migrate` dà problemi, la migrazione è idempotente e puoi applicarla
direttamente:

```bash
docker exec -i trainmind-postgres psql -U trainmind -d trainmind_db < \
  /opt/trainmind/trainmind-app/packages/db/prisma/migrations/20260804090000_add_user_locale/migration.sql
```

### 3.5 Ricostruisci i servizi

```bash
# sul server — sempre --no-cache sui sorgenti TS/TSX
dc build --no-cache api web athlete
dc up -d --force-recreate api web athlete
dc ps   # attendi "healthy" su tutti e tre
```

Ordine consigliato se preferisci andare per gradi: prima `api` (che espone il campo
nuovo), poi `web` e `athlete`.

### 3.6 Verifica in produzione

```bash
# sul server — l'endpoint nuovo deve rispondere 401 senza token (non 404)
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH https://api.trainmind-app.com/api/v1/auth/locale

# log in caso di problemi
dc logs --tail=80 api
dc logs --tail=80 web
```

Poi dal browser, su `https://app.trainmind-app.com`:

1. Landing in inglese → **Accedi** → login in inglese.
2. Login → dashboard in inglese → Impostazioni mostra **English**.
3. `https://atleti.trainmind-app.com` → switcher in alto a destra → login → app nella lingua scelta.

---

## 4. Rollback

Il campo `locale` è nullable e non rompe il codice vecchio: per tornare indietro
basta ripristinare i file e ricostruire, senza toccare il database.

```bash
# sul server, se hai bisogno di ripartire dal backup del DB
ls -lh /opt/trainmind/backups/
# poi ripristina con psql il dump scelto
```

---

## 5. Due errori incontrati durante la build su Windows

### `Error: EPERM: operation not permitted, symlink ...` — **non è un errore del codice**

```
Failed to copy traced files for ...\.next\server\pages\_app.js
Error: EPERM: operation not permitted, symlink
```

Arriva alla fine, nello step `writeStandaloneDirectory`: Next.js con
`output: 'standalone'` deve creare symlink dentro `.next/standalone`, e Windows
non li concede a un utente normale. Tutto quello che conta era già passato:
`✓ Compiled successfully`, `Checking validity of types` senza errori,
`✓ Generating static pages (28/28)`.

Tre modi per aggirarlo, in ordine di comodità:

```powershell
# a) verifica il codice senza produrre lo standalone (consigliato in locale)
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm type-check
pnpm --filter @trainmind/web exec next lint
```

```powershell
# b) attiva la Modalità sviluppatore di Windows (una tantum, poi symlink permessi)
start ms-settings:developers
```

```powershell
# c) apri PowerShell come Amministratore e rilancia
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm build
```

Sul server non si presenta: il build gira in Docker su Linux.

### `IntlError: ENVIRONMENT_FALLBACK` — risolto

```
u [Error]: ENVIRONMENT_FALLBACK
    at t.useTranslations (...)
    at ...\app\(auth)\reset-password\page.js
```

Nonostante il nome, non riguarda la lingua: `use-intl` avvisa che al
`NextIntlClientProvider` non è stato passato un `timeZone`. Senza, il prerender
usa il fuso della macchina di build e il browser quello dell'utente → markup
diversi sulle date. Non compariva prima perché nessuna pagina prerenderizzata
staticamente usava `useTranslations`; le pagine di autenticazione lo sono.

Risolto fissando `timeZone="Europe/Rome"` in tutti e tre i provider
(`apps/web`, `trainmind-mobile/web`, `trainmind-athlete`). Se un giorno servisse
il fuso reale dell'utente, va letto client-side con
`Intl.DateTimeFormat().resolvedOptions().timeZone` **dopo** il mount, mai in SSR.

---

## 6. Note e limiti noti

- **trainmind-mobile non è nel compose di deploy** (`docker-compose.deploy.yml`
  espone `web`, `api`, `athlete`, `ai-service`). Le modifiche alla PWA valgono per
  l'ambiente locale su `:3002` e per l'eventuale deploy separato via `vercel.json`.
- **17 chiavi `athletes.*` mancano in `en.json` e `es.json`** di `apps/web`
  (`inviteAthleteTitle`, `sendInvite`, `copyLink`, …). È un buco preesistente della
  feature "invito atleta", non introdotto da questa modifica: un utente inglese o
  spagnolo vede la chiave grezza al posto del testo in quel dialog. Vale la pena
  sistemarlo a parte.
- **L'app atleti è tradotta su login, header e navigazione.** Le schermate interne
  (home, sessioni, wellness, storico, profilo) hanno ancora i testi in italiano:
  l'infrastruttura i18n ora c'è, va solo popolata con le chiavi.
- **`pnpm db:generate` è obbligatorio** dopo aver preso queste modifiche su una
  macchina nuova, altrimenti il type-check fallisce su `user.locale`.
