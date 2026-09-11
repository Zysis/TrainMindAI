# Fase 2 — cancello sulle registrazioni e provenienza degli iscritti

Scritta il 4 settembre 2026. Riguarda `apps/api`, `apps/web`, `webpage_LAB21`,
`packages/db` e la console `apps/admin`. Vedi `PIANO_CONSOLE_ADMIN.md` e
`GUIDA_CONSOLE_ADMIN.md`.

---

## 1. Cosa cambia

### Il cancello sulle registrazioni

`DISABLE_REGISTRATION=true` chiude la registrazione al pubblico. Chi presenta
il token in `REGISTRATION_ACCESS_TOKEN` passa lo stesso: serve a creare account
di prova in produzione passando dal flusso **vero** — email, consensi
versionati, seed degli esercizi — invece di fabbricarli in SQL, che
verificherebbe tutto tranne cio' che gli utenti faranno davvero.

Come si usa: `https://trainmind-app.com/app?k=<token>`. Il parametro `k`
sopravvive al percorso landing → registrazione, quindi si puo' entrare anche
direttamente da `/app/register?k=<token>`.

Senza `REGISTRATION_ACCESS_TOKEN` impostata **non esiste scorciatoia**: chiuso
vuol dire chiuso. Il confronto e' a tempo costante, cosi' il token non si
indovina un carattere per volta misurando i tempi di risposta.

> ⚠️ **`REGISTRATION_ACCESS_TOKEN` deve stare anche nel blocco `environment`
> del servizio `api`** in `docker-compose.deploy.yml`. Compose passa al
> container solo le variabili elencate lì: scriverla in `.env.deploy` non
> basta, e il sintomo e' un token corretto che viene respinto senza spiegazioni.
> Dimenticata al primo giro il 4/9/2026.
>
> ⚠️ **`x-registration-token` deve stare in `allowedHeaders` della CORS**, in
> `apps/api/src/app.ts`. Quella lista e' chiusa: un'intestazione non elencata
> viene rifiutata dal browser nella richiesta preliminare (`OPTIONS`) e la
> chiamata vera **non parte nemmeno**. Con `curl` non succede — CORS e' una
> regola che applica il browser, non il server — quindi i test a riga di
> comando passano mentre dal browser non funziona niente. Dimenticato al primo
> giro il 4/9/2026.
>
> Nota anche `maxAge: 86400`: il browser tiene in cache l'esito della richiesta
> preliminare per 24 ore. Dopo aver corretto la lista, se avevi gia' provato
> con il token, usa una finestra anonima o svuota la cache: altrimenti il
> browser continua a fidarsi della vecchia risposta.

### La provenienza

Cinque colonne nuove su `organizations`: `utmSource`, `utmMedium`,
`utmCampaign`, `signupReferrer`, `signupAttribution` (JSON con term, content e
pagina di atterraggio).

Il percorso del dato: il sito vetrina legge `utm_*` dal proprio indirizzo e il
referrer esterno, li riattacca al link "Scopri di piu'"; la landing dell'app li
tramanda ai link verso la registrazione; la pagina di registrazione li legge e
li manda all'API, che li salva sull'organizzazione appena creata.

Nessun cookie e nessuno storage in tutto il percorso: i parametri viaggiano
nell'indirizzo, che e' gia' la memoria che serve. Un dato in meno da dichiarare
nel banner dei consensi.

**Vale solo da ora in avanti.** Per le societa' gia' iscritte le colonne
restano NULL e non sono ricostruibili: prima di oggi la sorgente non veniva
osservata. La console tiene questo caso separato da "diretto", perche'
confonderli significherebbe leggere un buco nella misurazione come traffico
spontaneo.

---

## 2. File toccati

| File | Cosa |
|---|---|
| `packages/db/prisma/schema.prisma` | cinque campi + indice su `utmSource` |
| `packages/db/prisma/migrations/20260904120000_signup_attribution/` | migrazione |
| `apps/api/src/schemas/auth.ts` | `attribution` opzionale, con tetti di lunghezza |
| `apps/api/src/routes/auth.ts` | cancello + salvataggio della provenienza |
| `apps/web/src/lib/attribution.ts` | lettura dei parametri e inoltro fra pagine |
| `apps/web/src/lib/attribution.test.ts` | 12 test sulla precedenza fra le sorgenti |
| `apps/web/vitest.config.ts` | alias `@`, altrimenti i test non risolvono gli import |
| `apps/web/src/lib/auth/api.ts` | tipo `RegisterInput` condiviso, header del token |
| `apps/web/src/lib/auth/context.tsx` | usa il tipo condiviso invece di ricopiarlo |
| `apps/web/src/app/(auth)/register/page.tsx` | legge provenienza e token |
| `apps/web/src/app/page.tsx`, `(auth)/login/page.tsx` | tramandano i parametri |
| `webpage_LAB21/src/js/links.js` | riattacca i parametri al link verso l'app |
| `apps/admin/…` | pagina Acquisizione con sorgenti, campagne e siti |
| `docker-compose.deploy.yml` | `REGISTRATION_ACCESS_TOKEN` sul servizio `api` |
| `apps/web/src/app/layout.tsx` | `force-dynamic`: cura la pagina bianca sui link diretti |

---

## 3. Messa online, in ordine

### 3.1 Sul PC

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app

# Il client Prisma va rigenerato: senza, il type-check non conosce i campi nuovi
pnpm --filter @trainmind/db run generate

pnpm --filter @trainmind/web test          # 12 test sulla provenienza
pnpm --filter @trainmind/web type-check
pnpm --filter @trainmind/api type-check
pnpm --filter @trainmind/admin type-check
```

L'`EPERM symlink` sul `build` di Windows e' atteso: vedi la trappola 3 in
`GUIDA_AGGIORNAMENTI.md`. Contano `Compiled successfully` e i type-check.

### 3.2 Trasferimento

```powershell
tar -czf fase2.tar.gz `
  --exclude="apps/admin/node_modules" --exclude="apps/admin/.next" `
  --exclude="apps/web/node_modules" --exclude="apps/web/.next" `
  packages/db/prisma apps/api/src apps/web/src apps/web/vitest.config.ts apps/admin/src

scp .\fase2.tar.gz root@31.70.77.212:/opt/trainmind/

cd ..\webpage_LAB21
tar -czf lab21.tar.gz src/js/links.js
scp .\lab21.tar.gz root@31.70.77.212:/opt/trainmind/
```

### 3.3 Sul server — l'ordine conta

```bash
cd /opt/trainmind/trainmind-app
tar -xzf /opt/trainmind/fase2.tar.gz -C /opt/trainmind/trainmind-app && rm /opt/trainmind/fase2.tar.gz
tar -xzf /opt/trainmind/lab21.tar.gz -C /opt/trainmind/webpage_LAB21 && rm /opt/trainmind/lab21.tar.gz

# 1. il token del cancello e la chiusura al pubblico
TOKEN=$(openssl rand -hex 16); echo "TOKEN REGISTRAZIONI: $TOKEN"
cat >> .env.deploy <<EOF

# Registrazioni chiuse al pubblico durante i test di produzione.
# Chi presenta questo token in ?k=<token> passa lo stesso.
DISABLE_REGISTRATION=true
REGISTRATION_ACCESS_TOKEN=$TOKEN
EOF

# 2. BUILD PRIMA DELLA MIGRAZIONE, E **migrate** VA NELLA LISTA: quel
#    servizio non legge le migrazioni dal disco del server, usa quelle
#    congelate nella sua immagine (trappola 1 dei deploy). Lasciarlo fuori
#    significa `P3017: migration could not be found` anche con la cartella
#    presente sul disco. Successo il 4/9/2026.
dc build --no-cache api web admin lab21 migrate

# 3. migrazione
#
# ATTENZIONE: su questo database `_prisma_migrations` NON copre lo schema di
# base (storia del progetto: si e' usato `db push`). Lanciare `migrate deploy`
# alla cieca in produzione con quello stato e' rischioso. Per una migrazione
# semplice come questa — cinque colonne nullable, nessuna riscrittura di
# tabella — conviene applicarla a mano e poi registrarla:
dc exec -T postgres psql -U trainmind -d trainmind_db -v ON_ERROR_STOP=1 \
  < packages/db/prisma/migrations/20260904120000_signup_attribution/migration.sql

# le colonne nuove vanno concesse anche all'utente in sola lettura della console
dc exec -T postgres psql -U trainmind -d trainmind_db \
  -c 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO trainmind_reporting;'

# e ora la si registra, o il prossimo `migrate deploy` provera' a rifarla
dc --profile tools run --rm --entrypoint sh migrate -c \
  'cd packages/db && npx prisma migrate resolve --applied 20260904120000_signup_attribution'

# 4. avvio
dc up -d api web admin lab21
dc ps
```

`admin` va ricostruito **dopo** la migrazione o le sue query cercherebbero
colonne che non esistono ancora; con l'ordine qui sopra il container parte a
migrazione gia' fatta.

---

## 3-bis. La pagina bianca sui link diretti

Aprire `/app/register` (o qualunque pagina interna) con un link diretto o un
F5 dava una pagina completamente bianca. Non c'entra la Fase 2: e' il bug CSP
gia' noto — il middleware genera un `nonce` nuovo a ogni richiesta ma l'HTML
usciva dalla cache di route di Next con un nonce diverso, quindi il browser
bloccava tutti gli script e React non partiva mai. Dentro l'app non si notava,
perche' la navigazione e' lato client e l'HTML si chiede una volta sola.

Con le campagne diventa un problema serio: chi clicca un annuncio atterra
DIRETTAMENTE sulla registrazione, cioe' proprio nel caso rotto.

Cura: `export const dynamic = 'force-dynamic'` nel layout radice della web app.
L'HTML viene rigenerato a ogni richiesta e il nonce combacia sempre. Costo
quasi nullo — sono gusci renderizzati dal browser — e i file JavaScript
restano cachati.

---

## 4. Verifica

```bash
# senza token: chiuso
curl -s -X POST https://api.trainmind-app.com/api/v1/auth/register \
  -H 'Content-Type: application/json' -d '{}' | head -c 200
# atteso: REGISTRATION_DISABLED

# con token sbagliato: chiuso lo stesso
curl -s -X POST https://api.trainmind-app.com/api/v1/auth/register \
  -H 'Content-Type: application/json' -H 'x-registration-token: sbagliato' \
  -d '{}' | head -c 200
# atteso: REGISTRATION_DISABLED

# con token giusto: passa il cancello e si ferma sulla validazione
curl -s -X POST https://api.trainmind-app.com/api/v1/auth/register \
  -H 'Content-Type: application/json' -H "x-registration-token: $TOKEN" \
  -d '{}' | head -c 200
# atteso: VALIDATION_ERROR  ← il cancello si e' aperto
```

Se i tre `curl` si comportano come sopra, il cancello lato server e' a posto:
un fallimento dal browser a questo punto e' CORS o l'indirizzo senza `?k=`.

Poi dal browser. **Due prove separate**, perche' provano cose diverse.

**Prova 1 — l'indirizzo diretto.** Salta ogni navigazione e verifica solo che
API e modulo funzionino:

```
https://trainmind-app.com/app/register?k=<token>&utm_source=prova&utm_medium=test&utm_campaign=verifica
```

**Prova 2 — il giro completo.** Verifica che i parametri sopravvivano ai salti
fra le pagine, che e' la parte fragile:

```
https://trainmind-app.com/app?k=<token>&utm_source=prova&utm_medium=test&utm_campaign=verifica
```

Da li' prova **entrambi** i percorsi: il pulsante di registrazione diretto, e il
giro "Accedi" → "Registrati". I parametri devono restare nella barra degli
indirizzi a ogni passo.

> I link che tramandano i parametri sono cinque, e vanno tenuti tutti: sulla
> landing i due verso `/register` e i due verso `/login` (barra in alto e
> footer), piu' quello da `/register` a `/login`. Il 4/9/2026 al primo giro
> mancavano i due verso `/login`, e chi passava da li' arrivava alla
> registrazione senza niente — nessun errore, solo un indirizzo pulito e un
> cancello che si rifiuta di aprirsi. **Un link nuovo verso `/login` o
> `/register` va sempre avvolto in `withForwarded`.**

**Sulla pagina di registrazione deve comparire una striscia verde** che dice
"Accesso di prova attivo". Se non c'e', il token si e' perso per strada e
l'invio verra' rifiutato: ricontrolla l'indirizzo.

Registra un account con email `@trainmind.demo` (la console esclude quel
dominio dalle statistiche), poi apri la console su **Acquisizione**: sotto "Da
dove arrivano" e in "Campagne" deve comparire `prova / test / verifica`.

---

## 5. Quando si apre al pubblico

```bash
sed -i '/^DISABLE_REGISTRATION=/d' .env.deploy
dc up -d api
```

Il token puo' restare: senza `DISABLE_REGISTRATION=true` non viene nemmeno
guardato.
