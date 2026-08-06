# TrainMind AI — Tokenizzazione e controllo dei costi AI

**Documento di specifica tecnica ed economica**
Versione 1.0 — 28 luglio 2026
Stato: proposta, da approvare prima dell'implementazione

---

## 1. Sintesi e raccomandazione

L'obiettivo è evitare che il consumo AI eroda il margine, senza acquistare un server GPU.

**Raccomandazione: misurare e tagliare prima di tassare.**

Il sistema di crediti prepagati con ricarica è una scelta valida, ma non è il primo passo. Due interventi molto più semplici — il routing per modello e il cap sullo storico chat — riducono il costo AI di circa un ordine di grandezza. Dopo quegli interventi è plausibile che il problema economico si ridimensioni al punto da non giustificare un sistema di crediti completo.

Il piano proposto è in tre fasi, con un criterio esplicito per decidere se la terza vada fatta.

| Fase | Contenuto | Effort | Impatto utente | Quando |
|---|---|---|---|---|
| **0** | Routing modelli + logging consumo reale | 1–2 giorni | Nessuno | Subito |
| **1** | Quota soft per tier + alert | 2–3 giorni | Basso | Prima della beta |
| **2** | Wallet crediti + ricarica Stripe | 4–5 giorni | Alto | Solo se i dati la giustificano |

**Nota sulla redditività:** la ricarica non è un centro di ricavo significativo ai volumi previsti. Il suo valore reale è duplice: (a) mettere un tetto alla coda di consumo anomalo, (b) creare un percorso di upgrade naturale tra i piani. L'expansion revenue da passaggio BASE → PRO → ULTRA vale più della vendita di pacchetti.

---

## 2. Stato attuale del codice

### 2.1 Percorsi di chiamata AI

Esistono **due** percorsi verso OpenAI, non uno. Qualsiasi sistema di misura deve coprirli entrambi.

```
[web / mobile]
      │
      ▼
[apps/api]  apps/api/src/routes/ai.ts
      │
      ├──► proxyToAI() ──► [ai-service :3002] ──► LLMClient ──► OpenAI
      │                     (percorso normale, con RAG)
      │
      └──► openai-fallback.ts ──────────────────────────────► OpenAI
            (percorso di emergenza quando l'ai-service è giù, senza RAG)
```

- `apps/api/src/routes/ai.ts` — proxy con retry e timeout (`proxyToAI`), autenticazione su tutte le route via hook `preHandler`.
- `apps/api/src/lib/openai-fallback.ts` — chiama `https://api.openai.com/v1/chat/completions` direttamente con `fetch`. Usa `process.env.OPENAI_MODEL` (default `gpt-4o`). Esporta `openAIGenerate`, `openAIChat`, `isOpenAIFallbackAvailable`.
- `apps/ai-service/app/clients/openai_client.py` — `LLMClient`, singleton dual-provider.

### 2.2 Endpoint AI e consumo

| Endpoint API | Router ai-service | `max_tokens` | Guardia attuale |
|---|---|---|---|
| `POST /ai/chat` | `chat.py` | 2048 (configurabile 100–4096) | solo auth |
| `POST /ai/coach` | `coach.py` | 2048 | solo auth |
| `POST /ai/generate` | `generate.py` | 3000 | `requireMinRole('TRAINER')` |
| `POST /ai/wellness-insights` | `coach.py` (riuso) | 2048 | solo auth |
| `POST /ai/rtp-suggest` | `rtp.py` | 2048 | `requireMinRole('TRAINER')` |
| report AI (`routes/reports.ts`) | `reports.py` | 600 | route report |

**Nessun endpoint è oggi limitato per tier.** Un'organizzazione STARTER ha lo stesso accesso all'AI di una ULTRA.

> **Attenzione al routing.** `/ai/wellness-insights` non ha un router dedicato: l'API costruisce un riepilogo dai `WellnessLog` (fino a 100 record, quindi input non trascurabile) e poi chiama `proxyToAI('/ai/coach', …)`. Due operazioni distinte condividono lo stesso endpoint dell'ai-service. Di conseguenza **la scelta del modello non può essere dedotta dall'endpoint**: va passata esplicitamente dall'API come parametro nel body, altrimenti wellness e coach finiscono per forza sullo stesso modello.

### 2.3 Problemi rilevati

1. **Il consumo non viene persistito.** `openai_client.py::_openai_chat` legge `response.usage.prompt_tokens` e `completion_tokens`, li scrive nel log e li scarta. `app/services/metrics.py` tiene un contatore, ma **solo in memoria**: si azzera a ogni restart del processo e non è attribuito per organizzazione. Oggi non esiste modo di sapere quanto costa un cliente.

2. **Il percorso `openai-fallback.ts` è completamente invisibile.** Non passa dall'ai-service, quindi nessuna metrica lo vede.

3. **`LOCAL_LLM_ENABLED` non è impostato in `.env`.** Il default in `app/config.py` è `local_llm_enabled: bool = True`, ma in deploy non esiste alcun server llama-cpp. Risultato: `_check_local_health()` fallisce a ogni chiamata prima del fallback su OpenAI — latenza aggiunta inutilmente.

4. **Lo storico chat non è troncato.** `aiChatSchema` accetta `messages` come array senza limite superiore. Il costo di input di `/ai/chat` cresce linearmente con la lunghezza della conversazione, e il totale della sessione cresce quadraticamente.

5. **Lo streaming non riporta l'uso.** `chat.py::generate_sse_stream` accumula il contenuto in `content_buffer` ma non riceve alcun oggetto `usage`: le API OpenAI in streaming non lo inviano se non si richiede esplicitamente `stream_options: {"include_usage": true}`.

### 2.4 Cosa esiste già e va riusato

- **Stripe**: `apps/api/src/routes/billing.ts` ha checkout, customer portal, webhook con gestione di `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`. `PRICING_TIERS` con `starter` / `professional` / `ultra`.
- **Prisma**: enum `OrganizationTier { STARTER, PROFESSIONAL, ULTRA }`, campi `subscriptionTier`, `subscriptionStatus`, `subscriptionEndsAt`, `stripeCustomerId` su `Organization`.
- **Rate limiting**: `@fastify/rate-limit` già registrato in `apps/api/src/app.ts`.
- **Cache Redis**: `apps/ai-service/app/services/cache.py` (`cache_get` / `cache_set`), oggi usata solo per gli embedding.

### 2.5 Consumatori frontend

| App | File |
|---|---|
| web | `hooks/use-chat.ts`, `components/ai/ai-generate-modal.tsx`, `ai-coach-panel.tsx`, `ai-wellness-insights.tsx`, `app/dashboard/injuries/page.tsx` |
| mobile | stessi file sotto `trainmind-mobile/web/src/` (copie indipendenti) |
| athlete | nessun consumo AI diretto |
| SDK | `packages/ai-sdk/src/client.ts` |

Ogni modifica alla UI va replicata su web e mobile: i pacchetti sono copie, non symlink.

---

## 3. Analisi economica

### 3.1 Prezzi di riferimento (luglio 2026)

| Modello | Input / 1M token | Output / 1M token |
|---|---|---|
| `gpt-4o` | $2,50 | $10,00 |
| `gpt-4o-mini` | $0,15 | $0,60 |
| `text-embedding-3-small` | ~$0,02 | — |

Rapporto di costo `gpt-4o` / `gpt-4o-mini`: circa **16x**.

### 3.2 Costo per operazione

Stime basate sui `max_tokens` presenti nel codice e su un contesto RAG di 3–4k token. Cambio approssimato 1 USD ≈ 1 EUR.

| Operazione | Input | Output | `gpt-4o` | `gpt-4o-mini` |
|---|---|---|---|---|
| Generazione piano | ~4.000 | ~2.500 | 0,035 € | 0,0022 € |
| Coach Q&A | ~3.000 | ~1.500 | 0,023 € | 0,0014 € |
| Messaggio chat | 2.000–10.000 | 1.200–2.000 | 0,017–0,045 € | 0,0011–0,0027 € |
| Suggerimento RTP | ~3.000 | ~1.500 | 0,023 € | 0,0014 € |
| Wellness / report | ~2.000 | ~600 | 0,011 € | 0,0007 € |

### 3.3 Profili di consumo mensile

**Utente tipico** (una squadra, uso quotidiano regolare):

| Attività | Volume/mese | Costo `gpt-4o` |
|---|---|---|
| Piani generati | 12 | 0,42 € |
| Messaggi chat | 110 | 3,30 € |
| Coach / adattamenti | 20 | 0,45 € |
| Wellness insights | 30 | 0,33 € |
| **Totale** | | **≈ 4,50 €** |

Su un piano PRO da 59 €: **7,6% del ricavo**. Sostenibile.

Il costo della chat dipende dalla lunghezza media delle conversazioni: il totale oscilla tra **3,7 € e 6,2 €** tra conversazioni corte e conversazioni lunghe non troncate. È esattamente la variabile che il cap sullo storico (§ 7, punto 0.9) mette sotto controllo.

**Utente della coda** (uso intensivo della chat, 500 messaggi/mese):

| Scenario | Costo/mese | % di un piano da 59 € | % di un piano da 29 € |
|---|---|---|---|
| Tutto su `gpt-4o` | 12–24 € | 20–40% | 41–82% |
| Con routing mini/full | 1,00–1,80 € | 2–3% | 3–6% |

(Il residuo con routing è dominato dalle 12 generazioni di piano, che restano su `gpt-4o`: 0,42 €. Tutto il resto scende sotto 1,40 €.)

**Il problema non è la media, è la coda.** E il routing per modello, da solo, la elimina quasi del tutto.

### 3.4 Impatto atteso degli interventi

| Intervento | Riduzione costo | Effort |
|---|---|---|
| Routing `gpt-4o-mini` su chat/wellness/report | ~88% (4,50 € → 0,76 €) | ~2 ore |
| Cap storico chat a 10 messaggi | ~20–30% sul residuo | ~1 ora |
| Cache Redis su risposte identiche | 5–15% | ~3 ore |
| Quota per tier | tappa la coda | ~2 giorni |
| Wallet + ricarica | nessuna riduzione, converte l'eccesso in ricavo | ~5 giorni |

### 3.5 Confronto con l'ipotesi GPU

| Voce | VPS con GPU | API OpenAI (post-routing) |
|---|---|---|
| Costo fisso | 150–300 €/mese | 0 € |
| Costo variabile | ~0 | ~0,80 €/org/mese |
| Break-even | — | ~190–375 org attive |
| Manutenzione | alta (modello, driver, aggiornamenti) | nulla |

**La scelta di restare su API è corretta e lo resterà a lungo.** Il codice dual-provider in `openai_client.py` va comunque conservato: mantiene aperta l'opzione senza costi.

---

## 4. Modello proposto: crediti per azione

### 4.1 Principio

**Non esporre mai il token all'utente.** L'unità visibile è il **Credito AI**, e ogni azione ha un costo fisso in crediti.

Motivazioni:

1. Il preparatore fisico non sa cosa sia un token e non può prevederne il consumo.
2. Un costo fisso per azione è prevedibile: "mi restano 40 crediti = 8 piani" è comprensibile, "mi restano 82.000 token" no.
3. Disaccoppia il prezzo dal modello. Puoi passare da `gpt-4o` a un modello diverso, o cambiare provider, senza ri-prezzare nulla.
4. Il margine si costruisce nel tasso di conversione, non nella trattativa.

Internamente si continua a registrare il consumo reale in token per monitorare il margine. Le due unità restano separate.

### 4.2 Tariffario proposto

| Operazione | Crediti | Costo reale (mini) | Costo reale (4o) |
|---|---|---|---|
| Messaggio chat | 1 | 0,0010–0,0027 € | 0,017–0,045 € |
| Wellness insight | 1 | 0,0014 € | 0,023 € |
| Report AI | 2 | 0,0007 € | 0,011 € |
| Suggerimento coach | 2 | 0,0014 € | 0,023 € |
| Suggerimento RTP | 3 | — | 0,023 € |
| Generazione piano | 5 | — | 0,035 € |

Con il routing, l'utente tipico consuma ~240 crediti/mese per ~0,76 € di costo reale: **~0,003 € per credito**. Un pacchetto da 100 crediti venduto a 9 € ha un margine lordo superiore al 90%, ma va prezzato guardando al **valore percepito** (100 crediti ≈ 20 piani di allenamento), non al costo.

### 4.3 Regole

- I crediti inclusi nell'abbonamento **non si accumulano** tra i cicli (use it or lose it).
- I crediti acquistati con ricarica **si accumulano** e scadono a 12 mesi.
- Il reset dei crediti inclusi avviene alla data di rinnovo dell'abbonamento, non il primo del mese.
- **Un errore non costa crediti.** Se l'AI fallisce (timeout, 5xx, `AI_SERVICE_DOWN`), i crediti riservati vengono rilasciati.

> **Nota fiscale.** La vendita di crediti prepagati genera un ricavo differito e una passività verso il cliente. In regime forfettario, che è per cassa, la gestione è più semplice, ma la scadenza a 12 mesi serve a non tenere aperta una passività a tempo indeterminato. **Punto da verificare con il commercialista prima del lancio della Fase 2** — questo documento non è consulenza fiscale.

### 4.4 Struttura dei piani proposta

| | BASE | PRO | ULTRA |
|---|---|---|---|
| Prezzo indicativo | 19–29 € | 49–79 € | 99–149 € |
| Crediti inclusi/mese | **15** | 300 | 1.200 |
| Ricarica | no | sì | sì, tariffa migliore |
| Modelli | mini | mini + 4o | mini + 4o |

**Il punto più importante di questa tabella è la riga BASE.** Un piano BASE senza alcuna AI vende male in un prodotto chiamato TrainMind *AI*: il cliente non capisce cosa sta comprando e non ha un motivo concreto per salire di piano. 15 crediti/mese costano circa **0,15 €** con `gpt-4o-mini` e sono il canale di upsell più economico disponibile.

---

## 5. Architettura

### 5.1 Dove va l'enforcement

**Nell'API Fastify (`apps/api`), non nell'ai-service.**

| | `apps/api` | `ai-service` |
|---|---|---|
| Conosce `organizationId` | sì (`request.user`) | no |
| Ha accesso a Prisma | sì (`app.prisma`) | no |
| Vede il percorso fallback | sì | no |
| Stato | con stato | stateless |

L'ai-service resta stateless e ignaro dei crediti. Il suo unico compito aggiuntivo è **restituire l'uso reale dei token** nella risposta.

### 5.2 Flusso di una chiamata

```
1. PREFLIGHT   aiQuotaGuard (preHandler in ai.ts)
               ├─ legge tier e saldo dell'organizzazione
               ├─ se saldo < costo azione → 402 QUOTA_EXCEEDED
               └─ riserva i crediti (transazione PENDING)
                     │
2. ESECUZIONE  proxyToAI() oppure openai-fallback
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
     successo                  errore
        │                         │
3. COMMIT                    3. REFUND
   scrive AiUsageLog             rilascia la riserva
   con token reali               nessun addebito
   converte la riserva
   in CONSUME
```

### 5.3 Il caso streaming

`/ai/chat` con `stream: true` è l'unico caso non banale: la risposta viene inoltrata a `reply.raw` come SSE e i token di output non sono noti in anticipo.

Soluzione: aggiungere `stream_options: {"include_usage": true}` alla chiamata OpenAI in `openai_client.py::_openai_chat_stream`. OpenAI invia allora un chunk finale con l'oggetto `usage`, che `generate_sse_stream` inoltra come nuovo evento SSE `{"type": "usage", ...}` prima dell'evento `done`. L'API lo intercetta mentre fa da pipe e chiude la transazione.

Ripiego se l'integrazione risulta fragile: addebitare il costo nominale dell'azione (1 credito) e registrare i token stimati con `tiktoken`, già presente tra le dipendenze di `openai_client.py`.

---

## 6. Schema dati

Da aggiungere in `packages/db/prisma/schema.prisma`. Convenzione migration del repo: `YYYYMMDDHHMMSS_descrizione`.

```prisma
enum AiCreditTxType {
  GRANT     // crediti inclusi assegnati al rinnovo
  TOPUP     // ricarica acquistata
  CONSUME   // consumo di un'azione
  REFUND    // rilascio dopo errore AI
  EXPIRE    // scadenza a 12 mesi
  ADJUST    // rettifica manuale
}

enum AiOperation {
  CHAT
  COACH
  GENERATE
  WELLNESS
  RTP
  REPORT
}

/// Registro del consumo reale — sempre scritto, anche in Fase 0.
model AiUsageLog {
  id             String      @id @default(cuid())
  organizationId String
  userId         String?
  operation      AiOperation
  endpoint       String      // "/ai/chat"
  model          String      // "gpt-4o-mini"
  provider       String      @default("openai") // openai | local | fallback
  promptTokens   Int         @default(0)
  completionTokens Int       @default(0)
  totalTokens    Int         @default(0)
  costUsd        Decimal     @db.Decimal(10, 6) @default(0)
  creditsCharged Int         @default(0)
  success        Boolean     @default(true)
  errorCode      String?
  durationMs     Int?
  createdAt      DateTime    @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, createdAt])
  @@index([organizationId, operation])
  @@map("ai_usage_logs")
}

/// Saldo crediti — introdotto solo in Fase 2.
model AiCreditWallet {
  id               String   @id @default(cuid())
  organizationId   String   @unique
  balance          Int      @default(0)  // crediti acquistati, con rollover
  includedBalance  Int      @default(0)  // crediti del piano, senza rollover
  includedPerCycle Int      @default(0)
  cycleResetAt     DateTime?
  reserved         Int      @default(0)  // riservati e non ancora confermati
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization Organization           @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  transactions AiCreditTransaction[]

  @@map("ai_credit_wallets")
}

model AiCreditTransaction {
  id             String         @id @default(cuid())
  walletId       String
  organizationId String
  type           AiCreditTxType
  amount         Int            // positivo = accredito, negativo = addebito
  balanceAfter   Int
  operation      AiOperation?
  usageLogId     String?
  stripePaymentIntentId String?
  expiresAt      DateTime?
  note           String?
  createdAt      DateTime       @default(now())

  wallet AiCreditWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)

  @@index([organizationId, createdAt])
  @@index([stripePaymentIntentId])
  @@map("ai_credit_transactions")
}
```

Su `Organization` si aggiungono le relazioni inverse `aiUsageLogs AiUsageLog[]` e `aiCreditWallet AiCreditWallet?`.

**In Fase 0 si crea solo `AiUsageLog` e l'enum `AiOperation`.** Wallet e transazioni arrivano in Fase 2, se si arriva alla Fase 2.

---

## 7. Piano di implementazione

### Fase 0 — Taglio dei costi e osservabilità

**Effort: 1–2 giorni. Impatto sull'utente: nessuno. Deployabile da sola.**

Questa fase va fatta a prescindere da ogni decisione successiva.

| # | Intervento | File |
|---|---|---|
| 0.1 | `LOCAL_LLM_ENABLED=false` in produzione | `.env`, `.env.deploy.example`, `docker-compose.deploy.yml` |
| 0.2 | Mappa operazione → modello, con override da env. Il modello va passato dall'API nel body (vedi § 2.2), non dedotto dall'endpoint | `apps/api/src/routes/ai.ts`, `apps/ai-service/app/config.py`, `clients/openai_client.py`, `models/schemas.py` |
| 0.3 | Restituire `usage` dalle chat completion invece di scartarlo | `clients/openai_client.py` (`_openai_chat`, `_local_chat`) |
| 0.4 | Propagare `usage` nelle risposte dei router | `routers/chat.py`, `coach.py`, `generate.py`, `rtp.py`, `reports.py`, `models/schemas.py` |
| 0.5 | `stream_options: {include_usage: true}` + evento SSE `usage` | `clients/openai_client.py`, `routers/chat.py` |
| 0.6 | Modello `AiUsageLog` + migration | `packages/db/prisma/schema.prisma` |
| 0.7 | Helper `recordAiUsage()` e scrittura post-chiamata | nuovo `apps/api/src/services/ai-usage.ts`, `routes/ai.ts` |
| 0.8 | Coprire anche il percorso di emergenza | `apps/api/src/lib/openai-fallback.ts` |
| 0.9 | Cap storico chat a 10 messaggi | `apps/api/src/schemas/ai.ts` (`aiChatSchema`) |
| 0.10 | Endpoint `GET /ai/usage` per il proprio monitoraggio | `routes/ai.ts` |

**Routing proposto (0.2):**

| Operazione | Modello | Motivo |
|---|---|---|
| chat | `gpt-4o-mini` | conversazione, tolleranza alta |
| wellness-insights | `gpt-4o-mini` | output breve e strutturato — richiede il parametro esplicito, condivide `/ai/coach` |
| report | `gpt-4o-mini` | 600 token, sintesi |
| coach | `gpt-4o-mini` | valutare in beta, eventualmente promuovere |
| generate (piano) | `gpt-4o` | output lungo e strutturato, la qualità paga |
| rtp-suggest | `gpt-4o` | ambito clinico, nessun compromesso |

Le assegnazioni vanno esposte come variabili d'ambiente (`AI_MODEL_CHAT`, `AI_MODEL_GENERATE`, …) per poterle cambiare senza rideploy del codice.

**Verifica di fine fase:** dopo il deploy, `GET /ai/usage` deve mostrare token e costo per organizzazione, e il totale deve riconciliare con la dashboard di fatturazione OpenAI a meno del 5%.

---

### Fase 1 — Quota soft per tier

**Effort: 2–3 giorni. Prerequisito: Fase 0 in produzione da almeno 2 settimane.**

Nessun pagamento, nessun wallet, nessuna tabella nuova. Il contatore del ciclo si ricava aggregando `AiUsageLog`.

| # | Intervento | File |
|---|---|---|
| 1.1 | Tabella costi in crediti per operazione | nuovo `apps/api/src/lib/ai-credits.ts` |
| 1.2 | `aiQuotaGuard` come `preHandler` | nuovo `apps/api/src/middleware/ai-quota.ts`, `routes/ai.ts` |
| 1.3 | Allowance per tier, da env | `apps/api/src/lib/config.ts` |
| 1.4 | `GET /ai/quota` — consumo, residuo, data di reset | `routes/ai.ts` |
| 1.5 | Errore `402 AI_QUOTA_EXCEEDED` con messaggio utile | `routes/ai.ts`, `lib/api-errors.ts` |
| 1.6 | Notifica all'80% e al 100% | `services/push-notification-service.ts`, modello `Notification` |
| 1.7 | Badge consumo + stato esaurito nella UI | web e mobile: `components/ai/*`, `hooks/use-chat.ts` |

**Degradazione morbida.** A quota esaurita si disattiva l'AI, non l'applicazione: piani, calendario, wellness, report non-AI e tracking restano pienamente operativi. I pulsanti AI passano a uno stato disabilitato con spiegazione e link all'upgrade. Nessuna schermata di errore.

**Verifica di fine fase:** simulare un'organizzazione a quota esaurita e verificare che tutti i flussi non-AI restino percorribili end-to-end.

---

### Fase 2 — Wallet e ricarica

**Effort: 4–5 giorni. Da avviare solo se ricorre almeno una delle condizioni al § 8.**

| # | Intervento | File |
|---|---|---|
| 2.1 | Modelli `AiCreditWallet`, `AiCreditTransaction` + migration | `schema.prisma` |
| 2.2 | Servizio wallet: `reserve` / `commit` / `refund` / `grant` / `expire` | nuovo `apps/api/src/services/ai-wallet.ts` |
| 2.3 | Sostituire il conteggio della Fase 1 con il saldo del wallet | `middleware/ai-quota.ts` |
| 2.4 | Pacchetti ricarica + Stripe `mode: 'payment'` | `routes/billing.ts` (`PRICING_TIERS` → aggiungere `CREDIT_PACKS`) |
| 2.5 | Webhook `payment_intent.succeeded` → accredito | `routes/billing.ts` |
| 2.6 | `GRANT` dei crediti inclusi al rinnovo abbonamento | webhook `customer.subscription.updated` |
| 2.7 | Job di scadenza a 12 mesi | pattern di `services/retention-worker.ts` |
| 2.8 | UI ricarica: saldo, pacchetti, storico movimenti | web e mobile |

**Idempotenza.** Il webhook Stripe può arrivare più volte per lo stesso evento. `stripePaymentIntentId` va vincolato come unique su `AiCreditTransaction` e l'accredito deve essere idempotente, altrimenti un retry di Stripe raddoppia i crediti.

**Concorrenza.** `reserve` e `commit` devono girare dentro una transazione Prisma con lock sulla riga del wallet, altrimenti due chiamate AI parallele possono entrambe passare il controllo di saldo e portarlo in negativo.

**Verifica di fine fase:** test di concorrenza con N chiamate parallele a saldo quasi esaurito; test di doppio invio del webhook; test di rimborso su timeout dell'ai-service.

---

## 8. Criterio di decisione per la Fase 2

Dopo almeno 4 settimane di beta con la Fase 1 attiva, si estraggono i dati da `AiUsageLog` e si verifica:

| # | Condizione | Soglia |
|---|---|---|
| A | Organizzazioni che raggiungono il tetto mensile | **> 15%** |
| B | Costo AI medio per organizzazione sul prezzo del piano | **> 10%** |
| C | Richieste esplicite di acquistare più AI | **≥ 3** |

**Se nessuna condizione è vera, la Fase 2 non si fa.** La Fase 1 è già sufficiente a proteggere il margine, e il tempo va investito sul prodotto.

Se è vera solo la A, valutare prima di tutto se alzare l'allowance: significa che i tetti sono tarati troppo stretti, non che serve un negozio di crediti.

---

## 9. Rischi

| Rischio | Impatto | Mitigazione |
|---|---|---|
| L'ansia da contatore riduce l'uso, quindi il valore percepito, quindi la retention | **Alto** | Allowance tarata perché il 90% degli utenti non veda mai il tetto. Il limite esiste per la coda, non per disciplinare tutti |
| Perdita di qualità percepita col passaggio a `gpt-4o-mini` | Medio | A/B durante la beta su coach e chat; `generate` e `rtp` restano su `gpt-4o`; override per operazione via env |
| Rimborso mancato su errore AI → utente pagante penalizzato | **Alto** | Test dedicato su timeout e 5xx; `proxyToAI` ha già retry, il refund va nel `catch` e nel `finally` |
| Doppio accredito da retry del webhook Stripe | Medio | Vincolo unique su `stripePaymentIntentId` |
| Race condition su chiamate AI parallele | Medio | Transazione con lock di riga sul wallet |
| Divergenza tra UI web e mobile | Basso | I pacchetti sono copie: ogni modifica va replicata, verifica esplicita in checklist |
| Variazione dei prezzi OpenAI | Medio | I costi sono in configurazione, non nel codice; `AiUsageLog.costUsd` permette di ricalcolare il margine storico |

---

## 10. Checklist di deploy

**Fase 0**

- [ ] Migration `AiUsageLog` applicata su staging e verificata
- [ ] `LOCAL_LLM_ENABLED=false` in `.env` di produzione
- [ ] Variabili `AI_MODEL_*` impostate
- [ ] `GET /ai/usage` risponde e i numeri riconciliano con la dashboard OpenAI
- [ ] Percorso `openai-fallback` verificato spegnendo l'ai-service
- [ ] Streaming chat: l'evento `usage` arriva e viene registrato
- [ ] Nessuna regressione sui 6 endpoint AI

**Fase 1**

- [ ] Allowance per tier configurate e documentate
- [ ] Organizzazione a quota esaurita: tutti i flussi non-AI funzionanti
- [ ] Notifiche 80% / 100% ricevute
- [ ] Badge consumo allineato tra web e mobile
- [ ] Utente BASE: i 15 crediti di assaggio funzionano e l'upsell è visibile

**Fase 2**

- [ ] Pacchetti creati su Stripe (test e live)
- [ ] Webhook `payment_intent.succeeded` registrato sull'endpoint di produzione
- [ ] Doppio invio dello stesso webhook non raddoppia i crediti
- [ ] N chiamate parallele a saldo 1 non portano il saldo sotto zero
- [ ] Timeout dell'ai-service rimborsa i crediti riservati
- [ ] Job di scadenza schedulato e testato
- [ ] Termini di servizio aggiornati con scadenza crediti e politica di rimborso
- [ ] Trattamento fiscale dei crediti prepagati confermato dal commercialista

---

## 11. Sintesi delle decisioni aperte

| # | Decisione | Proposta | Da decidere |
|---|---|---|---|
| 1 | AI nel piano BASE | 15 crediti/mese di assaggio | Prima della Fase 1 |
| 2 | Allowance PRO e ULTRA | 300 / 1.200 crediti | Con i dati della Fase 0 |
| 3 | Prezzo dei pacchetti | 100 cr → 9 € (da validare) | Con i beta tester |
| 4 | `coach` su mini o 4o | mini, da rivalutare in beta | Con i dati della Fase 0 |
| 5 | Scadenza crediti acquistati | 12 mesi | Con il commercialista |

Le decisioni 2, 3 e 4 **non vanno prese ora**: dipendono da dati che oggi non esistono e che la Fase 0 produce in quattro settimane.

---

## Fonti

- OpenAI API pricing — https://pricepertoken.com/pricing-page/model/openai-gpt-4o e https://pricepertoken.com/pricing-page/model/openai-gpt-4o-mini
- Riferimenti interni: `documentation/TrainMind_AI_Guida_Monetizzazione.docx` (struttura piani e setup fiscale), `AISERVICE_SUMMARY.md`, `AI_SERVICE_CHECKLIST.md`
