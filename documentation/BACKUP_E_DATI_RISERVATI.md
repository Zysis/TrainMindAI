# Backup e dati riservati — come funziona e dove finiscono

> Aggiornato il 22/09/2026. Documento operativo: descrive lo stato attuale,
> non un piano.

---

## 1. Il backup notturno

`/opt/trainmind/backup.sh`, lanciato da cron di root alle **03:30** ogni
giorno. Produce `/opt/trainmind/backups/trainmind_<data>_<ora>.dump.gpg`,
cifrato AES-256 con la passphrase in `/opt/trainmind/secrets/backup.pass`
(`chmod 400`, root). Conservazione: **14 copie**, ruotate solo dopo che le
verifiche sono passate.

**Il dump in chiaro non tocca mai il disco**: esce da `pg_dump` ed entra
direttamente in `gpg` attraverso una pipe.

Lo script fa due verifiche prima di ruotare:

1. **Integrità crittografica** — `gpg --decrypt` senza pipe, così legge il
   messaggio fino in fondo e controlla il codice di integrità (MDC).
2. **È davvero un dump** — `pg_restore -l` ne legge l'indice.

Se una fallisce, lo script esce con errore e **non cancella nulla**: meglio 15
backup di cui uno rotto che 14 di cui l'ultimo buono è stato buttato.

### Le due trappole che ci sono costate tempo

**`pipefail` e `pg_restore -l`.** `pg_restore -l` legge solo l'indice, che in
un archivio `-Fc` sta in testa, e chiude lo stdin senza consumare il resto. gpg
si ritrova la pipe chiusa ed esce con **codice 2, «Broken pipe»** — pur avendo
funzionato. Con `set -o pipefail` quel 2 diventa l'esito dell'intera pipeline e
boccia un backup valido. Il verdetto va preso da `${PIPESTATUS[1]}`, cioè da
`pg_restore`, non dalla pipeline.

**`--pinentry-mode loopback` non chiede conferma.** Serve, perché senza gpg non
riesce a chiedere la passphrase quando sta in fondo a una pipe
(`Inappropriate ioctl for device`). Ma la chiede **una volta sola**: un errore
di battitura produce un file che nessuno potrà mai aprire, e lo si scopre al
primo tentativo di ripristino. Per questo la passphrase si digita una volta e
si riusa la stessa stringa per cifrare e verificare — da file, mai due
digitazioni.

Aggiungere `export GPG_TTY=$(tty)` al `~/.bashrc` del VPS evita il secondo
errore quando si lavora a mano.

---

## 2. Dove sono finiti i dump, storicamente

Questo elenco è la parte più utile del documento. Il 22/09/2026 sono stati
trovati dump **in chiaro** in cinque posti diversi, accumulati da luglio:

| Posto | Cosa c'era | Stato |
| --- | --- | --- |
| `/opt/trainmind/backups/` sul VPS | 14 dump del cron + `pre_20260917.sql` | cifrati, originali distrutti con `shred` |
| `/root/` sul VPS | 2 backup manuali | cifrati il 21/09, originali distrutti |
| `C:\Users\TeamDS\Documents\backup-trainmind` | **72 dump**, dal 17/07 al 15/09, 56 MB | archiviati in `dump-storici-luglio-settembre.7z` (`-mhe=on`), originali cancellati |
| `C:\Users\TeamDS\Documents\TrainMind-dati-riservati` | 5 dump spostati dalla radice del progetto | da cifrare con 7z |
| Radice di `trainmind-app` | `backup_pre_*.sql`, `utenti.sql`, `q.sql` | spostati fuori il 21/09, esclusi dagli archivi di deploy |

Più due categorie che non sono dati personali ma **credenziali**:
i quattro `code-*.tar.gz` in `/opt/trainmind/backups/` contenevano
`packages/db/.env` e `apps/ai-service/.env` con password e chiavi API tuttora
in uso. Cifrati, originali distrutti.

**La lezione**: quando si cerca dove finiscono i dati riservati, non basta
guardare dove si pensa che siano. Il 21/09 avevamo dichiarato chiusa la
questione dopo aver cifrato due file, mentre un cron ne produceva uno al
giorno e il portatile ne conteneva settantadue.

---

## 3. La copia sul PC

Manuale, a discrezione. Dal PC (PowerShell):

```powershell
scp root@31.70.77.212:/opt/trainmind/backups/*.dump.gpg C:\Users\TeamDS\Documents\backup-trainmind\
```

Solo file `.gpg`: sul portatile non arriva più niente in chiaro.

**La passphrase non deve stare in quella cartella.** Sta nel password manager.
Se stanno insieme, la cifratura non serve a niente.

È l'unica copia fuori dal VPS. Finché resta manuale, la finestra di perdita è
il tempo fra due scarichi: se il server sparisce il giorno dopo l'ultimo
scarico, si perde un giorno di dati.

---

## 4. Ripristinare

```bash
cd /opt/trainmind/trainmind-app
GPG_OPTS=(--batch --pinentry-mode loopback --passphrase-file /opt/trainmind/secrets/backup.pass)

# elenco del contenuto, senza scrivere niente
gpg --decrypt "${GPG_OPTS[@]}" ~/backups/trainmind_<data>.dump.gpg 2>/dev/null \
  | docker compose -f docker-compose.deploy.yml exec -T postgres pg_restore -l | head
```

Per un ripristino vero conviene **prima** caricarlo in un database di verifica
accanto a quello di produzione, contare atleti e anagrafiche, e solo dopo
decidere. Un ripristino mai provato non è un ripristino.

---

## 5. Cosa resta aperto

- **Copia automatica fuori dal VPS.** Oggi è manuale. Un bucket S3-compatibile
  o un secondo server renderebbero la copia indipendente dalla memoria di chi
  lancia il comando.
- **Prova di ripristino completa**, non solo la lettura dell'indice.
- **Rotazione delle credenziali** contenute nei `code-*.tar.gz`: password di
  Postgres, segreto JWT, chiavi dei fornitori. Quattro copie d'archivio in due
  mesi contenevano quelle in uso oggi.
- **`trainmind_staging` e `trainmind_dev`** sono password scritte a mano nei
  compose. Se lo staging è raggiungibile dalla rete, la prima è una password
  vera e pubblica.
- **`lab21-2026-09-08-0954.tar.gz`** (41 MB) è il sito vetrina: nessun dato
  personale, lasciato in chiaro di proposito.

---

## 6. Rotazione credenziali del 22/09/2026

Motivo: quattro archivi `code-*.tar.gz` in `/opt/trainmind/backups/` contenevano
`packages/db/.env` e `apps/ai-service/.env` con credenziali in uso. Non un
incidente — quegli archivi non hanno mai lasciato il server, dove l'unico utente
e' root — ma igiene dovuta.

**Ruotate:** password Postgres dell'utente `trainmind`; `OPENAI_API_KEY`
(sostituita **e revocata** dal pannello del fornitore).

**Non ruotate, per scelta:** `JWT_SECRET` di produzione, chiavi Stripe,
`RESEND_API_KEY`, `ADMIN_PASSWORD_HASH` — vivono in `.env.deploy`, che non era
dentro nessuno degli archivi. `DATABASE_URL_READONLY` appartiene all'utenza
`trainmind_reporting`, non toccata.

**Aperto:** `trainmind_staging` e il `JWT_SECRET` di staging sono scritti a mano
nei compose. Da ruotare solo se quell'ambiente e' raggiungibile da internet.

### Come si ruota la password di Postgres

Tre punti da allineare, o qualcosa si scollega:

```bash
cd /opt/trainmind/trainmind-app
alias dc='docker compose -f docker-compose.deploy.yml --env-file .env.deploy'

# Esadecimale, NON base64: '+' '/' e '=' dentro una DATABASE_URL andrebbero
# percent-encoded, e non vale la pena rischiare.
NEWPASS=$(openssl rand -hex 24)
echo "$NEWPASS"     # annotarla nel password manager PRIMA di proseguire

dc exec -T postgres psql -U trainmind -d trainmind_db -c "ALTER USER trainmind WITH PASSWORD '$NEWPASS';"
sed -i -E "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEWPASS|" .env.deploy
sed -i -E "s|(postgresql://[^:]+:)[^@]*(@)|\1$NEWPASS\2|" packages/db/.env

dc up -d api web athlete admin ai-service
dc exec -T api sh -c 'echo "$DATABASE_URL"' | grep -c "$NEWPASS"   # deve dare 1
/opt/trainmind/backup.sh                                            # deve dare "ok ... verificato"
```

`POSTGRES_PASSWORD` nel compose imposta la password **solo alla creazione** del
database: cambiarla nel file non tocca l'utente esistente. L'`ALTER USER` non e'
facoltativo.

Verifica finale dal browser: lista atleti, Contatti nella console admin
(utenza di reporting, che deve continuare a funzionare), assistente AI.

### Due trappole che ci sono costate

**Il segnaposto eseguibile.** Il comando era stato scritto con
`WITH PASSWORD 'NUOVA'` come esempio da sostituire. Copiato e incollato cosi'
com'era, ha impostato davvero la password di produzione a `NUOVA`. Regola: in un
blocco destinato al copia-incolla, i valori da sostituire non devono essere
sintatticamente validi. Meglio `$NEWPASS` generato dal comando precedente, che
non richiede intervento umano.

**I `.env` con permessi larghi.** `packages/db/.env` e `.env.deploy.example`
erano a **666**, i `.env.deploy.bak-*` storici a 644 — tutti con credenziali
dentro. Corretti a 600. Da ricontrollare dopo ogni intervento che crea copie:

```bash
ls -la /opt/trainmind/trainmind-app/.env* /opt/trainmind/trainmind-app/packages/db/.env*
```

**E le copie di sicurezza vanno distrutte dopo la verifica**, non lasciate li':
un `.env.deploy.bak-*` e' un file con dentro una credenziale, anche quando la
credenziale non e' piu' valida. `shred -u`, e attenzione che il modello del
comando le prenda tutte — una copia chiamata `prima-rotazione-*` era sfuggita a
un `shred` che cercava `bak-*`.
