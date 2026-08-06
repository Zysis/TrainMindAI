# Sistema di marketing LAB21 → TrainMind

**Documento operativo — versione 2.0 — 5 agosto 2026**
Base: *Piano_30_giorni_marketing_webapp_basket_AI.pdf*, riscritto su tre vincoli reali: **distribuzione social**, **nessun CRM e nessuna call di vendita**, **beta tester professionisti già attivi sul prodotto**.

> **Cosa cambia rispetto alla v1.0**
> Il motore non è più outbound 1:1 con demo telefoniche. È **social-first e product-led**: i contenuti social portano traffico, la landing raccoglie l'iscrizione in un database SQL, il prodotto si vende da solo attraverso una prova self-serve, e le email automatiche fanno il lavoro che nella v1.0 facevano le call.
> Conseguenza diretta: **il collo di bottiglia si sposta dalla tua agenda al prodotto.** Se l'onboarding non porta un utente al primo report in dieci minuti da solo, il sistema non converte — e non c'è nessuna telefonata a rimediare.

---

## 0. Come leggere questo documento

È la descrizione di una macchina: cosa entra (un preparatore che scorre Instagram), cosa esce (un abbonamento attivo), e quali pezzi devono esistere perché il passaggio avvenga **senza che tu debba parlare con nessuno**.

Sezioni 1–5: decisioni da prendere una volta e non toccare per 90 giorni.
Sezioni 6–11: il lavoro operativo, settimana per settimana.

---

## 1. La strategia in una pagina

### Il modello a due fasi

Hai scelto di presentare prima LAB21, creare curiosità su TrainMind, e spostare il focus sul prodotto quando sarà commerciabile. Corretto per un pubblico piccolo, competente e diffidente verso l'"AI nello sport". Con un rischio preciso da neutralizzare.

**Il rischio:** costruire pubblico per un laboratorio e poi doverlo convertire a un software. Sono due asset diversi. Amplificato dal social: su Instagram raggiungi giocatori, genitori e appassionati — non compratori.

**La neutralizzazione:** i social servono per **ampiezza di distribuzione**, la landing serve per **restringere**. Il contenuto può piacere a mille persone; il modulo di iscrizione chiede ruolo, società e categoria, e **conta solo chi si qualifica**. Alla fine della Fase 1 non ti servono follower: ti servono **80–120 righe qualificate nel database**.

| | **Fase 1 — LAB21 apre** | **Fase 2 — TrainMind vende** |
|---|---|---|
| **Durata** | Settimane 1–6 | Dalla settimana 7 |
| **Chi parla** | LAB21, il laboratorio | TrainMind, il prodotto |
| **Obiettivo** | Credibilità + lista d'attesa qualificata | Registrazioni, attivazioni, primi abbonamenti |
| **Promessa** | "Traduciamo la scienza dello sport in strumenti usabili il lunedì mattina" | "Il report di squadra in dieci minuti invece che in tre ore" |
| **CTA unica** | *Entra nella lista d'attesa* | *Prova TrainMind — 21 giorni, senza carta* |
| **KPI primario** | 80–120 iscritti qualificati | 40+ registrazioni, 20+ attivati, 3–6 paganti |
| **Cosa NON fare** | Vendere. Mai prezzi in Fase 1 | Parlare di AI prima del problema |

### Le due regole che tengono insieme tutto

> **1. Prima il problema risolto, poi lo strumento, poi la tecnologia.**
> L'AI è l'ultimo argomento, mai il primo. "AI per il basket" attiva scetticismo. "Tre ore di report che diventano dieci minuti" attiva desiderio.

> **2. Ogni contenuto ha un solo compito: portare a un'iscrizione qualificata.**
> Non like, non follower, non commenti. Se un formato non produce iscrizioni in tre settimane, si taglia — anche se ha numeri belli.

### Il modello di vendita: cosa sostituisce cosa

Poiché non ci sono call, ogni funzione che di solito fa un venditore deve essere svolta da un asset. Questa tabella è il cuore della v2.0.

| Cosa fa di solito una call | Chi lo fa qui |
|---|---|
| Spiega cosa fa il prodotto | Video demo 3 minuti + report PDF di esempio |
| Costruisce fiducia | Contenuti LAB21 + beta tester reali che appaiono nei contenuti |
| Qualifica il cliente | Le domande del modulo di iscrizione (ruolo, società, categoria, n° atleti) |
| Fa il setup iniziale | Import CSV/Excel del roster + modalità dimostrativa precaricata |
| Gestisce le obiezioni | Pagina FAQ + pagina "come funziona l'AI" + email di sequenza |
| Fa follow-up | Email lifecycle automatiche (Resend, già configurato) |
| Chiede la firma | Checkout Stripe self-serve |
| Convince la società | PDF di una pagina scaricabile, pronto da girare al DS |

**Se uno di questi asset manca, quella funzione semplicemente non viene svolta e il lead si perde in silenzio.** È l'unico vero rischio del modello senza call: il fallimento è invisibile. Per questo la §9 (misurazione SQL) non è opzionale.

---

## 2. Brand system

### 2.1 Architettura di marca

```
FASE 1                          FASE 2

   LAB21                          TrainMind
  (in vetrina)                    (in vetrina)
      │                               │
      └── TrainMind                   └── by LAB21
       (teaser, "in laboratorio")      (firma, endorsement)
```

In Fase 1 LAB21 è il soggetto, TrainMind è "ciò che stiamo costruendo". In Fase 2 si invertono: TrainMind diventa il soggetto, LAB21 resta come firma di garanzia scientifica in fondo a ogni pagina, mail e report. Il capitale di credibilità della Fase 1 non si butta — diventa la riga sotto il logo quando inizi a chiedere soldi.

### 2.2 Regole di nomenclatura

| Contesto | Forma corretta | Forma sbagliata |
|---|---|---|
| Società | **LAB21** | Lab21, LAB 21, lab21 |
| Descrittore | *an innovation lab for science in sport* (in inglese anche nei testi italiani) | traduzioni italiane |
| Prodotto | **TrainMind** | Trainmind, Train Mind, TRAINMIND, TrainMind AI |
| Prodotto + firma | **TrainMind** *by LAB21* | LAB21 TrainMind |

**Su "TrainMind AI":** resta il nome interno nella documentazione. **Sul mercato, mai.** Il suffisso promette che il prodotto *sia* AI, mentre l'AI è una funzione — e nel 2026 è un segnale di rumore, non di innovazione.

### 2.3 Handle social — da registrare subito, anche se non li usi

Registrali tutti oggi, prima che lo faccia qualcun altro. Costa zero e vale molto.

| Piattaforma | Fase 1 | Fase 2 |
|---|---|---|
| Instagram | `@lab21.sport` | `@trainmind.app` |
| Facebook (pagina) | LAB21 | TrainMind |
| YouTube | LAB21 | stesso canale, playlist TrainMind |
| TikTok | `@lab21.sport` | — |
| LinkedIn | pagina LAB21 + **il tuo profilo personale** | idem |
| WhatsApp | Canale "LAB21 — science in sport" | — |

**Il profilo personale conta più della pagina aziendale.** Nel B2B di nicchia una pagina ha una reach di un ordine di grandezza inferiore a un profilo umano. La pagina serve per esistere e per la vetrina; il profilo serve per essere visto.

### 2.4 Identità visiva

I mockup `LAB21/mockup-a.html` e `mockup-b.html` hanno già definito un sistema coerente. **Canonizzalo, non ricominciare.**

**Palette** (verificata sui mockup, tutti i valori presenti)

| Ruolo | HEX | Uso |
|---|---|---|
| Accent primario | `#00C9A7` | CTA, dati in evidenza, il "21" del logo |
| Accent scuro | `#00A489` | hover, accent su fondo chiaro |
| Ink | `#07100E` | fondi scuri, testo principale |
| Ink 2 | `#0E1A18` | sezioni scure alternate |
| Paper | `#FFFFFF` | fondo principale |
| Paper 2 / 3 | `#F4F7F6` / `#EAF0EE` | fondi di sezione |
| Testo secondario | `#5A6B67` | descrizioni, didascalie |
| Linea | `#E2E9E7` | bordi, separatori |

**Tipografia:** Space Grotesk 600 per i titoli (tracking −0.035em), Inter 300/400/500 per il testo, JetBrains Mono 11px uppercase tracking 0.2em per etichette, numeri, unità e date. Il mono maiuscoletto è l'elemento che comunica *laboratorio* senza doverlo dire — mai per testi lunghi.

**Loghi** (`LAB21/logo/`): `lab21-wordmark.png` su fondi chiari, `lab21-wordmark-light.png` su fondi scuri, `lab21-mark-green.png` come icona (favicon, avatar social, watermark report), `LAB21-icon-original-font-512/1024.png` per app icon e profili. Area di rispetto pari all'altezza del "2"; mai ricolorato, ruotato o su foto senza velatura.

**Da produrre:** wordmark monocromatico bianco e nero, lockup `TrainMind by LAB21`, e — nuovo per il social — **tre template grafici riutilizzabili** (vedi §7.4).

### 2.5 Tono di voce

**I quattro principi**

1. **Concreto prima che ispirazionale.** "Il report in dieci minuti" batte "rivoluzioniamo la performance".
2. **Il numero al posto dell'aggettivo.** Non "molto più veloce": "da 3 ore a 10 minuti".
3. **Il linguaggio del campo, non del paper.** "Carico", "rientro", "seduta" — non "monitoraggio del training load".
4. **L'AI come assistente, mai come oracolo.** "Ti prepara il report, tu decidi." È anche un requisito di conformità (§12).

**Registro per marca**

| | LAB21 | TrainMind |
|---|---|---|
| Voce | il laboratorio che spiega | il collega che ti toglie lavoro |
| Persona | "noi" | "tu" |
| Frase tipo | "Abbiamo guardato come 14 preparatori costruiscono il report settimanale. Ecco cosa non torna." | "Carichi il roster. Il primo report esce in dieci minuti." |
| Lunghezza | può respirare | massimo asciutta |

**Adattamento social:** su Instagram e TikTok il tono si accorcia ma **non si abbassa**. Niente slang forzato, niente emoji a pioggia, niente hook urlati ("STOP! Se sei un preparatore devi vedere questo"). Il pubblico è composto da professionisti: il registro che funziona è *collega competente che condivide una cosa utile*, non *creator che vende*.

*Usa:* carico, recupero, rientro, wellness, seduta, staff, società, report, leggibile, il lunedì mattina, decisione.
*Evita:* rivoluzionario, game changer, all-in-one, potenziato dall'AI, sfrutta il potere di, unlock.

---

## 3. ICP — a chi vendi davvero

> **Preparatore fisico o responsabile performance di club di basket italiano tra Serie B Interregionale e A2, o di academy/settore giovanile con almeno 3 squadre.**

Perché questo: ha il problema ed è **il suo** problema (perde le sue serate); ha un budget sotto la soglia in cui serve il consiglio direttivo; ed è raggiungibile — è su Instagram, è nei gruppi Facebook, va ai clinic, e conosce tutti gli altri preparatori d'Italia.

**Chi escludere ora:** Serie A (ciclo lungo, staff già dotati), minibasket puro (nessun budget), altri sport (diluisci il "basket-first", che è il tuo unico vero differenziale).

### Segmentazione e canale di contatto

| Pr. | Segmento | Volume IT | Piano atteso | Canale dominante |
|---|---|---|---|---|
| **A** | Preparatore di club B Interregionale / B Naz / A2 | 250–350 | Staff | **Instagram + gruppi Facebook** |
| **A** | Responsabile performance academy 3+ squadre | 80–150 | Club | **LinkedIn + referral** |
| **B** | Preparatore indipendente con più club | 200–400 | Coach | **Instagram + YouTube** |
| **C** | Società senza preparatore dedicato | molte | Club | *non ora* — serve il caso studio |
| **P** | Partner: formatori, clinic, docenti, creator, rivenditori GPS | 30–50 | — | Contatto diretto |

### I 5 pain point, nel loro linguaggio

Sono i ganci: ogni contenuto social parte da uno di questi, mai dal prodotto.

1. **"Il report me lo faccio la domenica sera."** Tre ore di Excel per qualcosa che il capo allenatore guarda quaranta secondi.
2. **"I dati sono in quattro posti diversi."** GPS, test da campo, wellness su WhatsApp, presenze su carta.
3. **"Quando salta il file, salta la stagione."** Un Excel su un portatile, senza backup.
4. **"Devo giustificare le mie scelte."** Quando il DS chiede perché quel giocatore non si allena.
5. **"Se cambio società ricomincio da zero."** Il metodo vive nella tua testa, non in uno strumento.

### Le 6 obiezioni — e la risposta

Senza call, queste risposte non le dici a voce: **vivono nella FAQ, nelle email di sequenza e nelle didascalie dei post.**

| Obiezione | Risposta |
|---|---|
| "Excel mi basta" | "Excel è ottimo per registrare. Il problema è produrre. Quanto ci metti a fare il report settimanale?" |
| "Non mi fido dell'AI sugli atleti" | "Giusto. L'AI qui non decide niente: prepara il report, tu firmi. Ogni output è modificabile." |
| "Non ho budget" | "Meno di un pallone al mese. E i primi 21 giorni non chiedono nemmeno la carta." |
| "Il mio staff non lo userà" | "Lo staff non inserisce niente. Legge. L'inserimento è solo tuo, cinque minuti a seduta." |
| "Ci ho già provato con un'altra piattaforma" | "Le altre nascono per il calcio e le adattano. Questa nasce per il basket." |
| "Devo sentire la società" | "C'è un PDF di una pagina già pronto da girare al DS. Lo scarichi qui." |

---

## 4. Il messaggio

### 4.1 LAB21 — Fase 1

**Headline** (già in mockup-b, tienila): *Trasformiamo i dati in performance reale.*
**Sottotitolo:** *Non vendiamo teoria. Costruiamo strumenti che vengono usati il lunedì mattina.*

**Le tre prove:** metodo scientifico con output pratico; costruito **con** chi allena, non per chi allena (i beta tester sono preparatori in attività — e lo dimostri mostrandoli); TrainMind è il primo software che esce dal laboratorio.

**CTA unica di Fase 1:** *Entra nella lista d'attesa TrainMind.*

### 4.2 TrainMind — Fase 2

> **Il report di squadra che ti prendeva tre ore, in dieci minuti.**
> TrainMind è la piattaforma di gestione della preparazione fisica pensata per il basket: carichi i dati una volta e ottieni report leggibili per staff e società, con un assistente AI che scrive la sintesi e tu che decidi.

**Tre bullet:**
- **Un posto solo.** Carichi, test, wellness, presenze, rientri — un dato, un posto, tutta la stagione.
- **Report in un clic.** PDF pulito per il capo allenatore e per la società. Anche da tablet a bordo campo.
- **L'AI scrive, tu decidi.** La sintesi la prepara l'assistente. La firma è sempre tua.

**Varianti da testare** (sono anche tre angoli di contenuto social distinti):
- *Credibilità:* "Quando il DS ti chiede perché quel giocatore non si allena, hai una risposta con i dati dietro."
- *Continuità:* "Il tuo metodo smette di vivere solo nella tua testa."
- *Basket-first:* "Non è un software da calcio adattato. Nasce sul parquet."

**Il test dei 10 secondi:** fai leggere hero + tre bullet a un preparatore che non conosce il prodotto. Se dopo dieci secondi non sa dire *cosa fa* e *per chi è*, riscrivi. Non aggiungere: togli.

---

## 5. Offerta e pricing

### Listino (Fase 2)

| | **Coach** | **Staff** | **Club** |
|---|---|---|---|
| Per chi | preparatore singolo | preparatore + staff | società / academy |
| Atleti | fino a 20 | fino a 45 | illimitati |
| Utenti | 1 | fino a 4 | illimitati |
| Squadre | 1 | 2 | illimitate |
| Report AI/mese | 20 | 80 | illimitati* |
| Storico | stagione corrente | multi-stagione | multi-stagione + export |
| **Mensile** | **29 €** | **69 €** | **149 €** |
| **Annuale (−20%)** | **278 €** | **662 €** | **1.430 €** |

\* soglia tecnica alta non pubblicizzata, per proteggere i costi AI (vedi `documentation/GUIDA_ROUTING_AI_E_CONSUMO.md`).

**29 € e non 19 €:** a 19 € comunichi "tool", a 29 € "strumento professionale". Dieci euro irrilevanti per il cliente, cruciali per il tuo margine sui costi AI.

### L'ingresso: prova self-serve, non pilot con call

Nella v1.0 l'offerta d'ingresso era un pilot con call di setup. **Non regge senza call.** Sostituita da:

> **TrainMind — 21 giorni, senza carta di credito**
> 1. Ti registri. **Entri già dentro una squadra dimostrativa completa**: 12 atleti, 8 settimane di storico, un sovraccarico e un rientro da infortunio. Vedi il prodotto che funziona prima di caricare qualsiasi cosa tua.
> 2. Quando vuoi, importi il tuo roster da Excel o CSV — il file che hai già.
> 3. Generi il primo report vero. Obiettivo: **entro dieci minuti dalla registrazione.**
> 4. Il giorno 18 ricevi il riepilogo di cosa hai costruito e l'offerta.

**Perché la modalità dimostrativa precaricata è il pezzo decisivo.** Il motivo per cui i trial self-serve muoiono è che l'utente entra in un prodotto vuoto e deve lavorare prima di ricevere valore. Con i dati demo l'ordine si inverte: prima vede il valore, poi decide se investire i suoi dati. È l'unico modo per sostituire la call di setup senza perdere il 70% delle registrazioni.

**21 giorni e non 14:** il ciclo di questo lavoro è settimanale. Con 14 giorni il preparatore fa due report; con 21 ne fa tre e vede lo storico costruirsi — che è l'unico momento in cui capisce davvero a cosa serve.

**Senza carta:** riduce l'attrito d'ingresso a costo di una conversione più bassa. È il compromesso giusto quando non hai un venditore che recupera chi si blocca al form della carta.

**Ai beta tester attuali:** conversione **early adopter −40% a vita** sul piano scelto, con scadenza a 30 giorni dall'apertura dei pagamenti. Sono la tua prova sociale: vanno trattati bene e chiusi in fretta.

**Per il segmento Club** — qui la mia riserva onesta: **una società sportiva raramente firma 149 €/mese senza che nessuno le parli.** Non ti serve una call di vendita, ma serve un equivalente asincrono: il **PDF di una pagina per il DS** (§8) e un canale di risposta scritta entro 24 ore. Se il Club non converte nei primi tre mesi, non è colpa del prezzo: è che manca l'interlocutore. Mettilo in conto e misuralo separatamente.

---

## 6. Il sistema social: sei canali, sei ruoli

Ogni canale ha **un compito solo**. Un canale senza compito è tempo buttato.

```
   AMPIEZZA                    PROFONDITÀ                 CONVERSIONE

   Instagram  ──┐
   TikTok     ──┤              Gruppi Facebook  ──┐
   YouTube Sh.──┘                LinkedIn      ──┤──►  Landing + modulo
                                YouTube long   ──┘        │
                                                          ▼
                                 WhatsApp  ◄──────  Database SQL
                              (i già iscritti)       (§9)
```

### 6.1 Instagram — il motore di ampiezza *(canale n°1)*

È dove sta il basket italiano. Preparatori, allenatori, giocatori, società: tutti lì.

- **Ruolo:** far scoprire LAB21 a chi non lo cerca, e far salvare il contenuto a chi ha il problema.
- **Formati:** Reel 20–40s (3 a settimana), carosello 6–8 slide (1 a settimana), storie quotidiane con sondaggi.
- **La metrica che conta è il SALVATAGGIO, non il like.** Un preparatore che salva un carosello sul carico è un compratore. Uno che mette like è passato di lì. Ottimizza per i salvataggi: contenuti-riferimento (checklist, tabelle, "i 4 dati che servono al rientro").
- **CTA:** link in bio, sempre lo stesso, sempre tracciato (`?utm_source=instagram`).
- **Attenzione:** l'ampiezza porta anche giocatori e genitori. Va bene — sono i moltiplicatori che ti fanno arrivare al loro preparatore. Ma **non modificare il contenuto per piacere a loro.**

### 6.2 Gruppi Facebook — il canale più caldo e più sottovalutato

Il preparatore italiano tra i 35 e i 55 anni è nei gruppi Facebook di allenatori e preparatori. È il pubblico più qualificato che esista e nessuno lo presidia bene.

- **Ruolo:** conversazioni con persone che hanno già il problema, oggi.
- **Come si sta:** rispondi alle domande degli altri per due settimane **prima** di pubblicare qualcosa di tuo. Poi pubblica l'analisi, non il link. Il link va in commento o in DM su richiesta.
- **Cadenza:** 15 minuti al giorno di presenza reale, 1 contenuto proprio a settimana per gruppo, mai lo stesso testo copiato in cinque gruppi lo stesso giorno.
- **Da fare in settimana 1:** individua 6–10 gruppi italiani di allenatori/preparatori di basket e leggi che tono hanno prima di scrivere una riga.

> Questo canale ha il miglior rapporto tra tempo speso e iscritti qualificati di tutto il sistema. È anche l'unico dove puoi bruciarti la reputazione in un pomeriggio, se entri vendendo.

### 6.3 LinkedIn — le società e la credibilità LAB21

- **Ruolo:** raggiungere DS, dirigenti e academy (il segmento Club), e costruire l'autorevolezza LAB21 che i social visivi non danno.
- **Formato:** 1 post testuale a settimana dal **profilo personale**, 6–10 righe, un'idea sola.
- **Contenuto:** il taglio "laboratorio" — cosa abbiamo osservato, cosa non torna, cosa ne concludiamo.
- Nessun outreach a freddo: qui pubblichi e rispondi, non insegui.

### 6.4 YouTube — l'archivio che lavora mentre dormi

- **Ruolo:** rispondere alle ricerche esplicite ("come fare il report di carico", "excel preparazione basket") e ospitare gli asset che sostituiscono le call.
- **Formato:** 1 video lungo al mese (8–12 min, screen + voce) + gli Shorts riciclati dai Reel.
- **I tre video che valgono più di tutti gli altri:** *TrainMind in 3 minuti*, *Come importare il roster da Excel*, *Come si legge un report di carico*. Sono i tuoi asset di vendita e di supporto insieme.

### 6.5 TikTok — costo marginale zero

Ricicla i Reel verticali, senza produrre nulla di dedicato. Il pubblico è più giovane e meno qualificato, ma il costo è un caricamento. Se dopo sei settimane non porta iscritti qualificati, resta come archivio e non ci pensi più.

### 6.6 WhatsApp — dove tieni caldi gli iscritti

In Italia lo sport vive su WhatsApp. Un **Canale WhatsApp** (broadcast, gratuito, senza numeri esposti) è il modo migliore per parlare alla lista d'attesa senza dipendere dall'algoritmo di nessuno.

- **Ruolo:** trasformare l'iscrizione in attesa in un'attesa attiva.
- **Cadenza:** 1 messaggio a settimana, breve. Anteprime dello sviluppo, il dato della settimana, "questo pezzo l'ha chiesto un preparatore di A2".
- Al lancio, questo canale è il primo posto dove annunci l'apertura — e converte più della mail.

### Cosa NON accendere

**Advertising a pagamento — non prima di 3 clienti paganti.** Finché non sai quale contenuto genera iscritti qualificati, ogni euro in ads compra dati che l'organico ti dà gratis. Quando partirai, la prima campagna sarà **retargeting su chi ha visitato la landing senza iscriversi** — non prospecting a freddo.

---

## 7. La fabbrica dei contenuti

Sei canali sembrano sei lavori. Non lo sono, se produci **una cosa sola alla settimana e la fai a pezzi**.

### 7.1 Il pilastro settimanale

Ogni settimana ha **un solo tema**, preso dai 5 pain point di §3. Da quel tema nascono tutti i contenuti della settimana su tutti i canali.

```
                    ┌─────────────────────────┐
                    │   PILASTRO SETTIMANALE  │
                    │   (un tema, un'idea)    │
                    └───────────┬─────────────┘
                                │
     ┌──────────┬───────────┬───┴───┬───────────┬──────────┐
     ▼          ▼           ▼       ▼           ▼          ▼
  Reel IG    Carosello   Post      Post      Storia     Messaggio
  (+TikTok)  IG 7 slide  gruppo FB LinkedIn  +sondaggio  WhatsApp
   20-40s                                                       
     └──────────┴───────────┴───────┴───────────┴──────────┘
                                │
                                ▼
                    Video YouTube mensile
                  (4 pilastri = 1 video lungo)
```

**Sette pezzi da un'ora di pensiero.** La regola è che il pilastro si scrive una volta, e ogni derivato è una riformattazione — non un contenuto nuovo.

### 7.2 I sei pilastri della Fase 1

Uno a settimana, in quest'ordine:

1. **Perché il report settimanale ti prende tre ore** (e quali due ore sono sprecate)
2. **Excel non è il problema.** Il problema è che l'Excel muore con te
3. **Cosa guarda davvero un capo allenatore** in un report di carico
4. **Wellness su WhatsApp:** perché non funziona e cosa fare invece
5. **Rientro da infortunio:** i 4 dati che nessuno registra e servono tutti
6. **Excel vs piattaforma basket-first:** il confronto onesto, anche dove Excel vince

Il sesto diventa la **pagina evergreen** sul sito: è il contenuto che continuerà a portare iscritti da ricerca e da LLM per mesi.

### 7.3 Il formato che funziona per ogni derivato

| Derivato | Struttura | Durata/Lunghezza |
|---|---|---|
| **Reel** | Primo secondo: il problema detto ad alta voce ("Il report della domenica sera"). Poi 3 punti. Ultimo secondo: dove approfondire | 20–40s, testo grande, guardabile **senza audio** |
| **Carosello** | Slide 1 = la promessa. Slide 2–6 = un punto ciascuna, un'idea per slide. Slide 7 = riepilogo salvabile. Slide 8 = LAB21 + CTA | 7–8 slide |
| **Post gruppo FB** | Nessun link. Racconto in prima persona + domanda finale vera. Rispondi a tutti i commenti | 8–15 righe |
| **Post LinkedIn** | Osservazione → perché non torna → cosa ne concludiamo → CTA leggera | 6–10 righe |
| **Storia** | 3 frame: problema, dato, sondaggio ("Quanto ci metti tu?") | il sondaggio è il pezzo che serve |
| **WhatsApp** | Una frase + un dato + un link | 3 righe |

**Regola del formato Reel:** l'80% lo guarda senza audio. Se il messaggio non passa a schermo muto, il Reel non esiste.

### 7.4 I tre template grafici da produrre una volta

Servono per non ridisegnare niente ogni settimana. Palette e font di §2.4.

1. **Slide carosello** — fondo `#07100E`, titolo Space Grotesk, etichetta mono in alto, wordmark chiaro in basso a destra.
2. **Cover Reel** — fondo scuro, una frase grande, accento `#00C9A7` su tre parole al massimo.
3. **Card dato** — il numero enorme in mono, la fonte piccola sotto. È il formato più condiviso di tutti.

### 7.5 Il ritmo di produzione: due blocchi, non sette giorni

Non produrre ogni giorno. **Un blocco di produzione a settimana** (2–3 ore, martedì) in cui scrivi il pilastro e sforni tutti i derivati; poi solo pubblicazione e risposte ai commenti negli altri giorni.

Una volta al mese, un blocco di 3 ore per il video YouTube che riassume i quattro pilastri.

### 7.6 I beta tester come contenuto — il tuo asset più forte

Hai preparatori professionisti che **stanno già usando il prodotto ora**. Nel modello social questa è la risorsa più preziosa che possiedi, e non richiede nessuna call.

Chiedi loro tre cose, tutte in asincrono (un messaggio, non una riunione):

1. **Uno screenshot** di una loro schermata reale (con nomi oscurati) — vale più di qualunque mockup.
2. **Una frase in risposta a una domanda sola:** *"In una riga, cosa diresti a un collega?"*
3. **Un video di 30 secondi girato col telefono** che mostra cosa ci fanno. Non deve essere bello: deve essere vero.

Da questi tre elementi ricavi: le prove sociali della landing, tre Reel, un carosello, e la risposta a metà delle obiezioni. **Un professionista in attività che dice "lo uso" chiude più conversazioni di dieci post tuoi.**

E per il referral, sempre in asincrono: *"Se conosci un collega con lo stesso problema, girargli il link mi aiuta parecchio — per ogni collega che attiva, ti regalo un mese."* Un messaggio WhatsApp, non una telefonata.

---

## 8. Il funnel e gli asset

### Il percorso, senza nessun intervento umano

```
  scopre      →   approfondisce  →   si iscrive   →   prova      →   paga
     │                  │                  │              │             │
  Reel IG          carosello          modulo         registrazione  checkout
  post gruppo      video YT           qualificante   demo precaricata  Stripe
  post LinkedIn    report esempio     ↓              import CSV        ↓
                                   DATABASE SQL      primo report   abbonato
                                        │            ↓
                                        └──────►  email lifecycle (Resend)
                                                  giorno 0-1-3-7-14-18-21
```

### Asset: cosa hai, cosa manca

| Asset | Stato | Priorità | Note |
|---|---|---|---|
| Sito LAB21 (mockup A/B) | ✅ esiste | — | **Scegli tra A e B e pubblica.** Due mockup fermi valgono zero |
| Modulo lista d'attesa → SQL | ❌ manca | **P0** | Il pezzo senza cui la Fase 1 non esiste. Vedi §9 |
| Tracciamento UTM | ❌ manca | **P0** | Senza, non sai quale canale funziona e stai lavorando alla cieca |
| Modalità dimostrativa precaricata | ❌ manca | **P0** | **Il sostituto della call di setup.** Il singolo pezzo più importante del modello self-serve |
| Import roster da CSV/Excel | ❓ verificare | **P0** | Se manca, il trial muore lì |
| Report PDF esempio | ❌ manca | **P0** | Si invia e si posta anche a chi non si iscrive |
| 3 template grafici social | ❌ manca | **P0** | §7.4 — senza, ogni contenuto costa il triplo |
| Handle social registrati | ❌ manca | **P0** | 30 minuti, oggi |
| Email lifecycle (7 email) | ⚠️ Resend c'è | **P0** | **Sostituiscono le call.** §11.3 |
| Video demo 3 minuti | ❌ manca | P1 | Il singolo asset che risponde a più domande |
| Video "importa il roster da Excel" | ❌ manca | P1 | Difende l'attivazione |
| Pagina FAQ / obiezioni | ❌ manca | P1 | Le risposte di §3 |
| Pagina "come funziona l'AI" | ❌ manca | P1 | Trust: chi vede i dati, backup, controllo umano, GDPR |
| **PDF di una pagina per il DS** | ❌ manca | P1 | L'unico modo di vendere al segmento Club senza parlarci |
| Landing TrainMind + prezzi | ⚠️ da fare | P1 | Fase 2 |
| Canale WhatsApp | ❌ manca | P1 | 10 minuti |
| Prove sociali dai beta | ❌ manca | P1 | §7.6 |
| Caso studio completo | ❌ manca | P2 | Settimana 8+ |

**Le otto voci P0 sono l'unica lista che conta questo mese.**

### Il report PDF esempio — l'asset centrale

Vale più della landing. È l'unica cosa che un preparatore guarda in trenta secondi per capire se gli serve, ed è anche il miglior contenuto social che puoi postare (una pagina alla volta, in carosello).

Deve contenere: una squadra credibile con nomi di fantasia, 4 settimane di carico con un picco anomalo evidente, il commento AI di cinque righe che spiega il picco, una tabella wellness, un rientro da infortunio, footer *TrainMind by LAB21*. Massimo 4 pagine. Deve essere bello **stampato** — finirà sulla scrivania di un DS.

---

## 9. Misurazione: il database al posto del CRM

Hai ragione sul fatto che un CRM qui sarebbe un peso. Ma **la funzione va sostituita, non eliminata**: senza tracciamento, in un modello senza call il fallimento è silenzioso — nessuno ti dice che si è bloccato, sparisce e basta.

Il database ti dà una cosa che nessun CRM ti darebbe: **puoi unire l'attribuzione marketing all'uso reale del prodotto**, perché possiedi entrambe le tabelle. Sapere che i contenuti sul rientro da infortunio generano gli utenti che poi caricano più dati è un'informazione che un CRM non produrrà mai.

### 9.1 Schema

```sql
-- Chi entra: lista d'attesa (Fase 1) e registrazioni (Fase 2)
CREATE TABLE marketing_lead (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  email           TEXT        NOT NULL UNIQUE,
  nome            TEXT,
  ruolo           TEXT,            -- preparatore | allenatore | dirigente | studente | altro
  societa         TEXT,
  categoria       TEXT,            -- a1 | a2 | b_naz | b_interr | c | giovanili | academy | altro
  n_atleti        INT,
  lingua          TEXT DEFAULT 'it',
  -- attribuzione
  fonte           TEXT,            -- instagram | facebook_gruppo | linkedin | youtube | tiktok | whatsapp | referral | diretto
  campagna        TEXT,            -- utm_campaign: il pilastro settimanale
  contenuto       TEXT,            -- utm_content: il singolo post
  referrer_lead_id BIGINT REFERENCES marketing_lead(id),
  -- stato
  stato           TEXT NOT NULL DEFAULT 'lista',
                                   -- lista | invitato | registrato | attivato | trial | cliente | perso
  user_id         UUID,            -- collegamento all'utente dell'app
  motivo_perso    TEXT,
  note            TEXT
);

-- La qualifica: l'unica definizione di "iscritto che conta"
ALTER TABLE marketing_lead ADD COLUMN qualificato BOOLEAN
  GENERATED ALWAYS AS (
    ruolo IN ('preparatore','allenatore','dirigente')
    AND societa IS NOT NULL AND societa <> ''
  ) STORED;

CREATE INDEX idx_lead_fonte   ON marketing_lead(fonte, created_at);
CREATE INDEX idx_lead_stato   ON marketing_lead(stato);
CREATE INDEX idx_lead_qual    ON marketing_lead(qualificato) WHERE qualificato;

-- Cosa fanno: un evento per ogni passo del funnel
CREATE TABLE marketing_event (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     BIGINT NOT NULL REFERENCES marketing_lead(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo        TEXT NOT NULL,
    -- iscrizione | invito_inviato | registrazione | demo_vista | roster_caricato
    -- | primo_report | report_n | trial_avviato | trial_scaduto | pagamento | disdetta
  payload     JSONB
);

CREATE INDEX idx_event_lead ON marketing_event(lead_id, occurred_at);
CREATE INDEX idx_event_tipo ON marketing_event(tipo, occurred_at);
```

**Le tre colonne che non vanno saltate:** `fonte`, `contenuto` e `motivo_perso`. Le prime due ti dicono cosa produrre ancora; la terza è quella che nel modello senza call sostituisce il campo "obiezione" della v1.0 — e va compilata a mano, anche con due parole, ogni volta che chiudi un lead.

### 9.2 Le quattro query che guardi ogni venerdì

```sql
-- 1) Funnel per canale: quale social porta persone che poi fanno qualcosa
SELECT
  l.fonte,
  count(*)                                         AS iscritti,
  count(*) FILTER (WHERE l.qualificato)            AS qualificati,
  count(*) FILTER (WHERE l.stato IN ('registrato','attivato','trial','cliente')) AS registrati,
  count(*) FILTER (WHERE l.stato IN ('attivato','trial','cliente'))              AS attivati,
  count(*) FILTER (WHERE l.stato = 'cliente')      AS clienti,
  round(100.0 * count(*) FILTER (WHERE l.qualificato) / nullif(count(*),0), 1) AS pct_qualificati
FROM marketing_lead l
WHERE l.created_at >= now() - interval '30 days'
GROUP BY l.fonte
ORDER BY qualificati DESC;

-- 2) Quali contenuti generano iscritti QUALIFICATI (non solo traffico)
SELECT campagna, contenuto,
       count(*) AS iscritti,
       count(*) FILTER (WHERE qualificato) AS qualificati
FROM marketing_lead
WHERE created_at >= now() - interval '30 days'
GROUP BY campagna, contenuto
HAVING count(*) FILTER (WHERE qualificato) > 0
ORDER BY qualificati DESC
LIMIT 15;

-- 3) Tempo al primo report: la metrica prodotto che decide tutto
SELECT
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY minuti) AS mediana_min,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY minuti) AS p75_min,
  count(*) AS utenti
FROM (
  SELECT e1.lead_id,
         extract(epoch FROM (min(e2.occurred_at) - min(e1.occurred_at))) / 60 AS minuti
  FROM marketing_event e1
  JOIN marketing_event e2
    ON e2.lead_id = e1.lead_id AND e2.tipo = 'primo_report'
  WHERE e1.tipo = 'registrazione'
  GROUP BY e1.lead_id
) t;

-- 4) Chi si è bloccato: registrati che non arrivano al primo report entro 48h
--    Nel modello senza call, QUESTA è la lista su cui agire (con una email, non con una chiamata)
SELECT l.id, l.email, l.societa, l.fonte, l.created_at
FROM marketing_lead l
JOIN marketing_event r ON r.lead_id = l.id AND r.tipo = 'registrazione'
LEFT JOIN marketing_event p ON p.lead_id = l.id AND p.tipo = 'primo_report'
WHERE p.id IS NULL
  AND r.occurred_at < now() - interval '48 hours'
  AND r.occurred_at > now() - interval '21 days'
ORDER BY r.occurred_at DESC;
```

La query 4 è la più importante del documento. È il punto in cui, in un modello con venditore, qualcuno alzerebbe il telefono. Qui parte un'email automatica — ma solo se stai guardando il dato.

### 9.3 Dashboard KPI — venerdì, 15 minuti

| Area | Metrica | Target mese 1 | Allerta |
|---|---|---|---|
| Ampiezza | Salvataggi Instagram / settimana | 60+ | < 20 |
| Ampiezza | Visite alla landing | 800–1.500 | < 400 |
| Lista | **Iscritti qualificati** | 80–120 | < 50 |
| Qualità | % qualificati sul totale iscritti | > 55% | < 35% |
| Canali | Iscritti dai gruppi Facebook | 25+ | < 10 |
| Prodotto | Registrazioni al trial | 40+ | < 20 |
| Prodotto | **Tempo mediano al primo report** | **< 10 min** | **> 20 min** |
| Prodotto | Attivati (≥1 report vero) | 20+ | < 10 |
| Business | Clienti paganti | 3–6 | 0 |
| Produzione | Pilastri pubblicati | 6 | < 4 |

**La metrica che conta più di tutte è il tempo al primo report.** In un modello senza call è l'unico venditore che hai. Se sale sopra i venti minuti, smetti di fare contenuti e sistema l'onboarding: stai versando acqua in un secchio bucato.

**Rituale del venerdì (30 minuti):** aggiorni i numeri, leggi i `motivo_perso` della settimana, e **elimini un attrito** — un passaggio confuso nell'onboarding, una domanda di troppo nel modulo, un'email che nessuno apre. Uno alla settimana, per sei settimane.

---

## 10. Calendario operativo — 6 settimane

### Settimana 1 — Fondamenta e presenza

| Giorno | Focus | Output |
|---|---|---|
| 1 | Scegli mockup A o B. Congela brand system (§2). **Registra tutti gli handle social** | Sito scelto, handle presi |
| 2 | Crea le tabelle SQL (§9.1) e collega il modulo lista d'attesa con UTM | Tracciamento vivo |
| 3 | Pubblica il sito LAB21 con il modulo funzionante. Apri Canale WhatsApp | **Fase 1 online** |
| 4 | Individua 6–10 gruppi Facebook. Leggi, non scrivere. Produci i 3 template grafici (§7.4) | Terreno mappato |
| 5 | **Pilastro 1** + tutti i derivati. Messaggio asincrono ai beta tester (§7.6) | Prima settimana di contenuti |

### Settimana 2 — Gli asset che sostituiscono le call

| Giorno | Focus | Output |
|---|---|---|
| 6 | **Modalità dimostrativa precaricata**: 12 atleti, 8 settimane, un sovraccarico, un rientro | Il pezzo P0 |
| 7 | Verifica/completa l'import roster da CSV-Excel. Cronometra il percorso completo | Attivazione difesa |
| 8 | Report PDF esempio (4 pagine) | L'asset centrale |
| 9 | Video demo 3 minuti + video "importa il roster" | I due video di vendita |
| 10 | **Pilastro 2** + derivati. Prime risposte nei gruppi FB (solo risposte) | Contenuti + presenza |

### Settimana 3 — Il ciclo di vita automatico

| Giorno | Focus | Output |
|---|---|---|
| 11 | Scrivi le 7 email lifecycle (§11.3) e collegale agli eventi SQL | **Il venditore automatico** |
| 12 | Pagina FAQ + pagina "come funziona l'AI" + PDF di una pagina per il DS | Obiezioni gestite |
| 13 | Raccogli screenshot, frasi e video brevi dai beta tester. Montali | Prova sociale |
| 14 | Primo contenuto **proprio** nei gruppi Facebook (non link) | Canale caldo aperto |
| 15 | **Pilastro 3** + derivati. Prima query di funnel (§9.2) | Primi dati veri |

### Settimana 4 — Itera sui dati, non sulle sensazioni

| Giorno | Focus | Output |
|---|---|---|
| 16 | Query 1 e 2: quale canale e quale contenuto porta qualificati. **Taglia il peggiore** | Meno lavoro, più resa |
| 17 | Riscrivi headline e CTA della landing sui dati reali | Landing v2 |
| 18 | Video YouTube mensile (dai pilastri 1–4) + Shorts | Archivio acceso |
| 19 | Query 3: tempo al primo report. Se > 20 min, **fermi tutto e sistemi l'onboarding** | Attivazione sana |
| 20 | **Pilastro 4** + derivati. Elimina un attrito | Iterazione |

### Settimana 5 — Prepara la Fase 2

| Giorno | Focus | Output |
|---|---|---|
| 21 | Landing TrainMind + pagina prezzi | Fase 2 in costruzione |
| 22 | Stripe: prodotti, prezzi, checkout, portale clienti, webhook | Pagamenti pronti |
| 23 | Email di conversione per i beta tester (−40% a vita, scadenza 30 giorni) | Prima chiusura |
| 24 | 5 contatti partner (formatori, clinic, creator) — proposta di contenuto congiunto | Moltiplicatore |
| 25 | **Pilastro 5** + derivati. Prepara l'annuncio per il Canale WhatsApp | Contenuti + lancio |

### Settimana 6 — Apertura e consolidamento

| Giorno | Focus | Output |
|---|---|---|
| 26 | **Apri i pagamenti.** Annuncio: WhatsApp prima, poi email lista, poi social | Fase 2 live |
| 27 | **Pilastro 6** → pagina evergreen "Excel vs piattaforma basket-first" + 3 pagine SEO | Inbound acceso |
| 28 | Query 4: chi si è bloccato. Email di recupero. Riattivazione tiepidi | Recupero |
| 29 | Review numerica del mese: quale canale, quale contenuto, quale attrito | Report mese 1 |
| 30 | Piano mese 2. Primo caso studio da un beta tester convertito | Prossimo ciclo |

### Il ritmo, dalla settimana 7

| | Lunedì | Martedì | Mercoledì | Giovedì | Venerdì |
|---|---|---|---|---|---|
| **Mattina** | pubblica + gruppi FB 15' | **blocco produzione** (2–3h) | pubblica + gruppi FB | pubblica + LinkedIn | **KPI + taglia un attrito** |
| **Pomeriggio** | prodotto | prodotto | prodotto | prodotto | prodotto |

Un solo blocco creativo a settimana. Tutto il resto è pubblicazione, risposte e codice.

---

## 11. Template

### 11.1 Reel — struttura tipo (pilastro 1)

> **[0–2s, testo grande a schermo]** Il report della domenica sera.
> **[2–8s]** Tre ore di Excel per qualcosa che il capo allenatore guarda quaranta secondi.
> **[8–20s]** Due di quelle tre ore non servono: copi dati da un file all'altro, sistemi la formattazione, rifai il grafico che si è rotto.
> **[20–30s]** L'unica ora che conta è quella in cui decidi. Il resto è lavoro che può fare una macchina.
> **[30–35s]** In LAB21 stiamo costruendo esattamente questo. Link in bio.

Testo grande, leggibile senza audio, un'idea per schermata.

### 11.2 Post per gruppo Facebook (pilastro 1)

> Domanda per chi qui fa preparazione: quanto tempo vi porta via il report settimanale?
>
> Ho chiesto la stessa cosa ad alcuni colleghi negli ultimi mesi e le risposte stanno quasi tutte tra le due e le tre ore. Ma la parte interessante è **dove** se ne va quel tempo: quasi mai nell'analisi. Se ne va nel copiare dati tra file, nel rimettere a posto la formattazione, e nel rifare il grafico che si è rotto quando hai aggiunto una riga.
>
> L'ora che conta davvero — quella in cui decidi chi carica e chi scarica — è sempre l'ultima e sempre la più stanca.
>
> Voi come lo gestite? C'è qualcuno che è riuscito a portarlo sotto l'ora?

Nessun link. Rispondi a tutti i commenti. Il link va in DM, solo se te lo chiedono.

### 11.3 Le 7 email lifecycle — il venditore automatico

Sono l'asset che sostituisce le call. Vanno su Resend, agganciate agli eventi di §9.1.

| # | Trigger | Oggetto | Contenuto in una riga |
|---|---|---|---|
| 1 | `iscrizione` | Ci sei. Ecco intanto una cosa utile | Conferma + **report PDF di esempio** subito, senza chiedere niente |
| 2 | `registrazione` | Entra pure: c'è già una squadra dentro | Spiega la modalità demo. Un solo bottone: *Guarda il report* |
| 3 | `registrazione` +24h **se** nessun `primo_report` | Ti sei fermato al primo passo? | Video da 90 secondi + "rispondi a questa mail se ti serve una mano" |
| 4 | `primo_report` | Hai appena fatto in 10 minuti quello che ti prendeva 3 ore | Il momento di massimo entusiasmo: **qui chiedi l'import del roster vero** |
| 5 | `roster_caricato` +7g | La seconda settimana è quella che conta | Mostra come si legge lo storico. È il momento in cui capiscono a cosa serve |
| 6 | trial giorno 18 | Cosa hai costruito in tre settimane | Riepilogo dei loro numeri reali + offerta + **PDF di una pagina per il DS** |
| 7 | trial scaduto +3g | Chiudo qui, ma i tuoi dati restano | Ultima chiamata onesta. I dati restano 90 giorni. Nessuna pressione |

**L'email 3 è quella che vale di più**, perché intercetta esattamente il punto in cui un venditore alzerebbe il telefono. **L'email 7 genera più conversioni della 6** — non saltarla.

Regola per tutte: massimo 90 parole, un bottone solo, e la possibilità di rispondere davvero (`reply-to` che arriva a te, non `noreply@`).

### 11.4 Messaggio asincrono ai beta tester

> Ciao [Nome], intanto grazie — il fatto che lo stiate usando sul serio è la cosa più utile che potesse succedere.
>
> Tre cose veloci, tutte da fare col telefono in cinque minuti, quando ti capita:
> 1. Uno screenshot di una schermata che usi davvero (oscura pure i nomi).
> 2. Una riga sola: cosa diresti a un collega?
> 3. Se hai voglia, 30 secondi di video in cui fai vedere cosa ci fai. Non deve essere fatto bene, deve essere vero.
>
> E se ti viene in mente un collega con lo stesso problema, girargli il link mi aiuta parecchio: per ognuno che parte, un mese te lo regalo io.

### 11.5 Contatto partner

> **Oggetto:** un'analisi per il tuo pubblico
>
> Ciao [Nome], seguo [clinic / contenuti / corso]. In LAB21 abbiamo raccolto come i preparatori di basket gestiscono oggi il reporting: quanto tempo ci mettono, dove lo perdono, cosa guarda davvero un capo allenatore.
>
> Ti interessa se ne facciamo un contenuto insieme per il tuo pubblico? Nessun taglio commerciale — l'analisi è tua da usare come vuoi.

---

## 12. Vincoli da rispettare

Hai già una cartella `legal/` completa. Quattro cose che toccano direttamente il marketing.

1. **Nessun claim sanitario.** Mai "previene gli infortuni", "riduce il rischio del X%", "diagnosi". Formula sicura: *"supporta lo staff nel leggere i segnali di carico"*. Un claim medico non provato è pubblicità ingannevole — e con dati sportivi su minori è un problema serio.

2. **AI dichiarata come supporto decisionale.** La DPIA e il *Piano AI Literacy* che hai già prodotto presuppongono controllo umano sull'output. Deve emergere anche dal marketing: *"L'AI scrive la sintesi, la decisione è dello staff."* È conformità e argomento di vendita insieme.

3. **⚠️ Immagini di minori sui social — il rischio più concreto del passaggio ai social.** Gran parte del target lavora nel settore giovanile. **Non pubblicare mai foto o video in cui un minore è riconoscibile**, nemmeno se te li manda un beta tester entusiasta, nemmeno se la società ha un consenso per i propri canali — quel consenso non copre te. Vale anche per gli screenshot: nomi e cognomi vanno oscurati sempre, senza eccezioni. Nei contenuti usa dati e nomi di fantasia, riprese senza volti, o adulti. Un solo scivolone qui costa più di tutto il resto del piano messo insieme.

4. **Consenso e trasparenza sul modulo di iscrizione.** Il modulo che scrive in `marketing_lead` raccoglie dati personali: serve informativa collegata, base giuridica esplicita e doppio opt-in se mandi contenuti promozionali. Hai già l'informativa in `legal/` — va solo collegata.

---

## 13. Budget mese 1

| Voce | Costo |
|---|---|
| Infrastruttura attuale | 6,61 €/mese *(già sostenuto)* |
| Handle e canali social | 0 € |
| Canale WhatsApp | 0 € |
| Email (Resend già configurato) | 0 € |
| Strumento grafico per i template (Canva Pro, opzionale) | 0–13 €/mese |
| Microfono USB decente per Reel e YouTube | 40–80 € *(una tantum, l'audio conta più del video)* |
| Registrazione marchio TrainMind (UIBM) | 100–200 € *(una tantum, da fare comunque)* |
| **Advertising** | **0 € — deliberatamente** |
| **Totale mese 1** | **~150–300 €**, quasi tutto una tantum |

Il costo reale è **il tuo tempo**: circa 8 ore a settimana di marketing, di cui 3 nel blocco di produzione del martedì.

⚠️ Il VPS passa da 6,10 a 21,96 €/mese il **14/10/2026**. Da quella data il break-even è **un solo cliente Coach**.

---

## 14. Rischi e contromisure

| Rischio | Prob. | Contromisura |
|---|---|---|
| **L'onboarding self-serve non attiva** — senza call, chi si blocca sparisce in silenzio | **Alta** | Modalità demo precaricata + email 3 + query 4 ogni venerdì. È il rischio n°1 del modello |
| I social portano ampiezza ma non compratori | Alta | Ottimizza per **salvataggi e iscritti qualificati**, mai per follower. Il modulo qualifica, il contenuto no |
| Il piano Club non converte senza interlocutore | Alta | PDF di una pagina per il DS + risposta scritta entro 24h. Misura il Club separatamente e non stupirti se è lento |
| Bruciarsi nei gruppi Facebook entrando a vendere | Media | Due settimane di sole risposte prima di pubblicare. Mai link nel post |
| Sei canali diventano sei lavori e si spegne tutto | **Alta** | Un pilastro a settimana, un blocco di produzione. Se salti una settimana, salti il pilastro — **non** aumenti il ritmo dopo |
| Dipendenza dall'algoritmo di una piattaforma | Media | Canale WhatsApp + lista email: l'unico pubblico che possiedi davvero |
| Immagini di minori | Media | §12.3 — regola assoluta, nessuna eccezione |
| Il tempo si disperde tra prodotto e marketing | Alta | Mattine al marketing, pomeriggi al codice. Nessuna feature nuova per 6 settimane se non difende l'attivazione |
| L'app trilingue tenta un'espansione prematura | Media | Solo IT per 90 giorni. EN e ES restano nel prodotto, zero asset di marketing finché non ci sono 5 clienti italiani |

---

## 15. I prossimi passi, in ordine

**Oggi:**

1. **Registra tutti gli handle social** di §2.3. Trenta minuti, costo zero, e non torna indietro.
2. **Scegli tra mockup A e B.** Non migliorarli: scegli.

**Questa settimana:**

3. **Crea le tabelle SQL** di §9.1 e collega il modulo lista d'attesa con i parametri UTM. Senza questo, tutto il resto è invisibile.
4. **Pubblica il sito LAB21** con il modulo funzionante e apri il Canale WhatsApp.
5. **Manda il messaggio §11.4 ai beta tester.** Screenshot, una frase, un video da 30 secondi. È la tua prova sociale e non ti costa una call.
6. **Mappa 6–10 gruppi Facebook** e leggi come si scrive lì dentro, prima di scrivere.

**Settimana prossima, in ordine di importanza:**

7. **La modalità dimostrativa precaricata.** È il pezzo che sostituisce la call di setup, ed è il singolo elemento da cui dipende se questo modello funziona o no.
8. Report PDF esempio, video demo, import CSV verificato.

---

*LAB21 — an innovation lab for science in sport*
*Documento interno · v2.0 · 5 agosto 2026*
