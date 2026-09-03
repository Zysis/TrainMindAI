# ToTest.txt — esito delle cinque verifiche

**2 settembre 2026 — stack locale** (`pnpm dev`, organizzazione Alessandro Vispa:
tre squadre Under 14 / 16 / 18, 38 atleti, 151 esercizi, 9 piani di
periodizzazione, 2 protocolli RTP attivi).

Due passano, due passano con un difetto ciascuna, una non passa.

| | Voce | Esito |
|---|---|---|
| 1 | Report giornaliero su una giornata con due squadre | **Passa** |
| 2 | Report partita su una gara con supplementari | **Passa, tranne un numero** |
| 3 | ACWR del box rischio su dati veri | **Non passa** |
| 4 | Menu clinici di "Fine giornata" con un infortunio aperto | **Passa, con una lacuna** |
| 5 | Le tre lingue su una sessione di lavoro reale | **Passa** |

---

## 1. Report giornaliero con due squadre — passa

Il 27 agosto 2026 ha eventi di **tre** squadre diverse nella stessa giornata. I tre
report si comportano come devono:

| Squadra | Atleti | Attività nel report | Evento a calendario |
|---|---|---|---|
| Under 14 | 9 | Tiro 60′ | `shooting` |
| Under 16 | 12 | Individuale 60′ | `individual` |
| Under 18 | 14 | Basket 60′ + Riabilitazione 60′ | `basket`, `rehab` |

Nessuna contaminazione fra squadre, rose della dimensione giusta, tipi di evento
tradotti correttamente in attività, minuti sommati per tipo.

**Una cosa da decidere:** quel giorno c'erano anche due sedute pianificate
(`Forza e Potenza`, `Forza e Ipertrofia`) di tipo `session` **senza `teamId`**.
Non compaiono in nessuno dei tre report, perché `buildReport` filtra gli eventi
per squadra. Non è un errore di codice — è una conseguenza del fatto che le
sessioni dei piani non portano la squadra con sé. Ma per chi compila il foglio
significa che una seduta fatta davvero non risulta.

## 2. Report partita con supplementari — passa, tranne un numero

Ho segnato una partita vera sull'evento *pgbk vs reca* del 1° settembre: due
supplementari, cinque giocatori in campo per l'intera gara (4 quarti da 10′ + 2
supplementari da 5′ = **50 minuti a testa**), punteggio 88-85.

Quello che funziona:

- Le etichette dei periodi sono corrette: `Q1 Q2 Q3 Q4 OT1 OT2`
  (`periodLabel` in `game-report.ts:171` gestisce bene lo scavallamento).
- La ripartizione per periodo di ogni giocatore è esatta su sei periodi:
  `{1: 600000, 2: 600000, 3: 600000, 4: 600000, 5: 300000, 6: 300000}`.
- I minuti totali per giocatore sono giusti: 50.

**Quello che non funziona — `expectedMinutes`.** In `game-report.ts:341`:

```ts
expectedMinutes: Math.round((totalPeriods * session.quarterDurationMs * 5) / 60000),
```

Ogni supplementare viene contato come **un quarto intero**. Con 4 quarti da 10′ e
2 supplementari da 5′ i minuti-uomo davvero disponibili sono
`(4×10 + 2×5) × 5 = 250`; il report ne dichiara `6 × 10 × 5 = 300`.

La pagina mostra il rapporto grezzo (`reports/game/page.tsx:393`), e nel mio test
il riquadro diceva:

> **Minuti — 316 / 300**

Un rapporto maggiore di uno: i giocatori risultano in campo più dei minuti
esistenti. Basta guardarlo per capire che c'è qualcosa che non torna, ed è il
tipo di numero che fa perdere fiducia in tutto il resto del foglio.

**Perché non l'ho corretto:** il modello ha un solo `quarterDurationMs` e nessun
campo per la durata del supplementare, quindi non è una riga da cambiare ma una
decisione: o si aggiunge `overtimeDurationMs`, o si fissa la convenzione che il
supplementare vale metà quarto. La seconda è gratis e copre il 99% dei casi
(10′/5′ FIBA, 12′/5′ NBA no).

## 3. ACWR — non passa, e il motivo è più profondo del previsto

Non è un errore di calcolo. È che **l'ACWR non è uno: sono quattro**.

Quattro implementazioni indipendenti nell'API — `analytics.ts`,
`daily-report.ts`, `dashboard.ts`, `game-report.ts` — più la quinta morta in
`packages/utils`. E **solo `dashboard.ts` ha la guardia dei 14 giorni di
storico**: le altre si fermano a "se il cronico è zero non mostro niente".

Il risultato l'ho visto sullo schermo, nello stesso momento, nella stessa
organizzazione:

- **Dashboard, box rischio:** *0 atleti valutabili · 38 non valutabili · 26 con
  meno di due settimane di storico* → nessun allarme.
- **Report giornaliero, stessa giornata:** ACWR **2,44 in rosso** su Amato,
  **1,71** su Fabbri, **1,4** su Lombardi… e sull'Under 14 **"ACWR 3" in rosso su
  ogni singolo giocatore della rosa**.

Il commento che hai scritto tu in `dashboard.ts` descrive esattamente questo:

> *"con tutto il carico nell'ultima settimana viene esatto 3.00 per chiunque, e
> l'intera rosa finisce in rosso il giorno dopo aver iniziato a registrare gli
> RPE."*

La dashboard si difende. Il foglio di fine giornata — quello che il preparatore ha
davanti mentre decide chi far allenare — no.

**La correzione non è aggiungere la guardia in tre punti.** È estrarre **una sola
funzione pura** con dentro la finestra, la formula, le zone e la guardia dei 14
giorni, farla usare a tutti e quattro, testarla una volta, e cancellare quella
morta in `packages/utils`. Finché restano quattro copie, la quinta divergenza è
solo questione di tempo.

## 4. Menu clinici con un infortunio aperto — passano, con una lacuna

La parte difficile funziona. Aprendo il report dell'Under 18 su Amato Carlo
(protocollo RTP in fase 4):

- badge **"da rientro"** accanto al nome;
- banner in cima: *"1 giocatore ha uno stato proposto da infortuni o protocolli di
  rientro. Controlla e correggi prima di salvare"*;
- stato proposto **3 — Carico ridotto**, dedotto dalla fase RTP;
- scheda medica che si apre con nove campi, tutti tradotti;
- **Prossimo allenamento: Parziale**, precompilato ed evidenziato in ambra;
- link **"Apri infortunio"** verso la scheda.

Che *Infortunio*, *Taping*, *Check e trattamento*, *Tipo allenamento* e
*Previsione* restino vuoti **è una scelta esplicita**, scritta nei commenti: sono
giudizi del fisio, non deduzioni. Giusto così.

**La lacuna è `Injury.location`, che a volte è un codice e a volte testo libero.**
I due infortuni aperti del database lo mostrano affiancati:

| Atleta | `location` | Parte anatomica | Lato | Nota mostrata |
|---|---|---|---|---|
| Barbieri Nicola | `knee_r` | **Ginocchio** ✓ | **Destro** ✓ | `knee_r` |
| Amato Carlo | `Avambraccio` | — ✗ | — ✗ | `Avambraccio` |

`mapInjuryLocation` (`daily-report.ts:622`) riconosce il formato
`<parte>_<l|r>` e cerca la parte nella tabella dei codici. Il testo libero non ci
finisce mai, quindi il preparatore deve riscrivere a mano una cosa che il sistema
già sa.

Due code al problema:

1. **Il vocabolario `bodyPart` non ha l'avambraccio.** Ci sono gomito, polso, mano,
   spalla — non l'avambraccio. Anche volendo mappare "Avambraccio", non c'è dove.
2. **La nota mostra il codice grezzo.** Al preparatore compare `knee_r`, non
   "Ginocchio destro".

La correzione sta a monte: normalizzare `location` quando l'infortunio viene
creato, invece di provare a interpretarlo quando viene letto.

## 5. Le tre lingue — passano

Report giornaliero e report partita, chiamati in `it`, `en`, `es`:

| | it | en | es |
|---|---|---|---|
| Giorno | MERCOLEDÌ | WEDNESDAY | MIÉRCOLES |
| Titolo | REPORT GIORNALIERO | DAILY REPORT | INFORME DIARIO |
| Stato 1 | Riabilitazione | Rehab | Rehabilitación |
| Stato 3 | Carico ridotto | Reduced load | Carga reducida |
| Ginocchio | Ginocchio | Knee | Rodilla |

Tutto tradotto: giorni della settimana, etichette di sezione, i sei stati da
"Fuori" a "Allenamento completo", e l'intero vocabolario clinico. Nessun rientro
all'italiano.

**Ritiro il sospetto sulla pagina di login in spagnolo.** Non è un difetto: nel
`localStorage` c'era `trainmind-locale: "es"` con
`trainmind-locale-explicit: "1"`, cioè una scelta fatta a mano. È esattamente la
regola di precedenza documentata in `GUIDA_LINGUA_LOGIN.md`.

---

## Fuori programma: il punto 6 dell'audit, confermato dal vivo

Due chiamate reali all'API locale:

```
GET /api/v1/calendar/events?from=2026-09-02T00:00:00Z&to=2026-09-03T00:00:00Z
GET /api/v1/teams?sortBy=nome
```

Entrambe rispondono:

```json
{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An internal server error occurred"}}
```

**500 invece di 400.** Il calendario è una rotta che il frontend chiama di
continuo: basta un parametro nel formato sbagliato — un `from` con l'ora invece
che `YYYY-MM-DD` — perché l'utente veda "errore del server" e i log si riempiano
di 500 che non sono errori del server.

---

## Dati di prova lasciati sul database locale

Perché la verifica 2 richiedeva una partita vera:

- **gameSession** `cmtieu51z0003igjij00hi9po` sull'evento *pgbk vs reca* del
  01/09/2026: 2 supplementari, 5 giocatori con 50′ e RPE 7-9, punteggio 88-85,
  competizione "Test supplementari", partita chiusa.
- La chiusura ha generato **14 training session datate 01/09/2026**, che entrano
  nel calcolo del carico. Sono quelle che hanno fatto comparire i numeri rossi nel
  report giornaliero — utile per la verifica 3, ma se vuoi il database pulito
  vanno tolte.

Dimmi e le rimuovo.
