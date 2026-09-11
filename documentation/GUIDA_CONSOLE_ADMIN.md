# Console di amministrazione — messa online

Fase 1 del piano in `PIANO_CONSOLE_ADMIN.md`. La console e' una app a se',
`trainmind-app/apps/admin`, che gira sulla porta 3005 e legge il database in
**sola lettura**. Non tocca ne' la web app dei clienti ne' l'API.

---

## Cosa e' stato aggiunto

| File | A cosa serve |
|---|---|
| `apps/admin/` | l'applicazione (Next.js 14, `pg`, recharts) |
| `apps/admin/Dockerfile` | immagine, stessa struttura di quella della web app |
| `infra/sql/reporting-role.sql` | crea l'utente Postgres in sola lettura |
| `infra/Caddyfile` | nuovo blocco `{$ADMIN_DOMAIN}` con `basic_auth` |
| `docker-compose.deploy.yml` | servizio `admin` + variabili sul servizio `caddy` |
| `.env.deploy.example` | `ADMIN_DOMAIN`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `DATABASE_URL_READONLY`, `ADMIN_DEMO_EMAIL_PATTERNS` |

---

## Messa online, in ordine

### 1. DNS

Su IONOS, record **A** per `admin` verso `31.70.77.212`. Aspettare che risolva
prima di far ripartire Caddy: senza risoluzione Let's Encrypt non emette il
certificato e il servizio resta in errore.

### 2. Utente Postgres in sola lettura

Scegliere una password, metterla nel file, poi:

```bash
cd /opt/trainmind/trainmind-app
nano infra/sql/reporting-role.sql          # sostituire CAMBIAMI
docker cp infra/sql/reporting-role.sql trainmind-postgres:/tmp/
dc exec postgres psql -U trainmind -d trainmind_db -f /tmp/reporting-role.sql
```

Verifica che sia davvero in sola lettura:

```bash
dc exec postgres psql -U trainmind_reporting -d trainmind_db \
  -c "CREATE TABLE prova(x int);"
# atteso: ERROR:  permission denied for schema public
```

Se quel comando riesce, **fermarsi**: la GRANT e' andata storta e la console
avrebbe potere di scrittura sul database di produzione.

### 3. Password della console

```bash
docker exec trainmind-caddy caddy hash-password
```

Digitare la password, copiare l'hash. **Nel file `.env.deploy` ogni `$`
dell'hash va raddoppiato in `$$`**: Compose interpreta il singolo `$` come una
variabile e la password non funzionerebbe piu'. E' l'errore piu' facile da
fare in tutta questa procedura.

### 4. Variabili

In `/opt/trainmind/trainmind-app/.env.deploy`:

```
ADMIN_DOMAIN=admin.trainmind-app.com
ADMIN_USER=admin
ADMIN_PASSWORD_HASH=$$2a$$14$$...            # con i $ raddoppiati
DATABASE_URL_READONLY=postgresql://trainmind_reporting:LA_PASSWORD@postgres:5432/trainmind_db?schema=public
ADMIN_DEMO_EMAIL_PATTERNS=%@demo.com,%@trainmind.demo,%@pro.com,%@starter.com,%@example.com
```

`ADMIN_DEMO_EMAIL_PATTERNS` decide chi NON conta come cliente vero. Vanno messi
i domini degli account di prova: se un'organizzazione ha anche un solo utente
la cui email combacia, esce da tutte le statistiche.

**Stato al 4/9/2026:** in produzione ci sono cinque organizzazioni e **sono
tutte di prova** — i quattro preparatori su `@demo.com` (MM, VDB, AG, RP) e
`Test Deploy` su `@trainmind.demo`. Con i pattern qui sopra la console mostra
quindi zero societa': e' corretto, non e' un guasto. I numeri veri cominciano
col primo cliente. Per controllare che la console legga davvero il database,
apri **Societa** e clicca "Mostrali": devono comparire tutte e cinque.

Per elencare gli account e tarare i pattern:

```bash
dc exec -T postgres psql -U trainmind_reporting -d trainmind_db -c \
"SELECT o.name, o.tier, u.email, o.\"createdAt\"::date
   FROM organizations o
   JOIN users u ON u.\"organizationId\" = o.id AND u.role = 'ADMIN'
  ORDER BY o.\"createdAt\";"
```

### 5. Build e avvio

```bash
cd /opt/trainmind/trainmind-app
dc build --no-cache admin
dc up -d admin
dc up -d caddy            # NON `dc restart`: vedi sotto
dc ps
dc logs -f admin
```

> ⚠️ **`dc up -d caddy`, mai `dc restart caddy`.** `restart` fa ripartire il
> container con la configurazione che aveva gia': non rilegge il compose e non
> gli passa le variabili nuove. Con `ADMIN_DOMAIN` vuota il blocco del
> Caddyfile diventa un blocco senza nome di dominio, che per Caddy e'
> "configurazione globale" e deve stare in cima al file: il container va in
> loop con `server block without any key is global configuration, and if used,
> it must be first`, **e finche' e' in loop tutto il sito e' offline**, perche'
> Caddy e' il reverse proxy di web, api e atleti. Successo il 4/9/2026 al primo
> avvio della console. Si risolve con `dc up -d caddy`.

### 6. Prova

Aprire `https://admin.trainmind-app.com`: il browser chiede utente e password.
Dentro, la Panoramica deve mostrare numeri coerenti con la realta'.

Controllo utile la prima volta: nella pagina **Societa**, il link "Mostrali"
include anche gli account di prova. Se il totale non cambia, il filtro non sta
funzionando e i pattern in `ADMIN_DEMO_EMAIL_PATTERNS` vanno corretti.

---

## Aggiornamenti successivi

Come per gli altri servizi (vedi `GUIDA_AGGIORNAMENTI.md`):

```bash
dc build --no-cache admin && dc up -d admin
```

Il Caddyfile va toccato solo se cambia il dominio. Se invece cambi una
variabile d'ambiente di Caddy in `.env.deploy`, serve `dc up -d caddy` per
farla arrivare al container.

---

## Cosa questa console NON fa, e perche'

**Non scrive niente.** Niente "sospendi account", niente cambio di piano: le
credenziali con cui parla al database non hanno il permesso di scrivere.
Aggiungere azioni in futuro richiede un secondo utente Postgres e un accesso
piu' solido di una password condivisa — e' una decisione da prendere, non un
pezzo dimenticato.

**Non mostra dati sanitari.** Nessun nome di atleta, nessun valore di wellness,
infortunio o return to play. Solo conteggi. Il gestore della piattaforma non ha
motivo di vedere la cartella di un giocatore.

**Non passa dall'API pubblica.** `api.trainmind-app.com` non ha guadagnato un
solo endpoint nuovo: una vista che attraversa tutte le societa' non deve essere
raggiungibile da dove si autenticano i clienti.

**Non sa da dove arrivano i clienti.** Serve la Fase 2 (UTM e referrer), e
varra' solo per le iscrizioni successive.

**I numeri di utilizzo sono una stima per difetto.** L'unico registro storico
e' `audit_logs`, che traccia solo gli endpoint su dati personali o sanitari.
Chi usa solo calendario, esercizi o periodizzazione non compare. La pagina lo
dice a chiare lettere, in cima.
