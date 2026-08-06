# db_controller — accesso e pulizia dei database TrainMind

Strumenti per ispezionare e ripulire i database di sviluppo e di produzione.

**Non è stata costruita un'applicazione custom**: Prisma Studio è già incluso nel
progetto (script `studio` in `packages/db/package.json`) e copre navigazione, modifica
e cancellazione su tutti e 37 i modelli, rispettando relazioni e vincoli. Questa
cartella contiene la procedura per usarlo su entrambi gli ambienti, più uno strumento di
ricognizione in sola lettura.

Se dopo averlo usato mancasse qualcosa — tipicamente cancellazioni a cascata mirate, che
in Studio richiedono molti passaggi manuali nell'ordine giusto — si valuta un'app
dedicata sapendo esattamente cosa deve fare.

---

## 0. Prima di qualsiasi modifica: backup

Non negoziabile sulla produzione, consigliato anche in locale.

**Locale:**

```powershell
docker exec -t trainmind-postgres pg_dump -U trainmind trainmind_db > "$env:USERPROFILE\backup_locale_$(Get-Date -Format yyyyMMdd_HHmm).sql"
```

**Produzione:**

```bash
ssh root@IP_DEL_VPS
docker exec -t trainmind-postgres pg_dump -U trainmind trainmind_db \
  > ~/backup_prod_$(date +%Y%m%d_%H%M).sql
ls -lh ~/backup_prod_*.sql
```

Ripristino, se servisse:

```bash
docker exec -i trainmind-postgres psql -U trainmind -d trainmind_db < backup_prod_AAAAMMGG_HHMM.sql
```

---

## 1. Ricognizione — cosa c'è dentro

Sola lettura. Nessuna porta aperta, nessun tunnel: il comando SQL viaggia sullo stdin di
`ssh` e viene eseguito da `psql` dentro il container.

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\db_controller

# database locale
.\inventario.ps1

# database di produzione
.\inventario.ps1 -Ambiente server -Vps IP_DEL_VPS
```

Restituisce righe e spazio per tabella, elenco utenti con ruolo e stato, consistenza per
organizzazione, e per ogni atleta quanti wellness log e infortuni sono collegati —
quest'ultima serve a capire **cosa verrebbe travolto da una cancellazione** prima di
eseguirla.

---

## 2. Prisma Studio — database locale

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm --filter @trainmind/db studio
```

Si apre su <http://localhost:5555>. Legge `DATABASE_URL` da `packages/db/.env`.

---

## 3. Prisma Studio — database di produzione

Postgres in produzione **non pubblica alcuna porta**: esiste solo sulla rete interna
Docker. È la configurazione corretta, e va mantenuta. Per raggiungerlo serve un tunnel
SSH verso l'IP del container.

### 3.1 Ricava l'IP del container e la password

```bash
ssh root@IP_DEL_VPS
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' trainmind-postgres
grep POSTGRES_PASSWORD /opt/trainmind/trainmind-app/.env.deploy
```

L'IP cambia se il container viene ricreato: va riletto a ogni sessione.

### 3.2 Apri il tunnel (lascia questo terminale aperto)

```powershell
ssh -N -L 5433:IP_CONTAINER:5432 root@IP_DEL_VPS
```

`-N` significa "nessun comando remoto, solo il tunnel". La porta locale è la **5433**
per non collidere con il Postgres di sviluppo sulla 5432.

### 3.3 In un secondo terminale, avvia Studio sul tunnel

```powershell
$env:DATABASE_URL = "postgresql://trainmind:PASSWORD_DI_PRODUZIONE@localhost:5433/trainmind_db"
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm --filter @trainmind/db studio
```

La variabile impostata nella shell ha la precedenza sul file `.env`: Prisma carica il
`.env` ma non sovrascrive ciò che è già in `process.env`.

> **Verifica di essere sul database giusto prima di toccare qualcosa.** Le due istanze si
> assomigliano. Un controllo rapido: in produzione `pispi29@hotmail.it` ha ruolo
> `ATHLETE`, in locale `ADMIN`.

Chiudendo il terminale del tunnel, Studio perde la connessione. La variabile
`DATABASE_URL` vale solo per quella finestra di PowerShell: aprendone una nuova si torna
al database locale.

---

## 4. Note sulla cancellazione

Lo schema usa cascate diverse a seconda della relazione. Prima di cancellare un atleta o
un'organizzazione conviene sapere cosa sparisce con lui — la sezione "atleti" di
`inventario.sql` serve a questo.

### 4.1 Cancellare un atleta: cosa lo blocca

Verificato sullo schema: delle 14 relazioni che puntano ad `Athlete`, **una sola cancella
a cascata**. Tutte le altre sono `Restrict`, il comportamento predefinito di Prisma: la
cancellazione viene **rifiutata** finché esistono righe collegate.

| Comportamento | Tabelle |
|---|---|
| **Cascade** — sparisce da sola | `athlete_teams` |
| **Restrict** — va svuotata prima | `users`, `training_plans`, `training_sessions`, `session_logs`, `metrics`, `wellness_logs`, `injuries`, `rtp_protocols`, `alert_rules`, `plan_adaptations`, `field_training_entries`, `game_player_entries`, `athlete_invites` |

In pratica: cancellare un atleta con dei dati addosso richiede di svuotare fino a 13
tabelle nell'ordine corretto. È il caso tipico in cui uno script batte l'interfaccia — in
Studio significherebbe decine di operazioni manuali, con il rischio di fermarsi a metà.

### 4.2 Altri vincoli da conoscere

- **`users` ha `deletedAt`**: esiste una cancellazione logica usata dal flusso GDPR
  (`/gdpr/delete-account`), che anonimizza l'email in `deleted-<id>@removed.local`
  invece di rimuovere la riga. Cancellare fisicamente non è equivalente e aggira
  quel percorso.
- **`audit_logs.userId` è `ON DELETE SET NULL`**: cancellando un utente le sue tracce di
  audit restano, prive di attribuzione.
- **`users.athleteId` è `Restrict`**: se un atleta ha un account collegato, va rimosso
  prima l'utente.

Se una pulizia si rivelasse ripetitiva o rischiosa da fare a mano, conviene scriverla
come script con anteprima (dry-run) e conferma esplicita, invece che a click.
