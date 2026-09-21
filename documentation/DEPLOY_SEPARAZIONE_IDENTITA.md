# Deploy — Separazione delle identità (20/09/2026)

Migration `20260920090000_identity_vault`.
Piano e motivazioni: `PIANO_SEPARAZIONE_IDENTITA.md`.

**Cosa cambia in una riga:** nome, cognome, data di nascita, email e foto degli
atleti escono da `athletes` e finiscono in `athlete_identities`; nome e cognome
dello staff escono da `users` e finiscono in `user_identities`. Nessun dato
viene cancellato. La web app e l'app atleta continuano a mostrare i nomi veri:
il JSON dell'API è identico a prima.

> **Ordine obbligato:** il codice nuovo non gira sullo schema vecchio, e il
> codice vecchio non gira su quello nuovo. Database e immagini vanno aggiornati
> nella stessa finestra.

---

## Parte 1 — In locale (PowerShell)

### 1.1 Backup del database di sviluppo

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
docker exec trainmind-postgres pg_dump -U trainmind -d trainmind_db -f /tmp/pre-identity.sql
docker cp trainmind-postgres:/tmp/pre-identity.sql .\backup_pre_identity_vault.sql
```

### 1.2 Applicare la migration

Non usare `pnpm db:migrate` (è `prisma migrate dev`: propone di **azzerare** il
database). La migration si applica a mano.

```powershell
docker cp packages\db\prisma\migrations\20260920090000_identity_vault\migration.sql trainmind-postgres:/tmp/m.sql
docker exec trainmind-postgres psql -U trainmind -d trainmind_db -v ON_ERROR_STOP=1 -f /tmp/m.sql
```

La migration si ferma da sola, senza toccare nulla, se anche una sola anagrafica
non è stata copiata: in quel caso stampa `STOP: N atleti senza identita copiata`
e nessuna colonna viene rimossa.

### 1.3 Rigenerare il client Prisma

Senza questo passo ogni query risponde `Unknown argument 'identity'`.

```powershell
pnpm db:generate
```

### 1.4 Controlli che qui non posso fare io

I `node_modules` sono installati da pnpm su Windows: `tsc` e `next build` non
sono lanciabili dalla shell Linux della sessione. Questi tre comandi sono il
vero collaudo delle modifiche:

```powershell
pnpm type-check
pnpm test
pnpm -w test:e2e
```

Se `type-check` segnala errori, sono quasi certamente `identity` mancante in una
`select` o un `?.` da aggiungere: mandameli e li sistemo in blocco.

### 1.5 Verifica a schermo (il punto che conta davvero)

```powershell
pnpm dev
```

> I messaggi next-intl sono import statici: dopo aver toccato i JSON delle
> traduzioni il dev server va riavviato, altrimenti il pulsante mostra ancora
> l'etichetta vecchia.

Da controllare uno per uno, perché è il requisito esplicito di questo lavoro:

| Dove | Cosa deve succedere |
|---|---|
| Lista atleti | Nomi veri, ordinati per cognome |
| Ricerca atleti | Digitando metà cognome l'atleta compare |
| Scheda atleta | Nome, avatar, data di nascita |
| Nuovo atleta / modifica | Salva e rilegge il nome corretto |
| Wellness, Infortuni, Analisi | Nomi veri nelle tabelle |
| Foglio presenze, Referto partita | Nomi veri, ordinati per cognome |
| PDF/DOCX report giornaliero | Nomi veri |
| App atleta (`trainmind-athlete`) | L'atleta vede il proprio nome nel profilo |
| Console admin → Contatti | I contatti marketing (staff) ci sono ancora |
| Coach AI / Wellness insights | La risposta contiene i nomi veri |
| Scheda atleta → **Assistente AI** | La chat si apre col nome dell'atleta nel chip in alto e risponde sui SUOI dati |

### 1.6 Build (facoltativa)

```powershell
pnpm build
```

`EPERM: operation not permitted, symlink` su `@trainmind/web` e
`@trainmind/admin` è **normale** su Windows: contano `✓ Compiled successfully` e
`✓ Checking validity of types`. Dopo un tentativo fallito, `apps\*\.next`
contiene uno standalone monco — va escluso dal tar.

---

## Parte 2 — Sul VPS (bash)

```bash
cd /opt/trainmind/trainmind-app
alias dc='docker compose -f docker-compose.deploy.yml --env-file .env.deploy'
```

### 2.1 Backup — non saltarlo

```bash
dc exec -T postgres pg_dump -U trainmind -d trainmind_db > ~/backup-pre-identity-$(date +%Y%m%d-%H%M).sql
ls -lh ~/backup-pre-identity-*.sql
```

### 2.2 Stato di partenza

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -c \
  "SELECT count(*) AS atleti FROM athletes; SELECT count(*) AS utenti FROM users;"
ls -d packages/db/prisma/migrations/*/ | wc -l
```

Annotare i due conteggi: vanno confrontati dopo.

### 2.3 Trasferire il codice

**Il problema non erano i `node_modules`.** L'archivio usciva da 4,1 GB per un
motivo solo: `apps/ai-service/models/trainmind-mistral-7b-Q4_K_M.gguf` pesa
**4,1 GB** da solo, piu' 81 MB di `trainmind-lora.gguf` e 7 MB di
`chroma_data/`. Tutto il resto del monorepo, sorgenti compresi, sta in **3,7
MB**. I `node_modules` non c'entravano: `robocopy` li aveva gia' esclusi
correttamente fin dal primo tentativo. Da notare che anche `update-app.tar.gz`
del 14 settembre pesa 4,36 GB: i deploy precedenti hanno spedito il modello
ogni volta.

I `.gguf` **non vanno nell'archivio**: il modello locale sul VPS non si
ricostruisce a ogni release, e comunque l'ai-service in produzione non lo usa.

Due passaggi. Prima la copia pulita con `robocopy` (le sue esclusioni per nome
di cartella funzionano; quelle di `tar` su Windows — che e' **bsdtar** — no):

```powershell
$progetto = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app"
$stage    = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\_deploy_stage"

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

robocopy $progetto $stage /E /NP `
  /XD node_modules .next .turbo dist test-results playwright-report report-tests .auth _to_delete _i18n_tmp models chroma_data `
  /XF *.bak-* backup_pre_*.sql utenti.sql q.sql build.log type-errors.txt fase2.tar.gz *.gguf

# robocopy esce con un codice diverso da 0 anche quando va tutto bene: da 0 a 7
# significa successo. Solo da 8 in su e' un errore. Non usare /NJH /NJS, altrimenti
# il riepilogo non si vede e non si puo' verificare cosa e' stato copiato davvero.
```

Poi l'archivio. `tar` di Windows va bene **solo** perche' a questo punto la
cartella e' gia' pulita e non serve nessuna esclusione:

```powershell
$stage    = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\_deploy_stage"
$archivio = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-identity.tar.gz"

# I .env di sviluppo non devono partire: sovrascriverebbero quelli di produzione.
Remove-Item "$stage\.env","$stage\.env.local","$stage\apps\ai-service\.env","$stage\packages\db\.env" -Force -ErrorAction SilentlyContinue

Remove-Item $archivio -Force -ErrorAction SilentlyContinue
cd $stage; tar -czf $archivio .; cd $progetto

# Controllo obbligatorio prima di spedire: deve stare sui pochi MB, non sui GB.
Get-Item $archivio | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,2)}}
```

Valori attesi per questa release: **3,7 MB**, **771 file**,
sha256 `4e3c5eba4bc854043182f64cb08305b83adfb0af0c7fca7e686c74decb479495`.

Spedizione:

```powershell
scp $archivio root@<IP_VPS>:/opt/trainmind/trainmind-identity.tar.gz
Remove-Item $stage -Recurse -Force
```

> Verificare che `packages/db/prisma/migrations/` sia finita nella copia: e' in
> `.gitignore`, ma `robocopy` copia dal disco e non guarda git, quindi c'e'.
> Devono esserci 48 cartelle piu' `migration_lock.toml`. Il controllo vero e'
> comunque sul server, al punto 2.4.

> Le esclusioni dei file non sono cosmetiche: nella radice del progetto ci
> sono quattro dump `.sql` con nomi, email e date di nascita **in chiaro**
> (`backup_pre_*.sql`, `utenti.sql`). Senza escluderli, il lavoro di questa
> release li spedirebbe sul VPS insieme al codice. `*.bak-*` toglie 35
> copie di lavorazione che non servono a nessuno. Attenzione a non escludere
> `*.sql` in blocco: le migration sono file `.sql`.
>
> Esclusi anche gli artefatti della suite e2e: `.auth/user.json` contiene token
> di accesso validi, e `test-results/` e `playwright-report/` raccolgono
> screenshot dell'applicazione — cioe' nomi di atleti veri — a ogni fallimento.
>
> Esclusi infine i quattro `.env` di sviluppo (`.env`, `.env.local`,
> `apps/ai-service/.env`, `packages/db/.env`). Restano nell'archivio solo i
> `.env.example` e i `.env.staging`, che non contengono credenziali di
> produzione.

Sul VPS:

```bash
cd /opt/trainmind/trainmind-app
tar -xzf ../trainmind-identity.tar.gz
ls -d packages/db/prisma/migrations/20260920090000_identity_vault/
```

`packages/db/prisma/migrations/` è in `.gitignore`: con `scp`/`tar` arriva, con
`git pull` no.

### 2.4 Ricostruire le immagini — `migrate` compreso

Il servizio `migrate` legge le migration **dall'immagine**, non dal disco: se
non lo si ricostruisce, `prisma migrate` non vede la cartella nuova.

```bash
dc build api web athlete admin ai-service migrate
dc --profile tools run --rm --entrypoint sh migrate -c 'ls /app/packages/db/prisma/migrations | tail -5'
```

L'ultima riga deve contenere `20260920090000_identity_vault`.

### 2.5 Applicare la migration

Su questo database `_prisma_migrations` non copre lo schema di base: si applica
a mano e poi si registra.

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -v ON_ERROR_STOP=1 \
  < packages/db/prisma/migrations/20260920090000_identity_vault/migration.sql
```

Atteso: nessun `ERROR`, nessun `STOP:`. Poi la registrazione:

```bash
dc --profile tools run --rm --entrypoint sh migrate \
  -c 'cd packages/db && npx prisma migrate resolve --applied 20260920090000_identity_vault'
```

### 2.6 Verificare i dati PRIMA di far ripartire le app

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -c "
  SELECT (SELECT count(*) FROM athletes)           AS atleti,
         (SELECT count(*) FROM athlete_identities) AS anagrafiche_atleti,
         (SELECT count(*) FROM users)              AS utenti,
         (SELECT count(*) FROM user_identities)    AS anagrafiche_utenti;"
```

`atleti` = `anagrafiche_atleti` e `utenti` = `anagrafiche_utenti`, e i due
conteggi devono coincidere con quelli del punto 2.2. Se non tornano: **fermarsi**
e applicare il rollback (§3).

Le colonne devono essere sparite da `athletes` e comparso `birthYear`:

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -c '\d athletes'
```

### 2.7 Il permesso che rende utile tutto il lavoro

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -c "
  SELECT has_table_privilege('trainmind_reporting','athlete_identities','SELECT') AS vede_atleti,
         has_table_privilege('trainmind_reporting','user_identities','SELECT')    AS vede_staff;"
```

Atteso: `vede_atleti = f`, `vede_staff = t`. Se `vede_atleti` è `t`, la
`ALTER DEFAULT PRIVILEGES` di `reporting-role.sql` ha vinto: ripetere la revoca.

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -c \
  'REVOKE ALL ON athlete_identities FROM trainmind_reporting;'
```

### 2.8 Riavviare

```bash
dc up -d api web athlete admin ai-service
dc ps
dc logs --tail=50 api | grep -i error
```

### 2.9 Verifica finale in produzione

1. Login sulla web app → la lista atleti mostra i nomi veri, ordinati per cognome.
2. Ricerca per cognome → trova.
3. Scheda atleta → nome, foto, data di nascita.
4. App atleta → il proprio nome nel profilo.
5. Console admin → **Contatti** popolato, e nessun nome di atleta da nessuna parte.
6. Coach AI su un atleta → la risposta nomina l'atleta con il nome vero.

Controllo che nessun nome parta più verso il fornitore del modello:

```bash
dc logs --tail=200 ai-service | grep -iE "nome:|firstName" || echo "nessun nome nei prompt"
```

---

## Parte 3 — Rollback

Serve **sia** il database **sia** le immagini precedenti: uno solo dei due non
basta.

```bash
cd /opt/trainmind/trainmind-app
docker cp packages/db/prisma/manutenzione/rollback-identity-vault.sql trainmind-postgres:/tmp/rb.sql
dc exec -T postgres psql -U trainmind -d trainmind_db -v ON_ERROR_STOP=1 -f /tmp/rb.sql
dc exec -T postgres psql -U trainmind -d trainmind_db -c \
  "DELETE FROM _prisma_migrations WHERE migration_name = '20260920090000_identity_vault';"
```

Poi ripristinare le immagini precedenti e riavviare. Le tabelle caveau restano
in piedi: si cancellano a mano solo dopo aver verificato che tutto gira.

Se il rollback non basta, resta il `pg_dump` del punto 2.1:

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db < ~/backup-pre-identity-<data>.sql
```

---

## Dopo il deploy

- I dump `backup_pre_*.sql` e `utenti.sql` nella radice del progetto contengono
  ancora nomi in chiaro nel vecchio formato: vanno spostati fuori dal progetto e
  cifrati, altrimenti questo lavoro protegge il database e non la workstation.
- Passo successivo naturale: cifratura AES-GCM delle cinque colonne di
  `athlete_identities`. Ora è un intervento su una tabella sola con un solo
  punto di lettura — prima erano quindici query e una ricerca.

---

## Appendice — Backup cifrati (fatto il 21/09/2026)

I dump di Postgres contengono nomi, email e date di nascita in chiaro: sono
esattamente cio' che la separazione delle identita' protegge dentro il
database, e che uscirebbe intatto da un backup lasciato in chiaro.

**La trappola da conoscere.** Con `--pinentry-mode loopback` gpg chiede la
passphrase **una volta sola e senza conferma**: un errore di battitura in fase
di creazione produce un file che nessuno potra' mai aprire, e lo si scopre solo
al primo tentativo di ripristino. Il `loopback` pero' serve, perche' senza gpg
non riesce a chiedere la passphrase quando sta in fondo a una pipe
(`Inappropriate ioctl for device`). La soluzione e' digitarla una volta sola e
usare la stessa stringa per cifrare e per verificare:

```bash
cd /opt/trainmind/trainmind-app
export GPG_TTY=$(tty)           # utile metterlo in ~/.bashrc
umask 077
read -rsp 'Passphrase: ' PP; echo
printf '%s' "$PP" > /dev/shm/pp   # /dev/shm e' in RAM: non tocca il disco
unset PP

dc exec -T postgres pg_dump -U trainmind trainmind_db -Fc \
  | gpg --symmetric --cipher-algo AES256 --batch --pinentry-mode loopback \
        --passphrase-file /dev/shm/pp -o ~/backup_$(date +%Y%m%d_%H%M).dump.gpg

# Verifica SEMPRE nella stessa sessione: pg_restore -l legge l'indice
# dell'archivio, quindi conferma l'integrita', non solo i primi byte.
gpg --decrypt --batch --pinentry-mode loopback --passphrase-file /dev/shm/pp \
      ~/backup_$(date +%Y%m%d)_*.dump.gpg | dc exec -T postgres pg_restore -l | head -5

shred -u /dev/shm/pp
```

`gpg: error writing to '-': Broken pipe` alla fine della verifica e' normale:
lo produce `head -5` che chiude la pipe dopo cinque righe.

Il dump in chiaro non deve mai finire su disco. Se per qualche motivo ci
finisce, si cancella con `shred -u`, non con `rm`.

**Automazione in cron:** servirebbe `--passphrase-file` su un file permanente
`chmod 400`. A quel punto pero' la passphrase vive sulla stessa macchina del
database, e il backup cifrato protegge solo chi se lo porta via, non chi entra
nel server. E' lo stesso problema della chiave di cifratura delle colonne: va
deciso una volta sola per entrambi.
