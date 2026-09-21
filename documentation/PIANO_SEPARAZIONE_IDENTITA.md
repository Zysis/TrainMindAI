# TrainMind — Separazione delle identità dai dati di allenamento

**Piano di implementazione**
Versione 1.0 — 20 settembre 2026
Stato: implementato in locale il 20/09/2026 — non ancora in produzione

---

## 1. Perché

Oggi `athletes` contiene nome, cognome, data di nascita ed email in chiaro, sulla
stessa riga a cui sono agganciati infortuni, wellness e carichi. Una sola `JOIN`
su un dump del database — o una query del ruolo di sola lettura della console —
produce "Marco Rossi, 18 anni, lesione LCA, dorme 4 ore".

I dati sanitari e di carico **non si possono cifrare**: ci si calcola sopra
(ACWR, medie, soglie di alert). L'unica leva disponibile è spezzare il legame fra
quei dati e la persona.

## 2. Decisioni prese

| Decisione | Scelta |
|---|---|
| Dove vivono le identità | Tabella separata nello **stesso** database, con `REVOKE` esplicito per il ruolo reporting |
| Perimetro | Atleti + staff (`users`) + de-identificazione dei prompt AI |
| Cifratura delle colonne | **Non ora** — questa passata è il refactor che la rende economica dopo |
| Data di nascita atleti | Data piena nel caveau, solo `birthYear` nella tabella principale |

Conseguenza della prima scelta: `JOIN`, `ORDER BY` per cognome e paginazione
server-side continuano a funzionare come oggi. La protezione viene dai permessi
Postgres, non dalla crittografia. È un livello in meno di quello massimo teorico,
in cambio di zero riscritture delle query e zero downtime.

## 3. Modello dati

### Prima

```
athletes(id, firstName, lastName, dateOfBirth, position, jerseyNumber,
         height, weight, team, email, photoUrl, isActive, organizationId, …)
users(id, email, passwordHash, firstName, lastName, role, …)
```

### Dopo

```
athletes(id, position, jerseyNumber, height, weight, team, birthYear,
         isActive, organizationId, …)              ← nessun identificatore

athlete_identities(athleteId PK/FK, firstName, lastName,
                   dateOfBirth, email, photoUrl)   ← REVOKE per il reporting

users(id, email, passwordHash, role, …)            ← email resta: è la credenziale di login
user_identities(userId PK/FK, firstName, lastName) ← GRANT al reporting (vedi 3.1)
```

Relazione 1:1 con `onDelete: Cascade`: cancellare un atleta cancella la sua
identità, e la route GDPR di erasure non cambia comportamento.

### 3.1 Perché il reporting mantiene l'accesso alle identità staff

`apps/admin/src/lib/queries/contacts.ts` è l'unico punto della console che mostra
nomi ed email, e sono **i clienti di LAB21** (preparatori con consenso marketing
attivo), non gli atleti. Togliergli l'accesso romperebbe una funzione legittima.

Quindi: `REVOKE` su `athlete_identities`, `GRANT SELECT` su `user_identities`.

Per lo staff il guadagno di privacy immediato è quindi **nullo**: lo spostamento
è preparatorio, serve a creare il punto di accesso unico per la cifratura futura.
Vale la pena saperlo prima di considerare quella parte "fatta".

### 3.2 Il tranello dei permessi di default

`infra/sql/reporting-role.sql` contiene:

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO trainmind_reporting;
```

Ogni tabella nuova diventa leggibile dal ruolo reporting **in automatico**.
`athlete_identities` nascerebbe quindi già visibile alla console, vanificando
tutto il lavoro in silenzio. La `REVOKE` va dentro la migration, non in un
documento che qualcuno dovrebbe ricordarsi di eseguire.

## 4. Migrazione dei dati esistenti

Nessuna riga viene cancellata. Le colonne si svuotano **solo dopo** che i dati
sono stati copiati, nella stessa transazione.

```sql
BEGIN;

CREATE TABLE athlete_identities (
  "athleteId"   TEXT PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
  "firstName"   TEXT NOT NULL,
  "lastName"    TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "email"       TEXT,
  "photoUrl"    TEXT
);

INSERT INTO athlete_identities
SELECT id, "firstName", "lastName", "dateOfBirth", email, "photoUrl" FROM athletes;

ALTER TABLE athletes ADD COLUMN "birthYear" INTEGER;
UPDATE athletes SET "birthYear" = EXTRACT(YEAR FROM "dateOfBirth")::int;
ALTER TABLE athletes ALTER COLUMN "birthYear" SET NOT NULL;

ALTER TABLE athletes
  DROP COLUMN "firstName", DROP COLUMN "lastName",
  DROP COLUMN "dateOfBirth", DROP COLUMN email, DROP COLUMN "photoUrl";

-- stessa cosa per user_identities, senza DROP di users.email

REVOKE ALL ON athlete_identities FROM trainmind_reporting;  -- se il ruolo esiste
GRANT SELECT ON user_identities TO trainmind_reporting;

COMMIT;
```

Verifica obbligatoria prima del `COMMIT` in produzione:
`SELECT count(*) FROM athletes` = `SELECT count(*) FROM athlete_identities`.

## 5. Impatto sul codice

### 5.1 Il vincolo: l'utente finale deve continuare a vedere il nome vero

Vale per la web app, per l'app atleta, per i PDF e per le email. Il modo per
garantirlo senza toccare ~500 occorrenze di `firstName` fra web e API è **non
cambiare la forma del JSON dell'API**.

Un hook `preSerialization` unico in `apps/api/src/app.ts` appiattisce
ricorsivamente `identity` dentro l'oggetto che la contiene, ovunque si trovi
nella risposta:

```
{ id, position, identity: { firstName, lastName } }
      ↓
{ id, position, firstName, lastName }
```

Conseguenza: `apps/web`, `trainmind-athlete` e `trainmind-mobile` **non vengono
toccati dalla separazione**. Ricevono lo stesso JSON di oggi.

> **Eccezione, per un difetto preesistente.** `app/dashboard/chat/page.tsx` non
> leggeva i parametri dell'URL: il pulsante sulla scheda atleta passava
> `?athlete=…`, ma la pagina chiamava `useChat({ namespaces })` senza
> `athleteId`. Quindi `athlete_id` non arrivava mai all'API e l'ai-service non
> costruiva il contesto: la chat rispondeva "non ho informazioni su questo
> atleta" anche aperta dalla sua scheda. Corretto in `apps/web` e nella copia
> `trainmind-mobile`. Nella stessa passata il nome e' uscito dall'URL (restava
> in cronologia, log e referrer): ora la pagina lo chiede all'API con l'id.
> Il pulsante si chiama "Assistente AI" e non piu' "Crea Scheda AI", che
> descriveva una cosa che non faceva.

### 5.2 Cosa cambia davvero, file per file

| Area | File | Modifica |
|---|---|---|
| Schema | `packages/db/prisma/schema.prisma` | 2 modelli nuovi, colonne spostate, `birthYear` |
| Migration | `packages/db/prisma/migrations/…_identity_vault/` | SQL del §4 |
| Appiattimento | `apps/api/src/lib/identity.ts` (nuovo), `app.ts` | helper + hook `preSerialization` |
| Lista/ricerca | `routes/athletes.ts`, `schemas/athletes.ts` | `where.OR` e `sortBy` passano da `identity` |
| Ordinamenti | ~15 punti in `field-training.ts`, `game-tracking.ts`, `daily-report.ts`, `reports.ts`, … | `orderBy: { athlete: { identity: { lastName } } }` |
| Select | `adaptations`, `alerts`, `analytics`, `injuries`, `teams`, `training`, `wellness`, `periodization`, `notifications`, `dashboard` | `identity: { select: … }` |
| Scrittura | `routes/athletes.ts` (POST/PUT), `staff.ts`, `auth.ts` | create/update annidati |
| Export GDPR | `routes/gdpr.ts` | deve continuare a esportare il nome vero |
| AI | `routes/ai.ts`, `apps/ai-service/app/services/context_builder.py` | pseudonimo al posto del nome |
| Seed/script | `seed.ts`, `setup-accounts.ts`, `seed-demo.ts`, `seed-team14.ts`, `seed-guida*.ts` | anagrafiche annidate, `birthYear` |
| Test | `apps/api/test/*.test.ts` | le fixture creano l'anagrafica nel caveau |
| Console | `apps/admin/src/lib/queries/contacts.ts` | JOIN su `user_identities` |

I file `*.bak-*` presenti in `routes/` e `services/` **non vanno toccati**: sono
copie di backup, non entrano nella build.

### 5.3 De-identificazione dei prompt AI

`routes/ai.ts` costruisce oggi prompt come:

```
- Atleta: Marco Rossi (PG)
```

Diventa:

```
- Atleta: A7 (PG, 18 anni)
```

La mappa `A7 → athleteId` vive **solo in memoria, per la durata della richiesta**.
La risposta del modello viene ri-mappata prima di tornare al frontend, quindi il
preparatore continua a leggere "Marco Rossi" nel testo dell'AI. Nessun nome esce
più verso il fornitore del modello.

Questo vale anche per il percorso di emergenza `lib/openai-fallback.ts`, che non
passa dall'ai-service.

**Il nome scritto dal preparatore.** Nella chat e nel coach il contesto
dell'atleta lo costruisce l'ai-service da `athlete_id`, e non contiene piu' il
nome. Se pero' il preparatore scrive "come sta Marco Sartori?", quel nome
partirebbe comunque, dentro la domanda. Quando c'e' un atleta selezionato il
suo nome (nome, cognome, o entrambi in qualsiasi ordine) viene sostituito con
"l'atleta" prima di uscire: il modello ha davanti i dati di quell'atleta e
risponde nel merito, senza mai vedere di chi si tratti.

**Chi costruisce il contesto dell'atleta.** Lo costruisce `apps/api`
(`lib/athlete-context.ts`) e lo manda all'ai-service nel corpo della richiesta,
come `athlete_context`. Prima ci provava l'ai-service richiamando l'API
all'indietro, e non ha mai funzionato in nessun ambiente: chiamata senza token
(401), `API_BASE_URL` scritto nel codice come `localhost` (dentro Docker punta a
sé stesso) e un endpoint wellness inesistente — da cui il messaggio "profilo non
disponibile". Il difetto era invisibile perché la pagina della chat non mandava
mai `athlete_id`.

Il riepilogo contiene ruolo, età (dall'anno di nascita), altezza, peso, wellness
degli ultimi 7 giorni e infortuni attivi. Nome, cognome, email e data di nascita
esatta non ci entrano. Vantaggio secondario: non serve nessun token di servizio
fra i due processi, e cosa esce si decide in un punto solo.

L'impronta del contesto entra nella chiave di cache delle risposte coach: senza,
la stessa domanda sullo stesso atleta continuerebbe a servire l'analisi di ieri.

Resta fuori dal meccanismo il nome di un atleta **non** selezionato scritto a
mano in una chat generica: li' non c'e' un atleta a cui agganciarlo, il modello
non ha i suoi dati, e la sostituzione renderebbe la domanda incomprensibile.

## 6. Cosa NON cambia

- L'interfaccia della web app e dell'app atleta: identiche, nome vero ovunque.
- ACWR, alert, periodizzazione, calendario: non toccano gli identificatori.
- Login, reset password, inviti: `users.email` resta dov'è.
- La console admin: continua a vedere i contatti marketing, smette di vedere gli atleti.
- I test e2e: la forma delle risposte API è invariata per costruzione (§5.1).

## 7. Rollback

La migration inversa è scritta e versionata insieme a quella diretta: ricrea le
colonne su `athletes`, ricopia i valori dal caveau, e lascia le tabelle caveau in
piedi (droppate a mano solo dopo conferma). Più il backup `pg_dump` preso
immediatamente prima, che resta la rete di sicurezza vera.

## 8. Ordine di esecuzione

1. Schema Prisma + migration + migration inversa
2. `lib/identity.ts` + hook in `app.ts`
3. Route API, in ordine: `athletes` → letture → scritture → `gdpr`
4. De-identificazione AI (api + ai-service)
5. Seed e script di manutenzione
6. Typecheck e test su Windows (PowerShell), che in sandbox non sono eseguibili
7. Deploy: backup → build → migration → restart → verifica

I comandi di ogni passo stanno in `DEPLOY_SEPARAZIONE_IDENTITA.md`.

## 9. Stato al 21/09/2026

Implementato e verificato in locale. La migration e' applicata al database di
sviluppo; in produzione no.

| Verifica | Esito |
|---|---|
| `pnpm type-check` | verde, 8 pacchetti su 8 |
| `pnpm test` | verde, 48 test su 48 |
| `pnpm test:e2e` | verde, **67 su 67** (2,4 minuti) |
| Verifica a schermo | fatta: chat, insights wellness, lista e ricerca atleti, creazione e modifica, app atleta, console |

### Difetti del prodotto emersi e corretti strada facendo

Nessuno dei tre c'entra con la separazione delle identita': sono venuti a galla
perche' i test hanno smesso di mentire.

1. **La pagina della chat non leggeva `?athlete=`**: `athlete_id` non arrivava
   mai all'API e l'assistente rispondeva "non ho informazioni su questo atleta"
   anche aperto dalla scheda dell'atleta.
2. **Il contesto atleta per l'AI non ha mai funzionato**: l'ai-service chiamava
   l'API senza token, con `localhost` scritto nel codice e un endpoint wellness
   inesistente. Ora il riepilogo lo costruisce l'API e lo manda nella richiesta.
3. **Tre difetti di accessibilita'**: il componente `Modal` condiviso non aveva
   `role="dialog"` ne' `aria-modal` (i test passavano intercettando il banner
   cookie, che invece ce l'ha); il pulsante di invio della chat non aveva nome
   accessibile; il pulsante "Crea Scheda AI" apriva una chat ed e' stato
   rinominato "Assistente AI".

### La suite e2e era ferma dal 17 settembre

Si autenticava con `trainer@trainmind.demo`, cancellato quel giorno dal database
locale. Rimessa in piedi: account `coach@example.com` (societa' con dati veri),
tour e banner cookie dichiarati gia' visti nel fixture, lingua forzata a `it`,
selettori allineati alla barra laterale attuale, e **riscaldamento delle rotte
nel passo di setup** — in `pnpm dev` la prima visita a una rotta mai aperta puo'
superare i 20 secondi, ed era la causa che faceva cadere, a ogni esecuzione, il
primo test di un file diverso.

### Deploy in produzione — 21/09/2026

Eseguito. Backup `~/backup_pre_identity_20260921_0836.dump` prima di toccare
qualsiasi cosa. Esiti:

| Controllo | Atteso | Ottenuto |
| --- | --- | --- |
| `athletes` / `athlete_identities` | 73 / 73 | 73 / 73 |
| `users` / `user_identities` | 10 / 10 | 10 / 10 |
| Colonne in chiaro su `athletes` | rimosse | rimosse |
| `birthYear` su `athletes` | `integer NOT NULL` | `integer NOT NULL` |
| `trainmind_reporting` vede `athlete_identities` | `f` | `f` |
| `trainmind_reporting` vede `user_identities` | `t` | `t` |
| Container | tutti healthy | 9/9 healthy |
| `ERROR` nei log api | nessuno | nessuno |
| Nomi nei prompt ai-service | nessuno | nessuno |

Nessun `RAISE EXCEPTION`: il travaso ha coperto tutte le righe al primo colpo e
la migration e' arrivata fino alla rimozione delle colonne.

**Due cose imparate durante questo deploy:**

1. Le tabelle fisiche sono snake_case (`athletes`, `users`) per via di `@@map`
   nello schema Prisma. Le query di verifica scritte con i nomi dei *modelli*
   (`"Athlete"`, `"User"`) falliscono con `relation does not exist` e fanno
   sembrare vuoto un database pieno. Il documento di deploy e' sempre stato
   corretto; l'errore e' nato dallo scriverle a memoria invece di copiarle.
2. L'archivio di deploy pesava 4,1 GB non per i `node_modules` ma per
   `apps/ai-service/models/trainmind-mistral-7b-Q4_K_M.gguf`. Escluso quello,
   l'intero monorepo sta in 3,7 MB. Vedi `DEPLOY_SEPARAZIONE_IDENTITA.md` § 2.3.

Verifica a schermo di § 2.9 (i sei punti): **superata**, confermata
dall'utente il 21/09/2026. Il rilascio e' chiuso.

**Resta aperto, facoltativo:**

- Cifratura AES-GCM delle cinque colonne del vault. Dopo questo lavoro tocca
  una sola tabella e un solo punto di lettura, quindi costa molto meno di
  prima. Protegge da chi ottiene i file del database o un backup; non da chi
  ottiene le credenziali dell'API.
- Cinque script SQL di manutenzione storici fanno ancora riferimento alle
  colonne rimosse: vanno sistemati prima di riusarli, o si fermeranno con un
  errore chiaro.
- Il backup `~/backup_pre_identity_20260921_0836.dump` sul VPS si puo'
  cancellare quando si ritiene consolidato il rilascio.

Attenzione appresa strada facendo: in locale l'ai-service gira in Docker con
`COPY` del sorgente, non come processo di `pnpm dev`. Dopo ogni modifica Python
serve `docker compose build ai-service && docker compose up -d ai-service`,
altrimenti gira il codice dell'ultima build. Stessa natura della trappola del
servizio `migrate` in produzione.
