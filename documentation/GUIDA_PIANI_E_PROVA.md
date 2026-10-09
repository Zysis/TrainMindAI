# Piani, prova gratuita ed estensioni — guida all'attivazione in locale

Scritta il 9 ottobre 2026. Applica in `trainmind-app` (API, web, console admin) e in
`trainmind-mobile` il listino di `marketing/Strategia_commerciale_basket_v3.docx`.

---

## 1. Cosa cambia, in breve

| | Starter | Professional | Ultra | Club | Prova gratuita |
|---|---|---|---|---|---|
| Prezzo (IVA incl.) | 15 €/mese · 150 €/anno | 30 · 300 | 35 · 350 | 50 · 500 | gratis, 15 giorni |
| Squadre × atleti attivi | 1 × 12 | 2 × 14 | 4 × 20 | 6 × 20 | 1 × 12 |
| Utenti dello staff | 1 | 1 | 2 | 4 | 1 |
| Crediti AI al mese | — | 200 | 500 | 750 | — |
| AI Assistant (chat, piani, insight, suggerimenti RTP) | no | sì | sì | sì | no |
| Analytics | no | sì | sì | sì | sì |
| Report giornaliero | no | sì | sì | sì | uno solo, di prova |
| Report post-partita | no | sì | sì | sì | no |
| Generatore di report e invii programmati | sì | sì | sì | sì | no |
| Adattamenti AI | sì | sì | sì | sì | no |
| Estensioni | no | no | sì | sì | no |

Estensioni (solo Ultra e Club): squadra in più 8 €/mese o 80 €/anno (+100 crediti AI);
pacchetto da 5 atleti per una squadra 2 €/mese o 20 €/anno; utente in più 10 €/mese
o 100 €/anno. Al massimo 10 riattivazioni di atleti al mese per account.

**Tre interruttori decidono se un limite si applica davvero:**

1. `PLAN_ENFORCEMENT=true` nell'ambiente dell'API. **Spento (il default) l'app si
   comporta esattamente come prima**: calcola tutto, non blocca niente.
2. `organizations.planLegacy`: la migrazione lo mette a `true` su **tutte le
   organizzazioni che esistono già**. Restano esenti anche con l'interruttore acceso,
   finché non si decide altrimenti. Le organizzazioni nuove nascono con `false`.
3. Il piano stesso (tabella sopra), definito in un solo posto:
   `apps/api/src/lib/plans.ts`.

**Regola di ogni limite: un tetto superato non cancella e non nasconde niente.** Si
smette solo di poter aggiungere. Periodizzazione e RTP restano disponibili in tutti i
piani; i suggerimenti RTP scritti dall'AI seguono l'AI.

**La prova è uno stato, non un piano.** Chi si registra in prova ha `trialEndsAt`
valorizzata (15 giorni). Alla scadenza l'account diventa **di sola lettura** per lo
staff: si consulta tutto, non si modifica niente, tranne la pagina Abbonamento per
scegliere un piano. Gli atleti non vengono mai bloccati. Si può anche comprare un
piano direttamente, senza passare dalla prova.

**Senza Stripe configurato** (è il caso del locale) il piano scelto e le estensioni
si attivano subito, senza pagamento: serve a provare tutto il percorso.

I limiti superati rispondono con HTTP 402 e un codice tradotto in it/en/es
(`PLAN_TEAM_LIMIT`, `PLAN_ATHLETE_LIMIT`, `PLAN_ATHLETE_TOTAL_LIMIT`,
`PLAN_REACTIVATION_LIMIT`, `PLAN_FEATURE_UNAVAILABLE`, `AI_QUOTA_EXCEEDED`,
`PLAN_READ_ONLY`, `PLAN_EXTENSIONS_UNAVAILABLE`, `PLAN_TRIAL_REPORT_LIMIT`,
`PLAN_TRIAL_REPORT_SAVE_FIRST`, …).

---

## 2. Comandi, in ordine (PowerShell)

Tutti da `C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app`,
con Docker Desktop acceso e il container `trainmind-postgres` in esecuzione.

### 2.1 Ferma il server di sviluppo

`Ctrl+C` nella finestra di `pnpm dev`. Serve perché `pnpm db:generate` su Windows
non riesce a sostituire il motore di Prisma mentre l'API lo tiene aperto.

### 2.2 Backup del database

```powershell
docker exec trainmind-postgres pg_dump -U trainmind -d trainmind_db -f /tmp/backup.sql
docker cp trainmind-postgres:/tmp/backup.sql .\backup_prima_dei_piani.sql
```

### 2.3 Applica la migrazione (a mano, NON con `pnpm db:migrate`)

> ⚠️ **Non usare `pnpm db:migrate`** (azzera il database di sviluppo) **né
> `pnpm db:push`**: `db push` creerebbe la colonna `planLegacy` con il default
> `false` e tutti gli account esistenti perderebbero l'esenzione.

```powershell
docker cp packages\db\prisma\migrations\20261009090000_plans_trial_extensions\migration.sql trainmind-postgres:/tmp/m.sql
docker exec trainmind-postgres psql -U trainmind -d trainmind_db -v ON_ERROR_STOP=1 -f /tmp/m.sql
```

La migrazione è idempotente: rilanciarla non fa danni.

Verifica (ogni organizzazione esistente deve avere `planLegacy = t`):

```powershell
docker exec trainmind-postgres psql -U trainmind -d trainmind_db --% -c "SELECT name, tier, \"planLegacy\", \"trialEndsAt\" FROM organizations ORDER BY \"createdAt\";"
```

### 2.4 Rigenera il client Prisma

```powershell
pnpm db:generate
```

### 2.5 Accendi l'interruttore

Aggiungi la riga al `.env` della radice (è quello che legge l'API in sviluppo):

```powershell
Add-Content -Path .env -Value "PLAN_ENFORCEMENT=true" -Encoding ascii
Select-String -Path .env -Pattern "PLAN_ENFORCEMENT"
```

Per tornare al comportamento di prima basta mettere `false` (o togliere la riga) e
riavviare l'API.

### 2.6 Controlli automatici

```powershell
pnpm --filter @trainmind/api type-check
pnpm --filter @trainmind/web type-check
pnpm --filter @trainmind/admin type-check
pnpm --filter @trainmind/api test
```

`test/plans.test.ts` (23 test nuovi) non ha bisogno del database: verifica listino,
interruttore, stati della prova, estensioni, capienze, funzioni per piano e sola
lettura. Gli altri file di test richiedono il Postgres locale, come prima.

### 2.7 Riavvia

```powershell
pnpm dev
```

E, se lo usi, `trainmind-mobile` come al solito (porta 3002).

---

## 3. Prove manuali

### 3.0 Account di prova con dati demo

`packages/db/prisma/setup-test-accounts.ts` prepara quattro account con la
stessa password di `test_gratis@demo.com` (ne copia l'hash) e dati demo dentro
i limiti di ogni piano:

| account | piano | dati |
|---|---|---|
| `test_gratis@demo.com` | prova gratuita (com'era) | 1 squadra × 10 atleti |
| `test_starter@demo.com` | Starter | 1 squadra × 11 atleti |
| `test_pro@demo.com` | Professional | 2 squadre × 12 atleti |
| `test_ultra@demo.com` | Ultra | 3 squadre × 16 atleti |
| `test_club@demo.com` (+ `test_club_preparatore@demo.com`, `test_club_medico@demo.com`) | Club | 5 squadre × 18 atleti, 3 utenti su 4 |

Per ogni squadra: periodizzazione 2026/27 con sedute (passate completate con
RPE, future pianificate), wellness dal 17/08, test fisici, un infortunio
risolto e uno in corso con RTP, tre partite in calendario. Nessun report
giornaliero, così quello della prova resta da fare. Lo script cancella anche
le organizzazioni di `avispa@pro.com`, `avispa@starter.com` e dei cinque
account `*.test@trainmind.demo` (Test Deploy), e il solo account di
`nicola.bortolotti@example.com` (la «TrainMind Demo» di `coach@example.com`
resta, con l'atleta). Elenca anche tutti gli account presenti. Si può rilanciare:
riparte da dati puliti.

```powershell
pnpm --filter @trainmind/db exec tsx prisma/setup-test-accounts.ts --solo-elenco   # solo l'elenco
pnpm --filter @trainmind/db exec tsx prisma/setup-test-accounts.ts                 # tutto
```

Usa account **nuovi**: quelli esistenti sono esenti e non mostrano limiti. Per le
query SQL sostituisci `prova1@example.com` con l'email che hai registrato.

### 3.1 Account esistente (deve restare tutto come prima)

- [ ] Entra con un account che c'era già: nessun banner, nessun lucchetto nel menu,
      squadre/atleti/AI/report funzionano come prima.

### 3.2 Prova gratuita

- [ ] `http://localhost:3000/register`: la prima scelta, preselezionata, è la prova
      gratuita di 15 giorni.
- [ ] Dopo l'accesso: banner "prova, mancano N giorni" e badge **PROVA** nel menu.
- [ ] Crea una squadra: va. Una seconda: messaggio di limite.
- [ ] Aggiungi 12 atleti: vanno. Il 13°: messaggio di limite.
- [ ] Analytics: disponibile.
- [ ] Adattamenti AI: bloccati (lucchetto nel menu, pagina che invita a
      scegliere un piano).
- [ ] Report: la pagina si apre, ma il generatore è sostituito dall'invito a
      scegliere un piano; invii programmati e post-partita bloccati.
- [ ] **Report giornaliero di prova:** scegli squadra e giorno, salva, esporta
      PDF/DOCX. Prima del salvataggio i pulsanti di esportazione sono spenti.
      Dopo il salvataggio squadra e data restano bloccate; riaprendo la pagina
      si torna su quel report, che si può modificare ed esportare ancora. Un
      secondo report (altro giorno o altra squadra) viene rifiutato.
- [ ] La checklist di benvenuto non propone «Crea una scheda con l’AI»;
      «Genera un report» porta al report giornaliero.
- [ ] Chat AI, generatore di piani, insight wellness, suggerimenti RTP: bloccati
      (lucchetto nel menu, pagina che invita a scegliere un piano).

### 3.3 Scadenza della prova → sola lettura

```powershell
docker exec trainmind-postgres psql -U trainmind -d trainmind_db --% -c "UPDATE organizations SET \"trialEndsAt\" = now() - interval '1 day' WHERE id = (SELECT \"organizationId\" FROM users WHERE email = 'prova1@example.com');"
```

- [ ] Ricarica: banner "prova scaduta". Si consulta tutto, ma ogni salvataggio
      risponde con il messaggio di sola lettura.
- [ ] La pagina **Abbonamento** funziona: attiva un piano → il banner sparisce e si
      torna a modificare.

### 3.4 Acquisto diretto, senza prova

- [ ] `http://localhost:3000/register?plan=starter` (con un'altra email): nessun
      banner di prova.
- [ ] Starter: Analytics, chat AI, report giornaliero e post-partita bloccati;
      periodizzazione e RTP disponibili.
- [ ] Abbonamento → passa a **Ultra**: si sbloccano le funzioni, limiti 4 × 20,
      2 utenti, 500 crediti; compaiono le estensioni.
- [ ] Estensioni: aggiungi una squadra → se ne possono creare 5; aggiungi un
      pacchetto atleti a una squadra → quella squadra arriva a 25.
- [ ] Prova anche **Club** (6 × 20, 4 utenti, 750 crediti).

### 3.5 Riattivazioni

- [ ] Archivia e ripristina un atleta più volte: l'11° ripristino nello stesso mese
      viene rifiutato. Il ripristino conta solo se l'atleta era davvero archiviato.

### 3.6 Quota AI (account Professional)

Simula 199 crediti già consumati questo mese:

```powershell
docker exec trainmind-postgres psql -U trainmind -d trainmind_db --% -c "INSERT INTO ai_usage_logs (id, \"organizationId\", operation, endpoint, model, \"creditsCharged\") SELECT 'test-quota-ai', \"organizationId\", 'CHAT', '/ai/chat', 'test', 199 FROM users WHERE email = 'prova1@example.com';"
```

- [ ] Banner di avviso (oltre l'80%).
- [ ] Un messaggio in chat (1 credito) passa; il successivo viene bloccato con
      "crediti AI esauriti".
- [ ] Le chiamate AI fallite non consumano crediti.

Pulizia:

```powershell
docker exec trainmind-postgres psql -U trainmind -d trainmind_db --% -c "DELETE FROM ai_usage_logs WHERE id = 'test-quota-ai';"
```

### 3.7 Landing, mobile, console

- [ ] Landing in it/en/es: interruttore mensile/annuale, striscia della prova,
      tre piani Individuale con Ultra in evidenza, scheda Club, nota "IVA inclusa".
- [ ] Mobile (porta 3002): stesso banner, Analytics e chat bloccati dove previsto,
      pagina Abbonamento nuova.
- [ ] Console admin (porta 3005): il piano **Club** compare nei filtri e nei
      riepiloghi.

---

## 4. Note per la produzione (quando sarà il momento)

- **`PLAN_ENFORCEMENT` resta `false`** finché pagamenti e partita IVA non sono
  pronti. È già nel blocco `environment` dell'API in `docker-compose.deploy.yml`
  (default `false`) e in `.env.deploy.example`.
- La migrazione va applicata **a mano** e poi registrata, come le precedenti:
  ```bash
  dc exec -T postgres psql -U trainmind -d trainmind_db -v ON_ERROR_STOP=1 < packages/db/prisma/migrations/20261009090000_plans_trial_extensions/migration.sql
  dc --profile tools run --rm --entrypoint sh migrate -c 'cd packages/db && npx prisma migrate resolve --applied 20261009090000_plans_trial_extensions'
  ```
  (`migrate` va ricostruito prima del `resolve`). Il `GRANT SELECT` a
  `trainmind_reporting` per la nuova tabella è già dentro la migrazione.
- **Price di Stripe da creare** prima di accendere i pagamenti:
  `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_YEARLY`, e lo stesso per
  `PROFESSIONAL`, `ULTRA`, `CLUB`; `STRIPE_PRICE_EXTRA_TEAM` (+`_YEARLY`),
  `STRIPE_PRICE_EXTRA_ATHLETES` (+`_YEARLY`). Le vecchie `STRIPE_PRICE_<PIANO>`
  senza suffisso valgono ancora come mensile.
- **Utente aggiuntivo:** il flusso dei posti esistente usa `STRIPE_PRICE_SEAT` e, se
  manca, il price dello Starter (oggi 15 €). Va creato `STRIPE_PRICE_SEAT` a
  10 €/mese; l'annuale dell'utente aggiuntivo non è ancora gestito da quel flusso.
- Ogni variabile nuova va nei tre posti (`.env.deploy`, compose, `.env.example`).

---

## 5. Fuori da questo lavoro

- **Squadra dimostrativa** (12 atleti, esclusa dai limiti della prova): lavoro a
  parte, come deciso.
- **Checkout Stripe delle estensioni**: scritto ma non provato, Stripe è spento in
  locale. In Stripe le riduzioni si fanno dal portale cliente.
- **Registrazione dal mobile**: era già incompleta prima (mancano data di nascita e
  consensi); non è stata toccata.
- Gli **Adattamenti AI** sono bloccati solo nella prova gratuita: nei piani a
  pagamento, Starter compreso, restano disponibili.
- La console admin mostra il piano Club, ma non ancora lo stato della prova
  (scadenza, sola lettura).
