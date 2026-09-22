# Deploy — Cifratura anagrafiche, Fase 1

**Data prevista:** 22/09/2026
**Contenuto:** il codice che sa leggere sia il chiaro sia il cifrato, e che
scrive sempre cifrato. **Nessuna migration SQL.** Nessun dato esistente viene
toccato in questa fase.

Dopo questo deploy il database contiene entrambe le forme: le 73 anagrafiche
di oggi restano in chiaro, tutto cio' che viene creato o modificato da adesso
nasce `v1:`. E' questa convivenza a rendere la Fase 1 reversibile — finche'
nessuno scrive. Vedi la Parte 4.

Riferimenti: `PIANO_CIFRATURA_VAULT.md` (§5 la chiave, §6 le fasi, §7 cosa si
rompe), `DEPLOY_SEPARAZIONE_IDENTITA.md` (la procedura di trasferimento, che
qui si ripete quasi identica).

---

## Parte 0 — Prima di toccare qualsiasi cosa

### 0.1 La chiave deve gia' essere sul VPS

Questo e' il controllo che decide se il deploy si puo' fare. Se il file non
c'e', **l'API non riparte** e il servizio resta giu' finche' non lo si mette.

```bash
ls -l /opt/trainmind/secrets/identity.key
wc -c < /opt/trainmind/secrets/identity.key      # deve dire 44
base64 -d /opt/trainmind/secrets/identity.key | wc -c   # deve dire 32
base64 -d /opt/trainmind/secrets/identity.key | sha256sum | cut -c1-16
```

Attesi: `-r-------- 1 root root 44`, poi `44`, `32`, e un'impronta di 16
caratteri esadecimali. **Quell'impronta e' la stessa che l'API stampera' nei
log all'avvio**, ed e' quella annotata accanto alle due copie della chiave.
Se non coincide, fermarsi: significa che sul server c'e' una chiave diversa da
quella custodita, e cifrare con una chiave di cui non si ha copia e' il modo
piu' diretto per perdere i dati.

### 0.2 La trappola del montaggio

`docker-compose.deploy.yml` monta quel file nel container. **Se il percorso sul
VPS non esiste, Docker non protesta: crea una cartella vuota e monta quella.**
L'API trova una directory dove si aspetta una chiave, non parte, e nel
frattempo al posto del file c'e' una cartella. Da qui l'ossessione del punto
0.1: si verifica il file *prima*, non dopo.

---

## Parte 1 — In locale (PowerShell)

### 1.1 Controlli

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm type-check
pnpm test
git status --short      # deve essere pulito: si spedisce cio' che e' committato
```

### 1.2 Preparare l'archivio

Identico alla release precedente, con **una esclusione in piu'**:
`.dev-identity.key`, la chiave di sviluppo. Non deve finire sul VPS. Non e' la
chiave di produzione e non verrebbe usata da nessuno, ma una chiave di
cifratura spedita su un server dove non serve e' esattamente il tipo di file
che fra un anno qualcuno trova e non sa piu' cos'e'.

```powershell
$progetto = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app"
$stage    = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\_deploy_stage"

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

robocopy $progetto $stage /E /NP `
  /XD node_modules .next .turbo dist test-results playwright-report report-tests .auth _to_delete _i18n_tmp models chroma_data `
  /XF *.bak-* backup_pre_*.sql utenti.sql q.sql build.log type-errors.txt fase2.tar.gz *.gguf .dev-identity.key

# robocopy: da 0 a 7 e' successo. Solo da 8 in su e' un errore.
```

```powershell
$archivio = "C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-cifratura-f1.tar.gz"

# I .env di sviluppo non devono partire: sovrascriverebbero quelli di produzione.
Remove-Item "$stage\.env","$stage\.env.local","$stage\apps\ai-service\.env","$stage\packages\db\.env" -Force -ErrorAction SilentlyContinue

# Controllo esplicito: la chiave di sviluppo non deve essere nello stage.
Get-ChildItem $stage -Recurse -Force -Filter "*.key" | Select-Object FullName
# Non deve stampare niente.

Remove-Item $archivio -Force -ErrorAction SilentlyContinue
cd $stage; tar -czf $archivio .; cd $progetto

Get-Item $archivio | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,2)}}
```

Attesi pochi MB, non GB. Se l'archivio e' grande, qualcosa non e' stato escluso.

```powershell
scp $archivio root@31.70.77.212:/opt/trainmind/trainmind-cifratura-f1.tar.gz
Remove-Item $stage -Recurse -Force
```

---

## Parte 2 — Sul VPS (bash)

```bash
cd /opt/trainmind/trainmind-app
alias dc='docker compose -f docker-compose.deploy.yml --env-file .env.deploy'
```

### 2.1 Backup — non saltarlo

Il backup notturno esce gia' cifrato (`BACKUP_E_DATI_RISERVATI.md`). Qui ne
serve uno a mano, adesso, con la stessa protezione:

```bash
/opt/trainmind/backup.sh
ls -lh /opt/trainmind/backups/ | tail -3
```

Deve comparire un `.dump.gpg` di oggi, e lo script deve dire `verificato`.

### 2.2 Stato di partenza

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -c \
  "SELECT count(*) AS anagrafiche, count(*) FILTER (WHERE \"lastName\" LIKE 'v1:%') AS cifrate FROM athlete_identities;"
```

Attesi: `73` e `0`. Annotare: il primo numero non deve cambiare mai.

### 2.3 Trasferire il codice

```bash
cd /opt/trainmind/trainmind-app
tar -xzf ../trainmind-cifratura-f1.tar.gz
grep -n "IDENTITY_KEY_FILE" docker-compose.deploy.yml
```

Le ultime due righe devono mostrare la variabile nei servizi `api` e `migrate`.
Se non compaiono, l'archivio e' vecchio: rifare la Parte 1.

### 2.4 Ricostruire

Nessuna migration in questa fase, ma le immagini vanno rifatte perche' il
codice del client Prisma e' cambiato:

```bash
dc build api migrate
```

### 2.5 Riavviare l'API — e guardare il log subito

```bash
dc up -d api
sleep 5
dc logs --tail=30 api | grep -i "cifratura\|error"
```

**Deve comparire:**

```
[db] cifratura anagrafiche ATTIVA — impronta chiave <16 caratteri>
```

e l'impronta deve essere quella verificata al punto 0.1.

Se invece l'API non parte, il log dira' perche':
- `IDENTITY_KEY_FILE non impostata in produzione` → il compose e' quello vecchio;
- `EISDIR` o errore di lettura → e' scattata la trappola 0.2, sul VPS c'e' una
  cartella al posto del file;
- `chiave di lunghezza errata` → il file non contiene 44 caratteri base64 puliti.

In tutti e tre i casi: **il database non e' stato toccato.** Si corregge e si
riprova.

### 2.6 Le altre app

Web, athlete, admin e ai-service non hanno la chiave e non ne hanno bisogno:
parlano con l'API. Vanno comunque ricostruite solo se il loro codice e'
cambiato. In questa release non lo e':

```bash
dc ps
```

Tutti `running`, `api` `healthy`.

---

## Parte 3 — Verifica in produzione

Nell'ordine, sull'applicazione vera:

1. Login sulla web app. La lista atleti mostra i **nomi veri**, in ordine
   alfabetico.
2. Ricerca per mezzo cognome: trova.
3. Apri una scheda atleta: nome, foto, data di nascita.
4. **Apri una scheda squadra**: la rosa dev'essere in ordine alfabetico. E' il
   punto corretto all'ultimo momento (`PIANO_CIFRATURA_VAULT.md` §7.1).
5. Apri un foglio presenze e un tracking partita: stesso ordine.
6. **Crea un atleta di prova.** E' la prima scrittura cifrata in produzione.
7. Rileggilo: nome giusto a schermo.
8. Nel database, dove si vede la verita':

```bash
dc exec -T postgres psql -U trainmind -d trainmind_db -c \
  "SELECT count(*) AS totale, count(*) FILTER (WHERE \"lastName\" LIKE 'v1:%') AS cifrate FROM athlete_identities;"
```

Atteso: `74` e `1`. Il totale e' salito di uno (l'atleta di prova), le cifrate
sono passate da 0 a 1. Le 73 righe vecchie sono intatte e in chiaro.

9. App atleta: un atleta vede il proprio nome.
10. Console admin: **Contatti** popolato (staff, non cifrato), e nessun nome di
    atleta da nessuna parte.
11. Coach AI su un atleta: la risposta lo chiama con il nome vero, e nel log
    dell'API compare `riassunto AI richiesto con nomi sostituiti`.

Poi cancellare l'atleta di prova.

---

## Parte 4 — Rollback

**Finche' nessuno ha scritto**, il rollback e' pulito: si torna al codice
precedente e si toglie il montaggio dal compose. Nessuna riga e' cifrata,
nessun dato e' stato toccato.

```bash
cd /opt/trainmind/trainmind-app
git checkout HEAD~1 -- docker-compose.deploy.yml   # oppure rimettere l'archivio precedente
dc build api && dc up -d api
```

**Dopo la prima scrittura non e' piu' cosi'.** Ogni atleta creato o modificato
da questo momento e' cifrato: tornando al codice vecchio, il suo nome
comparirebbe a schermo come `v1:8fA2…`. In quel caso il rollback richiede
prima lo script inverso che decifra e riscrive in chiaro (`PIANO_CIFRATURA_VAULT.md` §8),
che ha bisogno della chiave.

Per questo la finestra utile per un ripensamento a costo zero e' quella fra il
punto 2.5 e il punto 6 della Parte 3.

---

## Cosa resta dopo

- **Fase 2**: travaso delle 73 righe ancora in chiaro, da lanciare dal servizio
  `migrate` (che ora ha la chiave montata apposta).
- **Fase 3**: verifica che le righe non cifrate siano zero.
- **Fase 4**: `dateOfBirth`, l'unica migration SQL vera, per ultima.
- **Fase 10**: Registro art. 30 e DPIA, dove «cifratura a riposo a livello di
  colonna: pianificata» diventa attiva.
