# Cifratura delle anagrafiche atleti — piano

> Stato: **proposta**, non eseguita. Scritto il 22/09/2026.
> Prerequisito: la separazione delle identità (`PIANO_SEPARAZIONE_IDENTITA.md`),
> in produzione dal 21/09/2026.

---

## 1. Cosa protegge, e cosa no

Oggi `athlete_identities` contiene nome, cognome, data di nascita, email e foto
di 73 atleti **in chiaro**. Chi ha le credenziali principali del database, o
root sul VPS, li legge.

Cifrare quelle cinque colonne con una chiave che vive **solo nell'API** sposta
una linea precisa:

| Chi | Oggi | Dopo |
| --- | --- | --- |
| Ruolo `trainmind_reporting` | non vede le anagrafiche | invariato |
| Fornitori di modelli IA | non ricevono nomi | invariato |
| Chi ottiene le credenziali del database | legge tutto | legge stringhe illeggibili |
| Chi ruba un backup o uno snapshot del disco | legge tutto | legge stringhe illeggibili |
| SQL injection che sfugga a Prisma | legge tutto | legge stringhe illeggibili |
| Chi amministra il DB senza amministrare l'app | legge tutto | legge stringhe illeggibili |
| **Chi ottiene root sul VPS** | legge tutto | **legge tutto** |
| Chi compromette il processo API | legge tutto | legge tutto |

L'ultima riga non è aggirabile su una macchina sola: l'API deve poter decifrare
per mostrare i nomi, quindi la chiave le è raggiungibile, quindi è raggiungibile
da chi diventa quel processo. Chi promette altro, su questa architettura, sta
vendendo qualcosa.

Il guadagno vero è sui **dati che escono dalla macchina**. Ed è un guadagno
reale: i backup oggi sono cifrati con GPG, ma il giorno in cui un dump finisce
per sbaglio in chiaro da qualche parte — è già successo una volta, i dump sul
portatile — la cifratura a livello di colonna è l'ultima rete.

---

## 2. Decisioni prese

| Decisione | Scelta | Perché |
| --- | --- | --- |
| Dove vive la chiave | File sull'host, `chmod 400` root, montato read-only **solo** nel container `api` | Nessuna dipendenza esterna che possa impedire l'avvio. Non compare in `docker inspect`, nei log di crash o nei dump di ambiente, a differenza di una variabile in `.env.deploy` |
| Ricerca e ordinamento | Decifratura in memoria, per singola organizzazione | Le query sono già limitate a una società, e una società ha decine di atleti. La ricerca per mezzo cognome resta identica a oggi |
| Cosa si cifra | Le 5 colonne di `athlete_identities` | — |
| Cosa **non** si cifra | `user_identities` (nome e cognome dello staff) | Il ruolo di reportistica ha accesso a quella tabella per costruire i Contatti della console admin: cifrarla romperebbe una funzionalità legittima. Sono dati di contatto professionale, non collegati a dati sanitari |
| Cosa **non** si cifra | `birthYear` su `athletes` | Serve in chiaro al contesto IA e ai calcoli. Conseguenza da accettare: l'anno di nascita resta leggibile, la cifratura di `dateOfBirth` protegge giorno e mese |
| Cosa **non** si cifra | `users.email` | È la credenziale di accesso: deve essere cercabile in SQL al login |

---

## 3. Il punto che decide la forma del lavoro

**Ti ho detto due volte che la cifratura ora tocca «un solo punto di lettura».
Era sbagliato, e va corretto prima di pianificare sopra un dato falso.**

Le scritture sull'anagrafica sono effettivamente poche — sei, contate:
`athletes.ts` (update), `auth.ts` (registrazione), `staff.ts` (invito),
`gdpr.ts` (cancellazione, due punti), più le seed.

Ma **le letture sono 134**, distribuite su 26 file: rotte, servizi che
costruiscono PDF e DOCX, il generatore di report, il worker delle
schedulazioni, il costruttore del contesto IA. `flattenIdentities` copre solo
le risposte HTTP — lo dice il commento del file stesso: «chi costruisce un PDF,
un DOCX o un'email lavora sull'oggetto Prisma prima che passi di qui».

Toccare 134 punti a mano è il modo sicuro di dimenticarne tre e scoprirlo
quando un preparatore vede `v1:8fA2…` al posto di un cognome dentro un PDF
mandato a una società.

**Quindi l'intercettazione va nel client Prisma**, non ai punti di chiamata.
`packages/db/src/index.ts` esporta una sola istanza, importata da API, seed e
worker: è lì che si aggancia un'estensione che cifra in scrittura e decifra in
lettura. Chiunque usi `prisma.athlete.findMany({ include: { identity: true } })`
continua a ricevere nomi leggibili senza sapere che esiste una cifratura.

### 3.1 Lo spike da fare per primo — mezz'ora, prima di ogni altra cosa

Le estensioni `query` di Prisma **non scattano sui modelli annidati**: un
`include: { identity: true }` partito da `athlete` non passa dal gancio di
`athleteIdentity`. E l'`include` annidato è esattamente la forma dominante in
tutte e 134 le letture.

Le estensioni `result` dovrebbero invece applicarsi ovunque il modello compaia,
annidamenti inclusi — ma «dovrebbe» non basta per una decisione di questa
portata, e la versione in uso è Prisma 5.18.

**Verifica sperimentale, su database di sviluppo, prima di scrivere il piano
esecutivo:**

1. Estensione `result` su `AthleteIdentity` che trasforma `firstName` in
   maiuscolo (finta cifratura, così si vede a occhio).
2. Provare le quattro forme reali: `findMany` diretta;
   `athlete.findMany({ include: { identity: true } })`;
   `athlete.findMany({ select: { identity: { select: { lastName: true } } } })`;
   una relazione a due livelli come `injury.findMany({ include: { athlete: { include: { identity: true } } } })`.
3. Tutte e quattro devono restituire il valore trasformato.

- **Se passano tutte** → si procede come scritto qui sotto.
- **Se una fallisce** → l'estensione non basta, e il lavoro cambia natura: serve
  un audit dei 134 punti con un helper esplicito. Costo molto più alto, rischio
  di dimenticanze reale. A quel punto va rimessa in discussione l'opportunità
  dell'intera operazione, non solo il come.

Questo spike non si salta. È l'unica cosa che distingue un lavoro di due giorni
da uno di due settimane con code di bug.

---

## 4. Formato del dato cifrato

```
v1:<base64( nonce(12 byte) || ciphertext || tag(16 byte) )>
```

- **AES-256-GCM**, nonce casuale per ogni scrittura.
- **AAD = `athleteId`**: lega il testo cifrato alla sua riga. Un ciphertext
  spostato da un atleta a un altro non si decifra. Senza AAD, chi ha accesso in
  scrittura al database potrebbe scambiare due anagrafiche senza conoscere la
  chiave.
- **Il prefisso `v1:` è la parte furba.** Un valore senza prefisso è testo in
  chiaro non ancora migrato: la funzione di lettura lo restituisce com'è. Questo
  rende la fase di doppia lettura gratuita e senza colonne di servizio, e rende
  la rotazione futura (`v2:`) un'operazione di manutenzione invece che una
  migration.

Tipi di colonna: `firstName`, `lastName`, `email`, `photoUrl` sono già `text`.
**`dateOfBirth` è `timestamp` e deve diventare `text`** — con la conseguenza,
da mettere in conto, che ogni punto che oggi la tratta come `Date` va adeguato
(nello schema Prisma passa da `DateTime` a `String`).

---

## 5. La chiave

### Generazione e installazione

```bash
# sul VPS, una volta sola
umask 077
openssl rand -base64 32 > /opt/trainmind/secrets/identity.key
chmod 400 /opt/trainmind/secrets/identity.key
chown root:root /opt/trainmind/secrets/identity.key
```

Montaggio nel solo servizio `api`, in `docker-compose.deploy.yml`:

```yaml
  api:
    volumes:
      - /opt/trainmind/secrets/identity.key:/run/secrets/identity.key:ro
    environment:
      IDENTITY_KEY_FILE: /run/secrets/identity.key
```

L'API legge il file all'avvio e **rifiuta di partire se manca o è malformato**.
Un avvio silenzioso senza chiave produrrebbe scritture in chiaro dentro un
database che si crede cifrato: è il peggiore degli esiti, perché non si vede.

### Custodia — il rischio maggiore di tutta l'operazione

Perdere la chiave significa perdere 73 anagrafiche **in modo definitivo**. Non
c'è recupero, non c'è supporto da chiamare, e i backup del database non servono
a niente perché contengono lo stesso testo cifrato.

È più probabile che tu perda la chiave di quanto sia probabile che qualcuno ti
rubi un backup. Quindi, prima di cifrare la prima riga:

1. Copia della chiave in un password manager, **con una seconda copia fuori da
   quel password manager** (busta sigillata, altro dispositivo, quello che
   preferisci — ma non lo stesso portatile dove gira tutto).
2. **Prova di ripristino**: cancella la chiave dal VPS, rimettila dalla copia,
   riavvia l'API, verifica che i nomi tornino. Fatta *prima* che ci siano dati
   che dipendono da lei, questa prova costa niente. Fatta dopo, non la fai più.
3. Annotare in `TODO_Legale_Operativo.docx` dove si trovano le due copie — non
   la chiave, il *dove*.

### 5.1 In quali casi la chiave si perde davvero

Non in astratto: questi sono gli scenari concreti su questa infrastruttura,
ordinati per probabilita' reale, non per gravita'.

**1. Il server viene rifatto.** Migrazione a un altro VPS, reinstallazione
IONOS, cambio provider, o semplicemente una ricostruzione da zero dopo un
guasto. Il codice torna da git, il database torna da un dump: **la chiave non
sta in nessuno dei due**, per costruzione. E' il caso piu' probabile di tutti,
ed e' insidioso proprio perche' tutto il resto si ripristina bene e il problema
si manifesta solo quando qualcuno apre la lista atleti.

**2. La macchina muore e le copie erano sopra di lei.** Vedi §5.4: oggi i
backup del database stanno sullo stesso VPS del database.

**3. Cancellazione accidentale.** Un `rm` di troppo in
`/opt/trainmind/secrets/`, un `docker compose down -v`, uno script di pulizia,
un `chown` che rende il file illeggibile al container.

**4. Rotazione fatta male.** Chiave nuova installata, chiave vecchia buttata
prima che tutte le righe fossero ri-cifrate. Restano righe `v1:` senza piu' la
chiave `v1`.

**5. La copia esiste ma non funziona.** E' il caso piu' frequente in assoluto
nel mondo reale, e ne abbiamo avuto un esempio ieri con la passphrase GPG
digitata male in `loopback`: il file c'era, sembrava a posto, non si apriva.
Per una chiave in base64 le forme sono: un carattere sbagliato nella
trascrizione, il file troncato, **un a capo finale presente o assente**
(`openssl rand -base64 32 > file` lascia un `\n`: se il codice legge il file
grezzo invece di ripulirlo, una copia incollata senza a capo produce una chiave
diversa), la codifica del file cambiata da un editor.

**6. La copia funziona ma nessuno ci arriva.** Password manager legato a un
account che hai solo tu, e tu non sei raggiungibile. Per una societa' di una
persona non e' un dettaglio teorico.

**7. Perdita silenziosa.** L'API parte senza chiave e scrive in chiaro dentro
un database che si crede cifrato; oppure parte con la chiave sbagliata e scrive
testo cifrato che non si rilegge. In entrambi i casi non c'e' nessun errore, e
te ne accorgi settimane dopo. E' il peggiore perche' e' invisibile, ed e' anche
il piu' facile da rendere impossibile: vedi §5.3.

### 5.2 Come si fa la copia

La chiave e' una stringa base64 di 44 caratteri. E' corta abbastanza da poter
essere trascritta a mano su carta, e questo e' un vantaggio da sfruttare.

**Impronta di verifica.** Insieme alla chiave si annota la sua impronta, che
permette di controllare una copia senza rivelarla e senza doverla confrontare
carattere per carattere:

```bash
# l'impronta, non la chiave: si puo' scrivere anche dove la chiave non andrebbe
tr -d '\n' < /opt/trainmind/secrets/identity.key | sha256sum | cut -c1-16
```

Le prime 16 cifre esadecimali bastano: due chiavi diverse non ci arrivano
uguali. Questa impronta va annotata accanto a ogni copia, e l'API la stampa
nel log all'avvio (l'impronta, mai la chiave) — cosi' in qualunque momento si
puo' verificare che la chiave in uso sia quella attesa.

**Tre copie, in tre posti che non muoiono insieme.**

| Copia | Dove | Come |
| --- | --- | --- |
| Operativa | `/opt/trainmind/secrets/identity.key` sul VPS | `chmod 400`, root, montata read-only nel solo container `api` |
| Recupero | Password manager, voce dedicata | Il valore base64, l'impronta, la data di creazione, e una nota: "perdere questa chiave rende illeggibili le anagrafiche atleti di TrainMind" |
| Offline | Foglio in busta chiusa, fuori casa o in cassetta di sicurezza | Chiave trascritta a mano, impronta, data. Carta e penna: non si corrompe, non scade, non dipende da un account |

Il punto non e' il numero tre, e' che **le tre copie non devono poter sparire
per la stessa causa**. Chiave sul VPS piu' copia in un file sullo stesso VPS
sono una copia sola. Password manager piu' export del password manager sullo
stesso portatile sono quasi una copia sola.

**La tensione da governare, e come si risolve.** La copia della chiave serve a
non perdere i dati; tenerla vicino ai backup cifrati serve a perderli entrambi
insieme in caso di furto, annullando la cifratura. Quindi: **copie della chiave
e backup del database in posti diversi**, entrambi fuori dal VPS. Chi ruba il
backup non trova la chiave; chi perde il server ha entrambi altrove.

**Per il caso 6 (bus factor).** Una quarta copia sigillata, presso una persona
di fiducia o un professionista, con istruzioni su cosa e' e chi chiamare. Non e'
paranoia: e' l'unica cosa che distingue "i dati sono recuperabili" da "i dati
sono recuperabili da me".

### 5.3 Rendere impossibili gli scenari 5 e 7

Tre accorgimenti, tutti da costruire *prima* di cifrare la prima riga.

**Lettura normalizzata.** Il modulo di cifratura legge il file, toglie spazi e
a capo, decodifica il base64 e **pretende esattamente 32 byte**. Qualunque
altra cosa: errore e arresto. Questo neutralizza l'a capo finale e i file
troncati.

**Avvio con canarino.** Nel database si tiene una riga di prova con un valore
noto cifrato. All'avvio l'API la decifra e confronta: se non corrisponde, **non
parte** e scrive nel log l'impronta della chiave che ha trovato e quella che si
aspettava. Chiave assente, chiave sbagliata, chiave corrotta diventano tutte un
guasto rumoroso e immediato invece di una corruzione silenziosa.

**Verifica periodica.** Un controllo mensile che decifra una riga vera e
avvisa se fallisce, piu' un promemoria annuale per ricontrollare che le copie
offline esistano ancora e abbiano l'impronta giusta. Una copia mai verificata
non e' una copia, e' una speranza.

**La prova di ripristino, una volta, prima di tutto.** Sul VPS: rinominare la
chiave, riavviare l'API, verificare che *non parta* (canarino), rimetterla
dalla copia del password manager — non da quella sul server — riavviare,
verificare che i nomi tornino. Fatta quando le righe cifrate sono zero, questa
prova non rischia niente. Fatta dopo, non la fai piu'.

### 5.4 Il buco che esiste gia' oggi, e che viene prima di tutto questo

Ieri abbiamo cifrato i backup del database. Ma stanno **in `/root/` sullo
stesso VPS del database che proteggono**. Se IONOS perde quella macchina, o il
disco si guasta, o l'account viene sospeso, spariscono insieme produzione e
backup — e questo vale **oggi, senza cifratura delle colonne**.

Questo e' un rischio di perdita dati piu' grande di quello della chiave, e va
chiuso prima: i backup vanno copiati fuori dal VPS, automaticamente e con
verifica. Finche' non e' fatto, aggiungere la cifratura delle colonne aumenta
il numero di cose che devono andare bene senza aver ridotto quelle che possono
andare male.

### Rotazione

Non serve una colonna `key_version`: il prefisso basta. Si tiene la vecchia
chiave in lettura, si scrive con la nuova (`v2:`), si ri-cifrano le righe in
background, si ritira la vecchia quando non restano `v1:`.

---

## 6. Migrazione dei dati

Stessa forma del vault, che ha funzionato al primo colpo: **niente è
distruttivo finché la verifica non è passata.**

**Fase 1 — codice che sa leggere entrambi, scrive cifrato.**
L'estensione Prisma decifra i valori con prefisso `v1:` e lascia passare quelli
senza. Ogni scrittura produce `v1:`. Deploy. Da questo momento i dati nuovi e
quelli modificati sono cifrati, i vecchi no, e l'applicazione funziona
identica. **Nessuna migration SQL in questa fase.**

**Fase 2 — travaso.** Uno script in `packages/db/prisma/manutenzione/`, non una
migration SQL (la cifratura avviene in Node, non in Postgres): legge le righe
senza prefisso, le riscrive cifrate, in transazione, a blocchi. Con 73 righe è
un secondo.

**Fase 3 — verifica, prima di considerare chiuso.**

```sql
-- quante righe non sono ancora cifrate: deve dare 0
SELECT count(*) FROM athlete_identities WHERE "lastName" NOT LIKE 'v1:%';
-- e un'occhiata a occhio nudo
SELECT "athleteId", left("lastName", 20) FROM athlete_identities LIMIT 5;
```

Più la verifica che conta davvero: aprire la lista atleti, cercare per mezzo
cognome, aprire una scheda, generare un report PDF, guardare la console admin.

**Fase 4 — `dateOfBirth`.** La conversione di tipo è l'unica migration SQL
vera, e va per ultima, quando tutto il resto è verificato.

---

## 7. Cosa si rompe, e cosa no

| | Effetto |
| --- | --- |
| Ricerca per cognome parziale | **Funziona come oggi**, ma in memoria: l'endpoint carica le anagrafiche dell'organizzazione, decifra, filtra, ordina, pagina. Due query invece di una |
| Ordinamento per cognome | Idem. L'indice `@@index([lastName, firstName])` diventa inutile e va rimosso |
| `flattenIdentities` e l'hook `preSerialization` | Invariati: ricevono già valori decifrati |
| PDF, DOCX, email, contesto IA | Invariati, **se** lo spike del §3.1 passa |
| Cancellazione GDPR | Invariata: scrive `'Rimosso'`, che viene cifrato come ogni altro valore |
| Seed e dati di prova | Invariati: importano lo stesso client |
| **I cinque script SQL di manutenzione** | **Si rompono nella leggibilità**: `diag2.sql` stamperà `v1:8fA2…` al posto dei cognomi. Non è un errore, è la cifratura che funziona. Se servono leggibili, vanno riscritti come piccoli script Node che passano dal client |
| Backup | Contengono testo cifrato: è il guadagno. **Ma un backup senza la chiave è carta straccia** — la copia della chiave diventa parte della procedura di backup |
| Prestazioni | Trascurabili a questa scala. AES-GCM su qualche centinaio di stringhe è nell'ordine dei microsecondi |

---

## 8. Rollback

Finché non si esegue la Fase 4, il rollback è semplice perché **la chiave
esiste ancora**: uno script inverso che decifra e riscrive in chiaro, più il
ritorno alla versione precedente del client. Dopo la Fase 4 serve anche la
migration inversa sul tipo di `dateOfBirth`.

Il rollback impossibile è uno solo: chiave persa. Vedi §5.

---

## 9. Ordine di esecuzione

0. **Backup fuori dal VPS** (§5.4): viene prima di tutto, indipendentemente
   dalla cifratura
1. Spike sulle estensioni Prisma (§3.1) — **e si prosegue solo se passa**
2. Generazione chiave, tre copie verificate per impronta, **prova di
   ripristino dalla copia esterna** (§5.2, §5.3)
3. Modulo di cifratura e sua suite di test (round-trip, AAD sbagliato, valore
   senza prefisso, chiave assente, chiave di lunghezza errata, a capo finale,
   canarino che non corrisponde)
4. Estensione del client Prisma
5. Adeguamento di ricerca, ordinamento e paginazione in `athletes.ts`
6. `pnpm type-check`, `pnpm test`, `pnpm test:e2e` in locale
7. Deploy Fase 1, con backup prima
8. Travaso (Fase 2) e verifica (Fase 3)
9. `dateOfBirth` (Fase 4)
10. Aggiornamento di Registro art. 30 e DPIA: la voce «cifratura a riposo a
    livello di colonna: pianificata e non ancora attiva» diventa attiva

---

## 10. Cosa resta scoperto, dopo

Root sul VPS. Il processo API compromesso. Sono le due righe in fondo alla
tabella del §1, e nessuna quantità di crittografia applicativa le tocca.

Ridurle è un lavoro di natura diversa — separare il database su una macchina
propria, irrobustire l'accesso al server, monitorare — e va valutato per quello
che è, non confuso con questo.
