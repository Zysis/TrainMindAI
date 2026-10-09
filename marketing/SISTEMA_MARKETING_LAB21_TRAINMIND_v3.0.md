# Sistema di marketing LAB21 → TrainMind

**Documento operativo — versione 3.0 — 23 settembre 2026**
Base: *Piano_30_giorni_marketing_webapp_basket_AI.pdf* (aggiornato in parallelo a questo file).

> **Cosa cambia rispetto alla v2.0**
> Due soli canali attivi — **Instagram e LinkedIn** — invece di sei. I primi contenuti sono **già online** (un post e un reel sulla pagina Instagram LAB21), quindi questa versione parte da una **brand review di quello che è stato pubblicato** invece che da ipotesi.
> E introduce il pezzo che mancava: **il sistema hook** (§7), cioè le regole che decidono se un contenuto viene visto o scrollato. Il materiale prodotto finora ha una qualità di realizzazione alta e un'efficacia di distribuzione bassa: il problema non è come è fatto, è come comincia.

---

## 0. Come leggere questo documento

È la descrizione di una macchina: cosa entra (un preparatore che scorre Instagram), cosa esce (un abbonamento attivo), e quali pezzi devono esistere perché il passaggio avvenga **senza che tu debba parlare con nessuno**.

| Sezione | Cosa contiene | Quando la usi |
|---|---|---|
| 1 | Strategia e modello di vendita | Una volta, poi non si tocca |
| 2 | Brand system | Riferimento continuo |
| 3–5 | ICP, messaggio, pricing | Congelati per 90 giorni |
| **6–7** | **Canali e sistema hook** | **Ogni volta che produci** |
| 8–9 | Funnel, asset, misurazione | Ogni venerdì |
| 10–11 | Calendario e template | Ogni giorno |
| 12–15 | Vincoli, budget, rischi, prossimi passi | Prima di partire |

---

## 1. La strategia in una pagina

### Il modello a due fasi

Presenti prima LAB21, crei curiosità su TrainMind, sposti il focus sul prodotto quando è commerciabile. Corretto per un pubblico piccolo, competente e diffidente verso l'"AI nello sport". Con un rischio preciso.

**Il rischio:** costruire pubblico per un laboratorio e poi doverlo convertire a un software. Amplificato dal social: su Instagram raggiungi giocatori, genitori e appassionati — non compratori.

**La neutralizzazione:** senza lista d'attesa, il pubblico si qualifica con i contenuti stessi. Le *Lab notes* parlano di carico, presenze e report: un genitore o un tifoso non le salva, un preparatore sì. Per questo nel pre-lancio non si contano i follower in generale ma i **salvataggi**, le **risposte ai sondaggi** e i **follower arrivati dai caroselli** — sono le persone che il giorno dell'apertura vedranno l'annuncio.

| | **Fase 1 — LAB21 apre** | **Fase 2 — TrainMind vende** |
|---|---|---|
| **Durata** | Settimane 1–6 | Dalla settimana 7 |
| **Chi parla** | LAB21, il laboratorio | TrainMind, il prodotto |
| **Obiettivo** | Credibilità + contatti qualificati | Registrazioni, attivazioni, primi abbonamenti |
| **Promessa** | "Traduciamo la scienza dello sport in strumenti usabili il lunedì mattina" | "Il report di squadra in dieci minuti invece che in tre ore" |
| **CTA unica** | *Follow the lab* sui social, *Scopri di più* sul sito. Nessuna lista d'attesa (§15) | *Prova TrainMind — 21 giorni, senza carta* |
| **KPI primario** | Salvataggi dei caroselli e follower da non-follower | 40+ registrazioni, 20+ attivati, 3–6 paganti |
| **Cosa NON fare** | Vendere. Mai prezzi in Fase 1 | Parlare di AI prima del problema |

### Le tre regole che tengono insieme tutto

> **1. Prima il problema risolto, poi lo strumento, poi la tecnologia.**
> L'AI è l'ultimo argomento, mai il primo. "AI per il basket" attiva scetticismo. "Tre ore di report che diventano dieci minuti" attiva desiderio.

> **2. Ogni contenuto ha un solo compito: farsi salvare o seguire dalle persone giuste.**
> Non like generici. Se un formato non produce salvataggi o follower del settore in tre settimane, si taglia — anche se ha numeri belli.

> **3. Il primo secondo vale quanto tutti gli altri messi insieme.**
> Nuova in v3.0, e nasce dai dati di §6.1. Un contenuto perfetto che comincia male non viene visto: non è una questione di gusto, è aritmetica del feed.

### Il modello di vendita: cosa sostituisce cosa

Non ci sono call. Ogni funzione che di solito svolge un venditore deve essere svolta da un asset.

| Cosa fa di solito una call | Chi lo fa qui |
|---|---|
| Spiega cosa fa il prodotto | Video demo 3 minuti + report PDF di esempio |
| Costruisce fiducia | Contenuti LAB21 + beta tester reali nei contenuti |
| Qualifica il cliente | Le domande del modulo di iscrizione |
| Fa il setup iniziale | Import CSV/Excel + modalità dimostrativa precaricata |
| Gestisce le obiezioni | FAQ + pagina "come funziona l'AI" + email di sequenza |
| Fa follow-up | Email lifecycle automatiche (Resend) |
| Chiede la firma | Checkout Stripe self-serve |
| Convince la società | PDF di una pagina, pronto da girare al DS |

**Se uno di questi asset manca, quella funzione non viene svolta e il lead si perde in silenzio.** È l'unico vero rischio del modello senza call: il fallimento è invisibile. Per questo la §9 non è opzionale.

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

### 2.2 Regole di nomenclatura

| Contesto | Forma corretta | Forma sbagliata |
|---|---|---|
| Società | **LAB21** | Lab21, LAB 21, lab21 |
| Descrittore | *an innovation lab for science in sport* | traduzioni italiane |
| Prodotto | **TrainMind** | Trainmind, Train Mind, TRAINMIND, TrainMind AI |
| Prodotto + firma | **TrainMind** *by LAB21* | LAB21 TrainMind |

**Su "TrainMind AI":** resta il nome interno nella documentazione. **Sul mercato, mai.**

### 2.3 Identità visiva

Palette e tipografia sono canonizzate dai mockup `LAB21/mockup-a.html` / `mockup-b.html` e dal sito in `webpage_LAB21`.

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

**Tipografia:** Space Grotesk 600 per i titoli (tracking −0.035em), Inter 300/400/500 per il testo, JetBrains Mono 11px uppercase tracking 0.2em per etichette, numeri e date.

> **Nota risolta dalle note di consegna del reel.** Campionando `lab21-wordmark-light.png` compresi i pixel semitrasparenti, il "21" del marchio misura **(0, 201, 173) = `#00C9A7`**, non `#00A489`. `--acc-d` è il teal leggibile su fondo bianco, non il teal del segno.
> **Regola definitiva: sul fondo ink il wordmark usa `#00C9A7`.** `#00A489` si usa solo su fondo chiaro. Nel reel pubblicato convivono due verdi diversi nella scena finale — da correggere al prossimo export.

**Loghi** (`LAB21/logo/`): `lab21-wordmark.png` su fondi chiari, `lab21-wordmark-light.png` su fondi scuri, `lab21-mark-green.png` come icona, `LAB21-icon-original-font-512/1024.png` per app icon e profili. Area di rispetto pari all'altezza del "2"; mai ricolorato, ruotato o su foto senza velatura.

### 2.4 Tono di voce

1. **Concreto prima che ispirazionale.** "Il report in dieci minuti" batte "rivoluzioniamo la performance".
2. **Il numero al posto dell'aggettivo.** Non "molto più veloce": "da 3 ore a 10 minuti".
3. **Il linguaggio del campo, non del paper.** "Carico", "rientro", "seduta".
4. **L'AI come assistente, mai come oracolo.** "Ti prepara il report, tu decidi."

| | LAB21 | TrainMind |
|---|---|---|
| Voce | il laboratorio che spiega | il collega che ti toglie lavoro |
| Persona | "noi" | "tu" |
| Frase tipo | "Abbiamo guardato come lavorano quattordici preparatori. Ecco cosa non torna." | "Carichi il roster. Il primo report esce in dieci minuti." |

**Adattamento social:** il tono si accorcia ma **non si abbassa**. Niente slang forzato, niente emoji a pioggia, niente hook urlati ("STOP! Se sei un preparatore devi vedere questo"). Il pubblico è fatto di professionisti: funziona il registro *collega competente che condivide una cosa utile*, non *creator che vende*.

*Usa:* carico, recupero, rientro, wellness, seduta, staff, società, report, leggibile, il lunedì mattina, decisione.
*Evita:* rivoluzionario, game changer, all-in-one, potenziato dall'AI, sfrutta il potere di, unlock.

### 2.5 La lingua — decisione del 23/09/2026

**Il testo a schermo dei video è in inglese.** Scelta deliberata: tiene la voce di LAB21 coerente con il descrittore di marca, col sito (già trilingue) e con un posizionamento non limitato all'Italia.

**La didascalia dei post è in italiano.** Questa è la contromisura che rende la scelta sostenibile, e va applicata sempre. Il video porta la voce del marchio; la didascalia porta il pubblico. Instagram legge il testo del post per capire a chi mostrarlo: una didascalia italiana mantiene la distribuzione sul basket italiano — che è il target dei primi 90 giorni — anche con un video in inglese.

**Il costo da mettere in conto.** L'inglese a schermo in un feed italiano comunica *"forse non è per me"* nella stessa mezza finestra in cui si decide la visualizzazione. È il rilievo n°4 della brand review (§6.1), e la decisione lo accetta consapevolmente invece di rimuoverlo. Per questo va misurato: se la retention a 3 secondi resta sotto il 35% dopo tre reel con hook diversi, la lingua è la prima variabile da testare — un solo reel identico con il frame 0 in italiano dà la risposta in una settimana.

---

## 3. ICP — a chi vendi davvero

> **Preparatore fisico o responsabile performance di club di basket italiano tra Serie B Interregionale e A2, o di academy/settore giovanile con almeno 3 squadre.**

**Chi escludere ora:** Serie A (ciclo lungo, staff già dotati), minibasket puro (nessun budget), altri sport (diluisci il "basket-first", che è il tuo unico vero differenziale).

| Pr. | Segmento | Volume IT | Piano atteso | Canale |
|---|---|---|---|---|
| **A** | Preparatore di club B Interregionale / B Naz / A2 | 250–350 | Staff | **Instagram** |
| **A** | Responsabile performance academy 3+ squadre | 80–150 | Club | **LinkedIn** |
| **B** | Preparatore indipendente con più club | 200–400 | Coach | **Instagram** |
| **C** | Società senza preparatore dedicato | molte | Club | *non ora* |
| **P** | Partner: formatori, clinic, docenti, creator | 30–50 | — | LinkedIn + DM |

### I 5 pain point, nel loro linguaggio

Sono i ganci: **ogni contenuto parte da uno di questi, mai dal prodotto.**

1. **"Il report me lo faccio la domenica sera."** Tre ore di Excel per qualcosa che il capo allenatore guarda quaranta secondi.
2. **"I dati sono in quattro posti diversi."** GPS, test da campo, wellness su WhatsApp, presenze su carta.
3. **"Quando salta il file, salta la stagione."** Un Excel su un portatile, senza backup.
4. **"Devo giustificare le mie scelte."** Quando il DS chiede perché quel giocatore non si allena.
5. **"Se cambio società ricomincio da zero."** Il metodo vive nella tua testa, non in uno strumento.

### Le 6 obiezioni — e la risposta

Senza call, queste risposte vivono nella FAQ, nelle email di sequenza e nelle didascalie dei post.

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

**Headline:** *Trasformiamo i dati in performance reale.*
**Sottotitolo:** *Non vendiamo teoria. Costruiamo strumenti che vengono usati il lunedì mattina.*

**Le tre prove:** metodo scientifico con output pratico; costruito **con** chi allena (i beta tester sono preparatori in attività, e lo dimostri mostrandoli); TrainMind è il primo software che esce dal laboratorio.

**CTA unica di Fase 1:** quella che è già pubblicata — *Scopri di più* → `/app`. Da rafforzare in *Prova TrainMind* appena le registrazioni sono aperte: «scopri» non promette niente, «prova» sì. Nessuna lista d'attesa: sui social la chiamata all'azione è *Follow the lab* (§15).

### 4.2 TrainMind — Fase 2

> **Il report di squadra che ti prendeva tre ore, in dieci minuti.**
> TrainMind è la piattaforma di gestione della preparazione fisica pensata per il basket: carichi i dati una volta e ottieni report leggibili per staff e società, con un assistente AI che scrive la sintesi e tu che decidi.

**Tre bullet:**
- **Un posto solo.** Carichi, test, wellness, presenze, rientri — un dato, un posto, tutta la stagione.
- **Report in un clic.** PDF pulito per il capo allenatore e per la società. Anche da tablet a bordo campo.
- **L'AI scrive, tu decidi.** La sintesi la prepara l'assistente. La firma è sempre tua.

**Tre angoli, che sono anche tre filoni di contenuto:**
- *Credibilità:* "Quando il DS ti chiede perché quel giocatore non si allena, hai una risposta con i dati dietro."
- *Continuità:* "Il tuo metodo smette di vivere solo nella tua testa."
- *Basket-first:* "Non è un software da calcio adattato. Nasce sul parquet."

---

## 5. Offerta e pricing

| | **Coach** | **Staff** | **Club** |
|---|---|---|---|
| Per chi | preparatore singolo | preparatore + staff | società / academy |
| Atleti | fino a 20 | fino a 45 | illimitati |
| Utenti | 1 | fino a 4 | illimitati |
| Squadre | 1 | 2 | illimitate |
| Report AI/mese | 20 | 80 | illimitati* |
| **Mensile** | **29 €** | **69 €** | **149 €** |
| **Annuale (−20%)** | **278 €** | **662 €** | **1.430 €** |

\* soglia tecnica alta non pubblicizzata (vedi `documentation/GUIDA_ROUTING_AI_E_CONSUMO.md`).

### L'ingresso: prova self-serve

> **TrainMind — 21 giorni, senza carta di credito**
> 1. Ti registri. **Entri già dentro una squadra dimostrativa completa**: 12 atleti, 8 settimane di storico, un sovraccarico e un rientro. Vedi il prodotto che funziona prima di caricare qualsiasi cosa tua.
> 2. Quando vuoi, importi il tuo roster da Excel o CSV.
> 3. Generi il primo report vero. Obiettivo: **entro dieci minuti dalla registrazione.**
> 4. Il giorno 18 ricevi il riepilogo di cosa hai costruito e l'offerta.

**La modalità dimostrativa precaricata è il pezzo decisivo.** I trial self-serve muoiono perché l'utente entra in un prodotto vuoto e deve lavorare prima di ricevere valore. Con i dati demo l'ordine si inverte. È l'unico modo per sostituire la call di setup senza perdere il grosso delle registrazioni.

**Ai beta tester attuali:** conversione **early adopter −40% a vita**, con scadenza a 30 giorni dall'apertura dei pagamenti.

**Riserva onesta sul piano Club:** una società raramente firma 149 €/mese senza che nessuno le parli. Non serve una call di vendita, serve un equivalente asincrono — il **PDF di una pagina per il DS** e una risposta scritta entro 24 ore. Misura il Club separatamente e non stupirti se è lento.

---

## 6. I due canali

Instagram e LinkedIn. Due canali con **due compiti diversi**, non lo stesso contenuto pubblicato due volte.

| | **Instagram** | **LinkedIn** |
|---|---|---|
| Compito | Ampiezza: farsi scoprire da chi non ti cerca | Profondità: società, DS, academy, partner |
| Segmento | A (preparatori di club), B (indipendenti) | A (academy, responsabili performance), P (partner) |
| Formato principale | Reel verticale 9:16 | Post testuale dal **profilo personale** |
| Formato secondario | Carosello 6–8 slide | Carosello PDF / documento |
| Cadenza | 3 contenuti/settimana | 1 post/settimana |
| Metrica che conta | **Salvataggi** e retention a 3s | Commenti di persone del settore |
| CTA | Link in bio | Link nel primo commento |

**Due precisazioni operative.**

**Su Instagram la metrica è il salvataggio, non il like.** Un preparatore che salva un carosello sul carico è un compratore. Uno che mette like è passato di lì. Ottimizza per contenuti-riferimento: checklist, tabelle, "i 4 dati che servono al rientro".

**Su LinkedIn pubblica dal profilo personale, non dalla pagina.** Nel B2B di nicchia una pagina ha una reach di un ordine di grandezza inferiore a un profilo umano. La pagina LAB21 serve per esistere e per la vetrina; il profilo serve per essere visto. E il link va nel primo commento, non nel testo: i post con link esterno nel corpo vengono distribuiti meno.

> **Il canale che stai lasciando sul tavolo.** Il preparatore italiano tra i 35 e i 55 anni vive nei **gruppi Facebook** di allenatori e preparatori, ed è il pubblico più qualificato che esista. Non è nel piano perché hai due canali e aprirne un terzo senza capacità li peggiora tutti. Ma quando Instagram gira da solo, quello è il terzo canale — non TikTok, non YouTube.

### 6.1 Brand review: cosa dicono i contenuti già pubblicati

Analisi del materiale in `marketing/spot/`, misurata sui file consegnati.

**Quello che funziona, e va difeso.** La qualità di realizzazione è alta e fuori scala rispetto alla concorrenza di categoria: tipografia coerente, palette rispettata, transizioni pulite, audio masterizzato a −2 dBFS, mascheratura dei marchi di terzi, rimozione dei nomi atleti dalla heatmap. La cura sui vincoli legali è già al livello giusto (§12). **Il problema non è come è fatto. È come comincia, e in che lingua.**

| # | Rilievo | Dove | Gravità | Cosa fare |
|---|---|---|---|---|
| 1 | **Mezzo secondo senza una parola.** Il primo testo compare al frame 15 (0,50s), la frase è piena al frame 19 (0,63s). La decisione di scroll avviene prima | reel 24s e 10s, apertura | **Alta** | Frame 0 con la frase già a schermo |
| 2 | **Copertina scura.** Luminanza media del frame 0 = **22/255** (8,7% del bianco). Nel feed è una miniatura nera | idem | **Alta** | Frame 0 sopra 60/255, o testo su fondo pieno |
| 3 | **Tutto in inglese per un pubblico italiano** | tutte le scene | **Alta** | Rifare le scritte in italiano |
| 4 | **L'hook vero è al secondo 13.** «Your reports, every Sunday night» è l'unica frase che nomina il problema del cliente, e arriva quando il grosso degli spettatori è già andato | S3, master 24s | **Alta** | Spostarla al frame 0 |
| 5 | **Struttura istituzionale.** Contesto → problema → beneficio → marchio: il payoff è in fondo. Nel feed la struttura va invertita | intero pezzo | **Alta** | §7.2 |
| 6 | **Il «link in bio» finisce su una porta chiusa.** Non è un link rotto — vedi la rettifica qui sotto — ma l'unica azione del sito porta a `/app`, dove le registrazioni sono chiuse (`DISABLE_REGISTRATION=true`) | reel + sito | **Alta** | §15: decidere quando si apre |
| 7 | **Due verdi diversi nella scena finale** («21» a `#00A489`, «link in bio» a `#00C9A7`) | S5 | Media | Vedi §2.3: sul fondo ink si usa `#00C9A7` |
| 8 | **Lo spot da 7,5s è 16:9** con dentro una schermata di sito: nel feed mobile è piccolo e il testo dell'interfaccia è illeggibile | `LAB21-spot-7.5s.mp4` | Media | Riquadrare 9:16 o 4:5, o usarlo solo su LinkedIn |
| 9 | 24 secondi senza una ragione per restare dopo il terzo | master | Media | Il taglio da 10s è più adatto al feed |

> **Rettifica del 23/09/2026 — due rilievi di questa tabella erano sbagliati.**
> Nella prima stesura avevo segnalato come **critico** che la CTA puntasse a `waitlist: '#'`, e avevo scritto che il sito promette un report di esempio via email. **Entrambe le cose sono false**, e l'errore è nel metodo: avevo letto `src/sections/contact.html` trattandolo come testo pubblicato, senza controllare il build.
>
> La verità, verificata su `dist/index.html`: la sezione contatti è stata **tolta deliberatamente** dalla pagina (`index.html` riga 33 lo dice esplicitamente) e le voci `contact.*` sono state rimosse dai dizionari. Quel file resta solo come riferimento dormiente. Quindi non esiste nessuna promessa di report via email, e nessun link `'#'` pubblicato: `waitlist` è una voce di configurazione inerte, con un TODO accanto.
>
> **Il sito pubblicato ha una sola azione:** `data-link="trainmind"` → «Scopri di più» → `/app`, con i parametri di campagna già riattaccati correttamente da `withCampaign`. È una scelta coerente, non un difetto. Il collo di bottiglia vero è a valle: quella porta oggi è chiusa.

**Conformità:** nessun claim sanitario, nessun dato numerico di prodotto non verificabile, AI mai presentata come decisore. Su questo il materiale è a posto e va mantenuto così.

**In una riga:** hai prodotto un ottimo spot istituzionale e lo hai messo in un feed. Sono due mestieri diversi, e il secondo si governa con le regole che seguono.

---

## 7. Il sistema hook

Questo capitolo è il motivo per cui esiste la v3.0. L'hook non è una frase a effetto: è **la struttura dei primi tre secondi**, e vale più di tutta la produzione che viene dopo.

### 7.1 Perché conta così tanto

Nel feed, la distribuzione è a cascata: la piattaforma mostra il contenuto a un primo gruppo, misura quanti restano oltre i primi secondi, e in base a quello decide se mostrarlo a un gruppo dieci volte più grande. La **retention a 3 secondi** è il primo cancello. Un contenuto che ne supera la metà viene spinto; uno sotto muore nel primo gruppo, per quanto sia bello il resto.

Il corollario scomodo: **fra un reel bellissimo che parte piano e un reel mediocre che parte bene, vince il secondo.** Non è giusto, è come funziona la distribuzione.

### 7.2 L'inversione narrativa

È la regola più importante del capitolo.

```
   STRUTTURA ISTITUZIONALE (quella del reel pubblicato)

   contesto  →  problema  →  beneficio  →  marchio
      0s          9s           15s          20s
                                              ▲
                                    il payoff è QUI, alla fine


   STRUTTURA DA FEED (quella da usare)

   PROBLEMA  →  riconoscimento  →  prova  →  marchio
      0s             3s             6s        9s
        ▲
   il payoff è QUI, all'inizio
```

Lo spot in sala costruisce verso il marchio, perché lo spettatore non può andarsene. Nel feed lo spettatore se ne va di default: devi **pagarlo subito** e dargli un motivo per restare.

Detto in un altro modo: **l'ultima frase del tuo reel attuale è la prima del prossimo.**

### 7.3 Le quattro leggi del frame 0

Il frame 0 non è l'inizio del video. È la **copertina** nel feed, nella griglia del profilo, nell'anteprima delle condivisioni. Vale come un manifesto.

| Legge | Regola | Verifica |
|---|---|---|
| **1. Il testo c'è già** | Nessun fade da nero, nessun testo che entra in dissolvenza. La frase è leggibile al frame 0 | Estrai il frame 0 e guardalo: si capisce di cosa parli? |
| **2. Si vede** | Luminanza media > 60/255, oppure testo bianco su fondo pieno `#07100E` | Misurabile (§7.7) |
| **3. Sei-dieci parole** | Una sola fissazione oculare. Se serve rileggere, è lungo | Contale |
| **4. In italiano** | Sempre, tranne il descrittore di marca | Ovvio, ma è l'errore n°3 di §6.1 |

**Il modo più semplice di rispettare tutte e quattro:** frame 0 = **cartello pieno**, fondo `#07100E`, frase bianca grande con due parole in `#00C9A7`. Il video vero comincia al frame 12. Costa niente e risolve il problema strutturale.

### 7.4 Le quattro famiglie di hook

Ogni hook appartiene a una famiglia, e ogni famiglia lavora su una leva psicologica diversa. Alternale: tre reel di fila della stessa famiglia stancano.

#### A — Il momento riconoscibile
Nomina un momento preciso della loro settimana. Funziona perché l'identificazione è istantanea: *"sta parlando esattamente di me"*.

> **«Domenica sera. Tre ore di Excel.»**
> **«I tuoi report, ogni domenica sera.»** ← è già nel tuo reel, al secondo 13
> **«Sono le 22 di domenica e stai ancora sistemando il file.»**

*Perché funziona:* "domenica sera" è infinitamente più forte di "ogni settimana". Un momento datato crea un'immagine; un avverbio di frequenza no.

#### B — Il numero scomodo
Un rapporto che non torna. Apre una domanda a cui si vuole una risposta.

> **«Tre ore di report. Quaranta secondi di lettura.»**
> **«Su tre ore di report, due sono copia-incolla.»**
> **«Il file da cui dipende la tua stagione sta su un portatile.»**

*Perché funziona:* lo squilibrio tra i due numeri è il contenuto. Non serve aggettivarlo.

#### C — L'opinione contraria
Una frase che una parte del pubblico ha voglia di contestare. Genera commenti, e i commenti sono il carburante della distribuzione.

> **«Excel non è il tuo problema.»**
> **«Il report più bello che fai non lo legge nessuno.»**
> **«Il tuo metodo vale zero se vive solo nella tua testa.»**

*Perché funziona:* il dissenso costa meno del consenso, in termini di energia per commentare. Ma la frase deve essere **difendibile** nei secondi successivi, altrimenti è provocazione a vuoto e brucia credibilità.

#### D — La domanda diretta al ruolo
Auto-seleziona il pubblico e chiede una risposta che costa tre secondi.

> **«Preparatori: quanto ci mettete a fare il report settimanale?»**
> **«Chi di voi il wellness lo raccoglie ancora su WhatsApp?»**
> **«Quanti file apri per preparare una seduta?»**

*Perché funziona:* nominare il ruolo nella prima riga filtra e insieme chiama. Chi non è preparatore scrolla — e va benissimo, perché la retention si misura su chi resta.

**Le tre frasi da non usare mai:** «Scopri come…», «In questo video ti spiego…», «Se sei un preparatore, continua a guardare». Annunciano il contenuto invece di darlo. L'annuncio è il modo più veloce di perdere il secondo di attenzione che avevi.

### 7.5 L'hook di caption — due regole diverse per due canali

L'hook non è solo nel video. È anche la prima riga di testo, e le due piattaforme tagliano in punti diversi.

**Instagram:** vengono mostrate le prime **2 righe (~125 caratteri)** prima di "… altro". Tutto quello che c'è dopo esiste solo per chi ha già deciso di aprire.

> ✅ «Domenica sera, tre ore di Excel, e il lunedì nessuno apre il file.
> Abbiamo chiesto a dieci preparatori come lo fanno. Poi…»
>
> ❌ «In LAB21 crediamo che la scienza dello sport debba tradursi in strumenti concreti per chi lavora ogni giorno sul campo…»

**LinkedIn:** taglia intorno a **200 caratteri / 3 righe**. Il registro è più analitico: l'hook può essere un'osservazione invece di un colpo.

> ✅ «Non è l'analisi che porta via il tempo a un preparatore fisico.
> È tutto quello che viene prima.
> Il carico sta in un foglio, le presenze su un quaderno, il wellness in una chat…»

> **Nessun numero inventato negli hook.** Una prima stesura di questo esempio citava una «media di due ore e quaranta» ricavata da un sondaggio che non esiste. Una statistica si usa solo se è vera: i sondaggi del venerdì (`prelancio/CALENDARIO_PRELANCIO.md`) servono proprio a produrne.

**Regola comune:** la prima riga non contiene mai il nome del prodotto. Il marchio arriva dopo che la persona si è riconosciuta nel problema.

### 7.6 Il materiale che hai già: ri-montare, non rigirare

Non serve produrre niente di nuovo per applicare tutto questo. Il master 24s contiene già le scene giuste **nell'ordine sbagliato**.

**Taglio proposto — «Domenica sera», 11 secondi, italiano, 9:16**

| | Durata | Fonte | Testo a schermo |
|---|---|---|---|
| **Frame 0** | 0–0,4s | cartello pieno nuovo | **It's not the analysis that takes up your time.** *(già a schermo dal primo fotogramma)* |
| 1 | 0,4–3s | S3 esistente | *Two of those three hours are copy-paste between files.* |
| 2 | 3–6s | S2 esistente (scanline) | *Your data lives in four different places.* |
| 3 | 6–9s | S4 esistente (strumento) | *We're building the tool that puts it back together.* |
| 4 | 9–11s | S5 esistente (logo) | **LAB21** — *Train more, decide better.* |

Tre interventi soltanto: **tradurre le scritte**, **riordinare le scene**, **aggiungere il cartello iniziale**. Il girato, l'audio, le transizioni e il logo sting restano quelli consegnati.

**Nota sul loop.** Se l'ultimo fotogramma richiama visivamente il primo (stesso fondo, stessa posizione del testo), il reel si riavvia senza stacco percepibile e una parte degli spettatori lo riguarda. Le ripetizioni contano come visualizzazioni e alzano il tempo medio. È gratis: basta far combaciare due frame.

### 7.7 Il test prima di pubblicare

Sei controlli, cinque minuti. Se uno fallisce, non si pubblica.

1. **Frame 0** — estratto e guardato da solo: si capisce di cosa parla?
2. **Luminanza del frame 0** > 60/255.
3. **Test del muto** — guardalo senza audio: il messaggio passa lo stesso? (L'80% lo guarderà così.)
4. **Test del pollice** — guardalo a 480px di larghezza tenendo il telefono a distanza normale: la frase si legge?
5. **Test dei tre secondi** — fermalo a 3s: uno che non ti conosce ha capito il problema di cui parli?
6. **La CTA porta da qualche parte** — cliccala davvero.

Il comando per i controlli 1 e 2:

```bash
# frame 0 come immagine
ffmpeg -i reel.mp4 -frames:v 1 frame0.png -y

# luminanza media del frame 0 (soglia: > 60)
python3 -c "
from PIL import Image; import numpy as np
a=np.array(Image.open('frame0.png').convert('RGB'),dtype=float)
print('luminanza:', round(float((a*[0.2126,0.7152,0.0722]).sum(2).mean()),1), '/255')"
```

### 7.8 Cosa misurare per sapere se l'hook funziona

| Metrica | Dove | Soglia buona | Se sotto |
|---|---|---|---|
| **Retention a 3s** | Insights del reel | **> 55%** | L'hook è sbagliato. Cambia famiglia, non il montaggio |
| Visualizzazioni da non-follower | Insights | > 60% | Sotto: il contenuto non viene distribuito fuori |
| Salvataggi / visualizzazioni | Insights | > 1,5% | Sotto: è intrattenimento, non riferimento |
| Click al link in bio | UTM in SQL (§9) | — | Zero click con molte visualizzazioni = CTA debole |
| **Iscritti qualificati** | Query §9.2 | l'unica che conta davvero | — |

**Il protocollo di test:** stesso contenuto, hook di famiglie diverse, tre settimane. Non cambiare due cose insieme. In quattro settimane sai quale famiglia funziona sul tuo pubblico, e quella diventa lo standard.

---

## 8. La fabbrica dei contenuti

Due canali, un solo pensiero a settimana.

### 8.1 Il pilastro settimanale

```
              ┌─────────────────────────┐
              │   PILASTRO SETTIMANALE  │
              │   (un tema, un'idea)    │
              └───────────┬─────────────┘
                          │
        ┌─────────┬───────┴────────┬──────────┐
        ▼         ▼                ▼          ▼
    Reel IG   Carosello IG    Post LinkedIn  Storie
    (hook §7)   7 slide         6-10 righe   +sondaggio
```

Quattro pezzi da un'ora di pensiero. Il pilastro si scrive una volta; ogni derivato è una riformattazione, non un contenuto nuovo.

### 8.2 I sei pilastri della Fase 1

1. **Perché il report settimanale ti prende tre ore** (e quali due ore sono sprecate)
2. **Excel non è il problema.** Il problema è che l'Excel muore con te
3. **Cosa guarda davvero un capo allenatore** in un report di carico
4. **Wellness su WhatsApp:** perché non funziona e cosa fare invece
5. **Rientro da infortunio:** i 4 dati che nessuno registra e servono tutti
6. **Excel vs piattaforma basket-first:** il confronto onesto, anche dove Excel vince

Il sesto diventa la **pagina evergreen** sul sito: continuerà a portare iscritti da ricerca e da LLM per mesi.

### 8.3 Il formato di ogni derivato

| Derivato | Struttura | Misura |
|---|---|---|
| **Reel** | Frame 0 = hook (§7.3). Poi 3 punti. Ultimo frame = marchio + CTA | 10–15s, testo grande, **guardabile senza audio** |
| **Carosello** | Slide 1 = l'hook, identico a quello del reel. Slide 2–6 = un'idea ciascuna. Slide 7 = riepilogo salvabile. Slide 8 = LAB21 + CTA | 7–8 slide |
| **Post LinkedIn** | Osservazione → perché non torna → cosa ne concludiamo → CTA leggera. Link nel **primo commento** | 6–10 righe |
| **Storia** | 3 frame: problema, dato, sondaggio ("Quanto ci metti tu?") | il sondaggio è il pezzo utile |

### 8.4 I tre template grafici da produrre una volta

Palette e font di §2.3. Servono per non ridisegnare niente ogni settimana.

1. **Cartello hook** — fondo `#07100E`, frase Space Grotesk grande, due parole in `#00C9A7`. È il frame 0 di ogni reel e la slide 1 di ogni carosello.
2. **Slide carosello** — stesso fondo, etichetta mono in alto, wordmark chiaro in basso a destra.
3. **Card dato** — il numero enorme in mono, la fonte piccola sotto. È il formato più condiviso.

### 8.5 Il ritmo: un blocco, non sette giorni

**Un blocco di produzione a settimana** (2–3 ore, martedì): scrivi il pilastro e sforni tutti i derivati. Gli altri giorni: solo pubblicazione e risposte ai commenti.

### 8.6 I beta tester come contenuto

Hai preparatori professionisti che **stanno già usando il prodotto**. È la risorsa più preziosa che possiedi, e non richiede nessuna call. Chiedi tre cose in asincrono (§11.4):

1. **Uno screenshot** di una loro schermata reale, con i nomi oscurati.
2. **Una frase:** *"In una riga, cosa diresti a un collega?"*
3. **Un video di 30 secondi** girato col telefono. Non deve essere bello: deve essere vero.

Da questi ricavi le prove sociali della landing, tre reel, un carosello e la risposta a metà delle obiezioni. **Un professionista in attività che dice "lo uso" chiude più conversazioni di dieci post tuoi** — e, per l'algoritmo, un volto reale in un feed di grafica tiene l'attenzione più a lungo di qualunque animazione.

---

## 9. Misurazione: il database al posto del CRM

Senza call, il fallimento è silenzioso: nessuno ti dice che si è bloccato, sparisce e basta. Il database ti dà una cosa che nessun CRM darebbe: **unire l'attribuzione marketing all'uso reale del prodotto**, perché possiedi entrambe le tabelle.

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
  fonte           TEXT,            -- instagram | linkedin | referral | diretto
  campagna        TEXT,            -- utm_campaign: il pilastro settimanale
  contenuto       TEXT,            -- utm_content: il singolo post/reel
  hook_famiglia   TEXT,            -- a | b | c | d  (§7.4) — quale hook ha portato questa persona
  referrer_lead_id BIGINT REFERENCES marketing_lead(id),
  -- stato
  stato           TEXT NOT NULL DEFAULT 'lista',
                                   -- lista | invitato | registrato | attivato | trial | cliente | perso
  user_id         UUID,
  motivo_perso    TEXT,
  note            TEXT
);

-- La qualifica: l'unica definizione di "iscritto che conta"
ALTER TABLE marketing_lead ADD COLUMN qualificato BOOLEAN
  GENERATED ALWAYS AS (
    ruolo IN ('preparatore','allenatore','dirigente')
    AND societa IS NOT NULL AND societa <> ''
  ) STORED;

CREATE INDEX idx_lead_fonte ON marketing_lead(fonte, created_at);
CREATE INDEX idx_lead_hook  ON marketing_lead(hook_famiglia);
CREATE INDEX idx_lead_stato ON marketing_lead(stato);
CREATE INDEX idx_lead_qual  ON marketing_lead(qualificato) WHERE qualificato;

-- Cosa fanno: un evento per ogni passo del funnel
CREATE TABLE marketing_event (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     BIGINT NOT NULL REFERENCES marketing_lead(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo        TEXT NOT NULL,
    -- iscrizione | invito_inviato | registrazione | demo_vista | roster_caricato
    -- | primo_report | trial_avviato | trial_scaduto | pagamento | disdetta
  payload     JSONB
);

CREATE INDEX idx_event_lead ON marketing_event(lead_id, occurred_at);
CREATE INDEX idx_event_tipo ON marketing_event(tipo, occurred_at);
```

**La colonna `hook_famiglia` è nuova in v3.0.** È quella che dopo quattro settimane ti dice non solo *quale canale* funziona, ma *quale tipo di apertura* porta persone che poi provano davvero il prodotto. È l'unico modo di trasformare l'hook da opinione a dato.

### 9.2 Le query del venerdì

```sql
-- 1) Funnel per canale
SELECT
  l.fonte,
  count(*)                                                                      AS iscritti,
  count(*) FILTER (WHERE l.qualificato)                                         AS qualificati,
  count(*) FILTER (WHERE l.stato IN ('registrato','attivato','trial','cliente')) AS registrati,
  count(*) FILTER (WHERE l.stato IN ('attivato','trial','cliente'))              AS attivati,
  count(*) FILTER (WHERE l.stato = 'cliente')                                   AS clienti,
  round(100.0 * count(*) FILTER (WHERE l.qualificato) / nullif(count(*),0), 1)  AS pct_qualificati
FROM marketing_lead l
WHERE l.created_at >= now() - interval '30 days'
GROUP BY l.fonte
ORDER BY qualificati DESC;

-- 2) Quale FAMIGLIA DI HOOK porta persone che poi attivano davvero
SELECT
  l.hook_famiglia,
  count(*)                                                         AS iscritti,
  count(*) FILTER (WHERE l.qualificato)                            AS qualificati,
  count(*) FILTER (WHERE l.stato IN ('attivato','trial','cliente')) AS attivati,
  round(100.0 * count(*) FILTER (WHERE l.stato IN ('attivato','trial','cliente'))
        / nullif(count(*),0), 1)                                   AS pct_attivati
FROM marketing_lead l
WHERE l.created_at >= now() - interval '60 days'
  AND l.hook_famiglia IS NOT NULL
GROUP BY l.hook_famiglia
ORDER BY attivati DESC;

-- 3) Quali contenuti generano iscritti QUALIFICATI (non solo traffico)
SELECT campagna, contenuto, hook_famiglia,
       count(*)                            AS iscritti,
       count(*) FILTER (WHERE qualificato) AS qualificati
FROM marketing_lead
WHERE created_at >= now() - interval '30 days'
GROUP BY campagna, contenuto, hook_famiglia
HAVING count(*) FILTER (WHERE qualificato) > 0
ORDER BY qualificati DESC
LIMIT 15;

-- 4) Tempo al primo report: la metrica prodotto che decide tutto
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

-- 5) Chi si è bloccato: registrati senza primo report entro 48h.
--    Nel modello senza call, QUESTA è la lista su cui agire — con una email, non con una chiamata
SELECT l.id, l.email, l.societa, l.fonte, r.occurred_at
FROM marketing_lead l
JOIN marketing_event r      ON r.lead_id = l.id AND r.tipo = 'registrazione'
LEFT JOIN marketing_event p ON p.lead_id = l.id AND p.tipo = 'primo_report'
WHERE p.id IS NULL
  AND r.occurred_at < now() - interval '48 hours'
  AND r.occurred_at > now() - interval '21 days'
ORDER BY r.occurred_at DESC;
```

### 9.3 Dashboard KPI — venerdì, 15 minuti

| Area | Metrica | Target mese 1 | Allerta |
|---|---|---|---|
| Hook | **Retention a 3s dei reel** | **> 55%** | < 35% |
| Hook | Visualizzazioni da non-follower | > 60% | < 40% |
| Instagram | Salvataggi / settimana | 60+ | < 20 |
| LinkedIn | Commenti di gente del settore | 5+/post | < 2 |
| Traffico | Visite alla landing | 800–1.500 | < 400 |
| Lista | **Iscritti qualificati** | 80–120 | < 50 |
| Qualità | % qualificati sul totale | > 55% | < 35% |
| Prodotto | Registrazioni al trial | 40+ | < 20 |
| Prodotto | **Tempo mediano al primo report** | **< 10 min** | **> 20 min** |
| Prodotto | Attivati (≥1 report vero) | 20+ | < 10 |
| Business | Clienti paganti | 3–6 | 0 |
| Produzione | Pilastri pubblicati | 6 | < 4 |

**Le due metriche che decidono tutto** stanno alle due estremità del funnel: la **retention a 3 secondi** (se non entra nessuno, non c'è niente da convertire) e il **tempo al primo report** (se chi entra non arriva al valore, non c'è niente da vendere). Le altre dieci sono diagnostica.

**Rituale del venerdì (30 minuti):** aggiorni i numeri, leggi i `motivo_perso` della settimana, ed **elimini un attrito**. Uno alla settimana, per sei settimane.

---

## 10. Calendario operativo — 6 settimane

### Settimana 1 — Riparare, poi ripartire

| Giorno | Focus | Output |
|---|---|---|
| 1 | **Parte il calendario pre-lancio** (`prelancio/CALENDARIO_PRELANCIO.md`): il reel della settimana 1 | Serie avviata |
| 2 | Crea le tabelle SQL (§9.1), inclusa `hook_famiglia` | Tracciamento vivo |
| 3 | Produci i 3 template grafici (§8.4), a partire dal **cartello hook** | Fabbrica pronta |
| 4 | **Ri-monta il reel esistente** secondo §7.6: italiano, hook al frame 0, 11 secondi | Reel v2 |
| 5 | Pubblica il reel v2. **Pilastro 1** + derivati. Messaggio ai beta tester (§11.4) | Prima settimana vera |

### Settimana 2 — Gli asset che sostituiscono le call

| Giorno | Focus | Output |
|---|---|---|
| 6 | **Modalità dimostrativa precaricata**: 12 atleti, 8 settimane, un sovraccarico, un rientro | Il pezzo P0 |
| 7 | Verifica l'import roster da CSV/Excel. Cronometra il percorso completo | Attivazione difesa |
| 8 | Report PDF esempio (4 pagine) | L'asset centrale |
| 9 | Video demo 3 minuti + video "importa il roster" | Vendita asincrona |
| 10 | **Pilastro 2** + derivati. Confronta la retention a 3s del reel v2 con il primo | Primo dato sull'hook |

### Settimana 3 — Il ciclo di vita automatico

| Giorno | Focus | Output |
|---|---|---|
| 11 | Le 7 email lifecycle (§11.3), agganciate agli eventi SQL | Il venditore automatico |
| 12 | FAQ + pagina "come funziona l'AI" + PDF di una pagina per il DS | Obiezioni gestite |
| 13 | Raccogli screenshot, frasi e video dai beta tester. Montali | Prova sociale |
| 14 | Primo post LinkedIn con struttura §7.5, link nel primo commento | Secondo canale acceso |
| 15 | **Pilastro 3** + derivati, con hook di **famiglia diversa** dal pilastro 1 | Test hook in corso |

### Settimana 4 — Itera sui dati, non sulle sensazioni

| Giorno | Focus | Output |
|---|---|---|
| 16 | Query 1, 2 e 3: quale canale, quale hook, quale contenuto. **Taglia il peggiore** | Meno lavoro, più resa |
| 17 | Riscrivi headline e CTA della landing sui dati reali | Landing v2 |
| 18 | Riquadra in 9:16 lo spot da 7,5s (rilievo 8 di §6.1) o spostalo su LinkedIn | Formato corretto |
| 19 | Query 4: tempo al primo report. Se > 20 min, **fermi tutto e sistemi l'onboarding** | Attivazione sana |
| 20 | **Pilastro 4** + derivati. Elimina un attrito | Iterazione |

### Settimana 5 — Prepara la Fase 2

| Giorno | Focus | Output |
|---|---|---|
| 21 | Landing TrainMind + pagina prezzi | Fase 2 in costruzione |
| 22 | Stripe: prodotti, prezzi, checkout, portale clienti, webhook | Pagamenti pronti |
| 23 | Email di conversione per i beta tester (−40% a vita, scadenza 30 giorni) | Prima chiusura |
| 24 | 5 contatti partner via LinkedIn — proposta di contenuto congiunto | Moltiplicatore |
| 25 | **Pilastro 5** + derivati. Prepara l'annuncio del lancio | Contenuti + lancio |

### Settimana 6 — Apertura e consolidamento

| Giorno | Focus | Output |
|---|---|---|
| 26 | **Apri i pagamenti.** Annuncio: lista email prima, poi Instagram e LinkedIn | Fase 2 live |
| 27 | **Pilastro 6** → pagina evergreen "Excel vs piattaforma basket-first" | Inbound acceso |
| 28 | Query 5: chi si è bloccato. Email di recupero | Recupero |
| 29 | Review del mese: quale canale, quale **famiglia di hook**, quale attrito | Report mese 1 |
| 30 | Piano mese 2. Valuta l'apertura del terzo canale (gruppi Facebook, §6) | Prossimo ciclo |

### Il ritmo, dalla settimana 7

| | Lunedì | Martedì | Mercoledì | Giovedì | Venerdì |
|---|---|---|---|---|---|
| **Mattina** | pubblica reel | **blocco produzione** (2–3h) | pubblica carosello | post LinkedIn | **KPI + taglia un attrito** |
| **Pomeriggio** | prodotto | prodotto | prodotto | prodotto | prodotto |

---

## 11. Template

### 11.1 Reel — struttura tipo (pilastro 1)

**Coppia scelta il 23/09/2026, da usare come riferimento per tutti i reel successivi:**

> **[Frame 0, cartello pieno, testo già a schermo]**
> **It's not the analysis that takes up your time.**
>
> **[0,4–3s]** Three hours on the report. Forty seconds of reading.
> **[3–6s]** Two of those three hours are copy-paste between files.
> **[6–9s]** We're building the tool that puts it back together.
> **[9–11s]** **LAB21** — *Train more, decide better.*

Testo grande, leggibile senza audio, un'idea per schermata. Ultimo fotogramma visivamente uguale al primo, per il loop (§7.6).

**Perché questa coppia.** L'apertura non è una promessa risolta ma un anello aperto — *allora cos'è che mi porta via il tempo?* — e la risposta è il contenuto stesso del reel: lo spettatore resta per averla. La chiusura è invece un payoff, cioè un mestiere diverso: si giudica su quanto te lo ricordi dopo, non su quanti restano al terzo secondo. Problema all'inizio, promessa alla fine: sono le due estremità dello stesso pezzo e non vanno scambiate.

### 11.2 Post LinkedIn (pilastro 1)

> Quanto tempo porta via il report settimanale a un preparatore di basket?
>
> La parte interessante non è il numero: è **dove** se ne va quel tempo.
> Quasi mai nell'analisi. Se ne va nel copiare dati tra file, nel rimettere a posto la formattazione, nel rifare il grafico che si rompe quando aggiungi una riga.
>
> L'ora che conta davvero — quella in cui decidi chi carica e chi scarica — è sempre l'ultima, e sempre la più stanca.
>
> In LAB21 stiamo lavorando esattamente su questo.
> Chi di voi è riuscito a portarlo sotto l'ora, e come?

Link nel primo commento, mai nel corpo.

### 11.3 Le 7 email lifecycle — il venditore automatico

| # | Trigger | Oggetto | Contenuto in una riga |
|---|---|---|---|
| 1 | `iscrizione` | Ci sei. Ecco intanto una cosa utile | Conferma + **report PDF di esempio** subito |
| 2 | `registrazione` | Entra pure: c'è già una squadra dentro | Spiega la modalità demo. Un solo bottone: *Guarda il report* |
| 3 | `registrazione` +24h **se** nessun `primo_report` | Ti sei fermato al primo passo? | Video da 90 secondi + "rispondi a questa mail" |
| 4 | `primo_report` | Hai appena fatto in 10 minuti quello che ti prendeva 3 ore | Massimo entusiasmo: **qui chiedi l'import del roster vero** |
| 5 | `roster_caricato` +7g | La seconda settimana è quella che conta | Come si legge lo storico |
| 6 | trial giorno 18 | Cosa hai costruito in tre settimane | Riepilogo dei numeri reali + offerta + **PDF per il DS** |
| 7 | trial scaduto +3g | Chiudo qui, ma i tuoi dati restano | Ultima chiamata onesta. I dati restano 90 giorni |

**L'email 3 è quella che vale di più** — intercetta il punto in cui un venditore alzerebbe il telefono. **L'email 7 converte più della 6.** Non saltarla.

Regola per tutte: massimo 90 parole, un bottone solo, `reply-to` che arriva davvero a te.

### 11.4 Messaggio asincrono ai beta tester

> Ciao [Nome], intanto grazie — il fatto che lo stiate usando sul serio è la cosa più utile che potesse succedere.
>
> Tre cose veloci, tutte da fare col telefono in cinque minuti:
> 1. Uno screenshot di una schermata che usi davvero (oscura pure i nomi).
> 2. Una riga sola: cosa diresti a un collega?
> 3. Se hai voglia, 30 secondi di video in cui fai vedere cosa ci fai. Non deve essere fatto bene, deve essere vero.
>
> E se ti viene in mente un collega con lo stesso problema, girargli il link mi aiuta parecchio: per ognuno che parte, un mese te lo regalo io.

### 11.5 Contatto partner (LinkedIn)

> Ciao [Nome], seguo [clinic / contenuti / corso]. In LAB21 abbiamo raccolto come i preparatori di basket gestiscono oggi il reporting: quanto tempo ci mettono, dove lo perdono, cosa guarda davvero un capo allenatore.
>
> Ti interessa se ne facciamo un contenuto insieme per il tuo pubblico? Nessun taglio commerciale — l'analisi è tua da usare come vuoi.

---

## 12. Vincoli da rispettare

1. **Nessun claim sanitario.** Mai "previene gli infortuni", "riduce il rischio del X%", "diagnosi". Formula sicura: *"supporta lo staff nel leggere i segnali di carico"*.

2. **AI dichiarata come supporto decisionale.** La DPIA e il *Piano AI Literacy* in `legal/` presuppongono controllo umano sull'output. Deve emergere anche dal marketing: *"L'AI scrive la sintesi, la decisione è dello staff."*

3. **⚠️ Immagini di minori.** Gran parte del target lavora nel settore giovanile. **Mai foto o video in cui un minore sia riconoscibile**, nemmeno se li manda un beta tester, nemmeno se la società ha un consenso per i propri canali — quel consenso non copre te. Vale anche per gli screenshot: nomi e cognomi oscurati sempre. Il materiale già prodotto rispetta questa regola (nomi atleti rimossi dalla heatmap): mantenere lo standard.

4. **Marchi di terzi nelle riprese.** Nel reel sono stati mascherati quattro marchi su maglia, pantaloncini e scarpa. **È la procedura corretta e va ripetuta ogni volta**: loghi di sponsor, stemmi societari e numeri di maglia vanno sfocati prima della pubblicazione.

5. **Consenso e trasparenza sul modulo di iscrizione.** Il modulo che scrive in `marketing_lead` raccoglie dati personali: informativa collegata, base giuridica esplicita, doppio opt-in per i contenuti promozionali. L'informativa esiste già in `legal/` — va solo collegata.

---

## 13. Budget mese 1

| Voce | Costo |
|---|---|
| Infrastruttura attuale | *già sostenuta* |
| Instagram + LinkedIn | 0 € |
| Email (Resend già configurato) | 0 € |
| Strumento grafico per i template (opzionale) | 0–13 €/mese |
| Microfono USB per i reel | 40–80 € *(una tantum; l'audio conta più del video)* |
| Registrazione marchio TrainMind (UIBM) | 100–200 € *(una tantum, da fare comunque)* |
| **Advertising** | **0 € — deliberatamente** |
| **Totale mese 1** | **~150–300 €**, quasi tutto una tantum |

**Advertising: non prima di 3 clienti paganti.** Finché non sai quale hook genera iscritti qualificati, ogni euro in ads compra dati che l'organico ti dà gratis. La prima campagna, quando arriverà, sarà **retargeting su chi ha visitato la landing senza iscriversi** — non prospecting a freddo.

Il costo reale è **il tuo tempo**: circa 8 ore a settimana, di cui 3 nel blocco di produzione del martedì.

---

## 14. Rischi e contromisure

| Rischio | Prob. | Contromisura |
|---|---|---|
| **La porta è chiusa a valle della CTA** — le registrazioni sono gated dal token | **Certa, oggi** | Fissare la data di apertura. Finché resta chiusa, ogni visualizzazione che arriva a `/app` è persa |
| **Dare per pubblicato quello che è solo nel sorgente** — l'errore fatto in questa stessa analisi | Media | Verificare sempre su `dist/`, non su `src/sections/`. Le sezioni si includono a mano in `index.html` |
| **Si continua a produrre bello ma senza hook** | **Alta** | Il test a sei punti di §7.7 prima di ogni pubblicazione, senza eccezioni |
| **L'onboarding self-serve non attiva** — chi si blocca sparisce in silenzio | **Alta** | Modalità demo precaricata + email 3 + query 5 ogni venerdì |
| I social portano ampiezza ma non compratori | Alta | Ottimizza per **salvataggi e iscritti qualificati**, mai per follower |
| Il piano Club non converte senza interlocutore | Alta | PDF per il DS + risposta scritta entro 24h. Misuralo separatamente |
| Produrre in inglese per abitudine | Media | §2.5: tutto in italiano tranne il descrittore di marca |
| Due canali diventano due lavori e si spegne tutto | Media | Un pilastro a settimana. Se salti una settimana, salti il pilastro — **non** recuperi raddoppiando |
| Dipendenza dall'algoritmo | Media | La lista email è l'unico pubblico che possiedi davvero |
| Immagini di minori o marchi di terzi | Media | §12.3 e §12.4 — regola assoluta |
| Il tempo si disperde tra prodotto e marketing | Alta | Mattine al marketing, pomeriggi al codice |

---

## 15. I prossimi passi, in ordine

**Oggi, e prima di qualunque altra cosa:**

1. **Nessuna lista d'attesa — decisione del 23/09/2026.** La vendita aspetta partita IVA, consulenza legale, conto della società e verifica dei pagamenti. L'attesa si costruisce **solo con i contenuti**: sei settimane di *Lab notes*, pronte in `prelancio/CALENDARIO_PRELANCIO.md`, con il follow del profilo al posto del modulo di iscrizione. La sezione `contact.html` resta dormiente. Quando la data di apertura sarà certa si usa lo sticker conto alla rovescia delle storie, e la CTA del sito passa da «Scopri di più» a «Prova TrainMind».

**Questa settimana:**

2. **Crea le tabelle SQL** (§9.1) e collega il modulo con i parametri UTM e `hook_famiglia`.
3. **Produci il cartello hook** (§8.4): è il frame 0 di ogni reel futuro e risolve da solo i rilievi 1, 2 e 3 della brand review.
4. **Ri-monta il reel esistente** secondo §7.6. Tre interventi — traduci, riordina, aggiungi il cartello — su materiale già girato e già masterizzato.
5. **Manda il messaggio §11.4 ai beta tester.**

**Settimana prossima:**

6. **La modalità dimostrativa precaricata.** È il pezzo che sostituisce la call di setup, e da cui dipende se questo modello funziona.
7. Report PDF esempio, video demo, import CSV verificato.

---

*LAB21 — an innovation lab for science in sport*
*Documento interno · v3.0 · 23 settembre 2026*
