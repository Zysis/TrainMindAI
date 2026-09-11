# Console di amministrazione TrainMind — piano di lavoro

Documento di progetto, scritto il 4 settembre 2026 prima di iniziare lo sviluppo.
Riassume lo stato attuale, le decisioni prese e le tre fasi di consegna.

---

## 1. Perche' serve una console nuova

Il ruolo `ADMIN` di TrainMind e' l'amministratore **della singola societa'**, non
della piattaforma. Ogni route dell'API filtra per `organizationId` preso dal token
JWT: e' il cuore dell'isolamento multi-tenant e non va toccato.

Una vista "tutti gli account" e' per definizione una vista che attraversa quel
confine. Per questo non diventa una pagina della dashboard clienti, ma un
back-office separato con una porta d'ingresso propria.

---

## 2. Cosa c'e' gia' nel database (nessun tracciamento aggiuntivo richiesto)

| Tabella | Cosa se ne ricava |
|---|---|
| `organizations` | data di creazione, tier, sport, stato Stripe, scadenza abbonamento |
| `users` | ruolo, `createdAt`, `lastLoginAt`, `isActive`, `deletedAt`, `locale`, consensi |
| `consent_records` | opt-in marketing con versione, IP (→ paese), lingua, revoche |
| `audit_logs` | attivita' reale — ma **solo** sugli endpoint sensibili (atleti, wellness, infortuni, RTP, report, metriche, inviti, GDPR) |
| `ai_usage_logs` | token, costo USD e operazione per societa' → costo reale per account |
| `athlete_invites` | inviti mandati e accettati → viralita' |
| `athletes`, `teams`, `training_sessions`, `wellness_logs`, `field_training_sessions`, `game_sessions` | profondita' d'uso e attivazione |

### Limiti da conoscere

- `audit_logs` **non** copre tutte le funzioni: e' un indicatore parziale di attivita'.
- `lastLoginAt` si aggiorna solo al login, non all'uso.
- La registrazione **non passa da Stripe**: `subscriptionStatus` nasce `inactive`
  anche se l'utente sceglie "ultra". Il tier e' una dichiarazione, non un pagamento.
- Nessuna verifica email → non si sa quanti account siano reali.
- Nessun dato di provenienza: **da dove arrivano gli iscritti oggi non e' sapibile**,
  e non lo sara' mai per gli account gia' creati. L'attribuzione parte dal giorno
  in cui la Fase 2 va in produzione.

---

## 3. Decisioni prese (4 settembre 2026)

| Tema | Decisione |
|---|---|
| Collocazione | App separata `trainmind-app/apps/admin`, Next.js, **porta 3005** (la 3004 e' l'ai-service) |
| Indirizzo | `admin.trainmind-app.com`, servito da Caddy |
| Autenticazione | `basic_auth` di Caddy, credenziali **fuori dal database clienti**. Nessun ruolo nuovo, nessun account cliente che possa scalare privilegi |
| Rete | Raggiungibile da qualsiasi rete (niente lista IP): la console mostra aggregati, non cartelle cliniche |
| Accesso ai dati | Utente Postgres dedicato **`trainmind_reporting`, sola lettura**. La console legge il DB direttamente, **non** passa dall'API pubblica |
| Profondita' dati | Aggregati + elenco societa'. Nomi ed email solo nell'export dei contatti con consenso marketing attivo |
| Verifica email | Soft: l'utente entra subito, vede un avviso finche' non conferma, in console appare "non verificato" |
| Consegna | A fasi, console per prima |

### Conseguenze da mettere in conto

- La v1 e' **sola lettura**: niente "sospendi account" o "cambia tier" dalla
  console. Quelle restano operazioni SQL a mano. Aggiungerle in seguito
  richiedera' un secondo utente DB con permessi di scrittura e un percorso
  di autenticazione piu' solido del basic-auth.
- `api.trainmind-app.com` non guadagna **nessun** endpoint cross-tenant: la
  superficie di attacco dell'API pubblica resta identica a oggi.
- Nessun dato sanitario entra mai nella console: niente atleti, wellness,
  infortuni, RTP. Solo conteggi.

---

## 4. Fase 1 — Console in sola lettura ✅ FATTA (4/9/2026)

Codice in `trainmind-app/apps/admin/`. Messa online: `GUIDA_CONSOLE_ADMIN.md`.
Controlli automatici sulle query: `apps/admin/verifica/LEGGIMI.md`.

Nessuna modifica a `apps/web` e `apps/api`. Solo cartelle nuove.

### 4.1 Struttura

```
trainmind-app/
  apps/
    admin/                    ← nuovo (pnpm lo prende da solo: apps/* in pnpm-workspace.yaml)
      Dockerfile
      package.json            next 14, pg, tailwind, recharts — NON @trainmind/db
      src/app/
        layout.tsx
        page.tsx              Panoramica
        acquisizione/
        attivazione/
        utilizzo/
        societa/              elenco + scheda singola
        costi/
        contatti/             export CSV consensi marketing
      src/lib/db.ts           pool `pg` su DATABASE_URL_READONLY
      src/lib/queries/        una funzione per riquadro, tutte SQL grezzo
      verifica/               controlli automatici sulle query (LEGGIMI.md)
```

### 4.2 Le sei schermate

**Panoramica** — societa' totali e attive, nuove nel mese, utenti totali,
distribuzione per tier, distribuzione per lingua, costo AI del mese, grafico
delle iscrizioni negli ultimi 12 mesi.

**Acquisizione** — nuove societa' per giorno / settimana / mese, per tier e per
lingua. Da Fase 2 si aggiunge la sorgente.

> **Correzione al piano iniziale (4/9/2026):** avevo scritto che il paese si
> poteva dedurre dall'IP salvato nei `consent_records`. E' vero solo in teoria:
> servirebbe un archivio GeoIP a bordo, che su questo VPS non vale il peso ne'
> l'aggiornamento periodico. Il paese arrivera' da Umami nella Fase 3; in Fase 1
> l'unico indizio geografico e' la lingua dichiarata al consenso.

**Attivazione** — la percentuale di societa' che, entro 7 giorni dall'iscrizione,
ha: creato una squadra · aggiunto almeno un atleta · pianificato la prima sessione
· registrato il primo wellness · invitato un atleta. Piu' un imbuto visivo e la
lista delle societa' rimaste ferme al primo passo (i clienti da richiamare).

**Utilizzo** — utenti attivi giornalieri, settimanali e mensili dagli `audit_logs`;
funzioni piu' usate; adozione dell'app atleti (inviti mandati contro accettati);
sopravvivenza per mese di iscrizione.

> **Seconda correzione:** avevo promesso la retention a settimana 1, 4 e 12.
> Non e' ricostruibile: `audit_logs` copre solo gli endpoint sensibili e non
> basta a dire dov'era una societa' tre mesi fa. La console mostra invece,
> per ogni mese di iscrizione, quante di quelle societa' sono state viste negli
> ultimi 30 giorni — e lo dichiara in pagina.

**Societa'** — tabella filtrabile: nome, tier, data di iscrizione, numero utenti,
squadre, atleti, ultima attivita', costo AI, stato abbonamento (la colonna
"verificata" arriva con la Fase 2).
Scheda singola con la stessa cronologia, senza mai un dato di salute.

**Costi e margine** — costo AI per societa' e per operazione dagli `ai_usage_logs`,
costo per account attivo, classifica delle societa' piu' onerose. Quando Stripe
sara' collegato, qui si affianca il ricavo.

**Contatti** — export CSV dei soli utenti con `MARKETING` accettato e non revocato,
incrociato con lo stato di verifica email. E' l'unico punto in cui compaiono nomi
ed email, ed e' l'unico che va trattato come un registro di dati personali.

### 4.3 Sicurezza

```sql
CREATE ROLE trainmind_reporting LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE trainmind TO trainmind_reporting;
GRANT USAGE ON SCHEMA public TO trainmind_reporting;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO trainmind_reporting;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO trainmind_reporting;
```

Caddy:

```
{$ADMIN_DOMAIN} {
	basic_auth {
		{$ADMIN_USER} {$ADMIN_PASSWORD_HASH}
	}
	reverse_proxy admin:3005
	encode gzip
}
```

L'hash si genera con `docker exec trainmind-caddy caddy hash-password`.

### 4.4 Deploy

Servizio `admin` in `docker-compose.deploy.yml`, `container_name: trainmind-admin`,
niente porta pubblicata (ci arriva solo Caddy dalla rete interna). Variabili nuove
in `.env.deploy`: `ADMIN_DOMAIN`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH`,
`DATABASE_URL_READONLY`. Record DNS `admin` su IONOS verso 31.70.77.212.

---

## 5. Fase 2 — Provenienza degli iscritti e verifica email

Qui si tocca `apps/api`, `apps/web` e il sito LAB21. Serve una migrazione.

### 5.1 UTM e referrer

Migrazione su `organizations`:

```
utmSource   String?  @db.VarChar(100)   (indicizzato)
utmMedium   String?  @db.VarChar(100)
utmCampaign String?  @db.VarChar(200)
signupAttribution Json?   -- term, content, referrer, landing, primo contatto
```

- Il sito LAB21 legge i parametri `utm_*` dall'indirizzo e li riattacca ai link
  CTA che portano a `/app/register`, insieme al `document.referrer`.
- `apps/web` registrazione: legge i `searchParams` e li aggiunge al body.
- `registerSchema`: nuovo oggetto `attribution` **opzionale** — le chiamate senza
  quel campo continuano a funzionare esattamente come oggi.
- `POST /auth/register`: salva i campi sull'organizzazione creata.

### 5.2 Verifica email

Migrazione su `users`: `emailVerifiedAt`, `verifyTokenHash` (unique),
`verifyTokenExpiry`. Come per il reset password, nel database va **solo l'hash
SHA-256** del token: in chiaro esiste unicamente nel link spedito.

- Alla registrazione parte l'email via Resend (dominio gia' verificato,
  mittente `noreply@trainmind-app.com`).
- `GET /auth/verify-email?token=...` valorizza `emailVerifiedAt`.
- `POST /auth/resend-verification`, con limite di frequenza.
- `apps/web`: striscia di avviso finche' `emailVerifiedAt` e' nullo, con pulsante
  per rimandare il link. Nessun blocco: l'utente lavora normalmente.
- Console: colonna "verificata" e filtro nell'export contatti.

### 5.3 Ultima attivita' reale

`lastActiveAt` su `users`, aggiornato da un hook dell'API al massimo una volta
all'ora per utente. Costo trascurabile, e sostituisce l'approssimazione basata
sugli `audit_logs`.

---

## 6. Fase 3 — Analytics del sito

Umami self-hosted: container sul VPS, database `umami` sullo stesso Postgres,
servito su `stats.trainmind-app.com`. E' cookieless, quindi non richiede il
consenso del banner. Traccia il sito vetrina e `/app`.

Sblocca l'imbuto completo: visita → registrazione → attivazione, e la resa di
ogni campagna incrociando gli UTM della Fase 2.

**Attenzione al costo**: il VPS IONOS passa da 6,10 a 21,96 €/mese il 14/10/2026.
Umami e' leggero (~100 MB di RAM), ma va deciso insieme al rinnovo.

---

## 7. Da verificare

1. ~~Stripe e' in produzione?~~ **Verificato il 4/9/2026: no.**
   `STRIPE_SECRET_KEY` e' vuota in `/opt/trainmind/trainmind-app/.env.deploy`.
   Nessuna registrazione passa da un pagamento, quindi il piano e' una
   dichiarazione dell'utente e MRR, churn e conversione non sono calcolabili.
   Nella console i riquadri ci sono ma dicono per quale motivo sono vuoti.
2. **Registrazione pubblica**: `DISABLE_REGISTRATION` e' attivo in produzione?
   Cambia il senso delle metriche di acquisizione.
3. **Volume attuale**: quante societa' e quanti utenti ci sono davvero oggi.
   Sotto le dieci, alcuni grafici sono rumore e conviene mostrare tabelle.

---

## 8. Riferimenti

- Porte: 3000 web · 3001 api · 3002 mobile · 3003 athlete · 3004 ai-service · **3005 admin**
- Deploy e aggiornamenti: `GUIDA_DEPLOY_TEST.md`, `GUIDA_AGGIORNAMENTI.md`
- Assetto domini: sezione 1c di `GUIDA_AGGIORNAMENTI.md`
