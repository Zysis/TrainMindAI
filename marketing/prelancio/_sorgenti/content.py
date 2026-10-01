# -*- coding: utf-8 -*-
"""
Contenuti del pre-lancio LAB21 -> TrainMind, sei settimane.

UNICA FONTE di tutti i testi: da qui build_kit.py genera le grafiche (PNG),
i PDF per LinkedIn e il calendario in markdown. Per cambiare una frase si
cambia qui e si rilancia lo script: grafiche e calendario restano allineati.

Regole applicate (vedi SISTEMA_MARKETING_LAB21_TRAINMIND.md):
- testo a schermo in inglese, didascalie e post LinkedIn in italiano;
- nessun numero inventato: solo formule e fatti del prodotto, o risultati
  veri dei sondaggi (segnaposto tra [QUADRE] finché non ci sono);
- nessun claim sanitario, nessuna data di apertura, nessun prezzo;
- l'AI è sempre un supporto, la decisione resta allo staff;
- *parole tra asterischi* = evidenziate in verde marchio.
"""

HANDLE_IG = "@lab21_sport"
TAGS = "#preparazionefisica #basket #pallacanestro #sportscience #strengthandconditioning"

WEEKS = [
# ────────────────────────────────────────────────────────────── SETTIMANA 1
dict(
  n=1, start="28/09", theme="Dove va il tempo",
  why=("Si apre dal problema, non dal prodotto. È la settimana che dà il nome alla serie "
       "e fissa l'appuntamento: una Lab note ogni mercoledì."),
  reel=dict(
    frame0="It's not the analysis that *takes up your time.*",
    source="recut",   # si rimonta il reel già girato: nessuna registrazione nuova
    ready="settimana-1/reel-settimana-1.mp4",
    recut=[
      ("0 – 2,0 s", "Cartello `reel-frame0.png`, con una leggera spinta in avanti", "It's not the analysis that takes up your time."),
      ("2,0 – 3,8 s", "Master 24s, da 9,9 a 11,7 s (scena S3)", "Separate places where the data lives  (già nel girato)"),
      ("3,8 – 7,9 s", "Master 24s, da 15,8 a 19,9 s (scena S4)", "We build tools that support your daily work.  (già nel girato)"),
      ("7,9 – 9,5 s", "Cartello con il solo logo, mentre sale l'audio", "—"),
      ("9,5 – 12,1 s", "Cartello `reel-end.png`, che entra sul colpo audio", "Train more, decide better."),
    ],
    end_mono="LAB NOTES 01 · WEDNESDAY",
    caption=(
      "Non è l'analisi che ti porta via il tempo.\n"
      "È tutto quello che viene prima.\n\n"
      "Aprire il file della programmazione, recuperare le presenze, ritrovare il wellness "
      "nella chat, rifare il grafico che si è rotto. Quando finalmente puoi ragionare, "
      "sei già stanco.\n\n"
      "In LAB21 stiamo costruendo lo strumento che rimette questi dati in un posto solo. "
      "Da mercoledì lo raccontiamo qui, un pezzo alla volta: seguici per non perdere le Lab notes."),
  ),
  carousel=dict(
    title="One place",
    slides=[
      dict(kind="cover", title="Your data lives in *four places.*", body="That's where your week goes."),
      dict(kicker="PLANNING", title="Periodization, mesocycles, sessions.", body="Usually: a spreadsheet."),
      dict(kicker="ON COURT", title="Attendance, drill timers, RPE.", body="Usually: a notebook, or the stopwatch on your phone."),
      dict(kicker="MONITORING", title="Daily wellness, load, ACWR.", body="Usually: a group chat."),
      dict(kicker="RETURN TO PLAY", title="Phases and clearance criteria.", body="Usually: in someone's head."),
      dict(title="Four places. *Four versions* of the same athlete.",
           body="And before you can decide anything, you put them back together by hand."),
      dict(title="TrainMind keeps them in *one.*",
           body="Plan, court, monitoring, return to play. Straight from the lab, one piece at a time."),
      dict(kind="end", title="Follow *the lab.*", mono="LAB NOTES 02 · NEXT WEEK"),
    ],
    caption=(
      "Programmazione, campo, monitoraggio, rientro dagli infortuni.\n"
      "In molti staff sono quattro posti diversi: un foglio, un quaderno, una chat, la memoria di qualcuno.\n\n"
      "Quattro posti vogliono dire quattro versioni dello stesso atleta — e prima di decidere "
      "qualcosa bisogna rimetterle insieme a mano.\n\n"
      "Questa è la prima delle Lab notes: sei puntate, una a settimana, in cui mostriamo come "
      "stiamo costruendo TrainMind.\n\n"
      "Tu dove tieni i dati oggi? Scrivilo nei commenti."),
  ),
  linkedin=(
    "Non è l'analisi che porta via il tempo a un preparatore fisico.\n"
    "È tutto quello che viene prima.\n\n"
    "Il carico sta nel foglio della programmazione. Le presenze e i tempi degli esercizi su un "
    "quaderno o sul cronometro del telefono. Il wellness in una chat di gruppo. Lo stato di un "
    "rientro da infortunio nella testa di chi lo segue.\n\n"
    "Quattro posti, quattro versioni dello stesso atleta. E prima di poter decidere qualcosa, "
    "bisogna rimetterle insieme a mano.\n\n"
    "In LAB21 stiamo costruendo TrainMind per fare quel lavoro al posto tuo: un posto solo, "
    "dal piano al campo al rientro.\n\n"
    "Nelle prossime sei settimane racconterò qui come lo stiamo costruendo, un pezzo alla volta. "
    "In allegato la prima delle Lab notes.\n\n"
    "Una domanda per chi fa questo lavoro: quanti file apri per sapere come sta la squadra oggi?"),
  stories=[
    dict(title="Quick question *for coaches.*", body="Takes two seconds."),
    dict(title="How long does your *weekly report* take?", poll=["Under 1h", "1–2h", "2–3h", "Over 3h"]),
    dict(title="Results *next Friday.*", body="Lab notes 01 is on the grid."),
  ],
),
# ────────────────────────────────────────────────────────────── SETTIMANA 2
dict(
  n=2, start="05/10", theme="Il campo",
  why=("La prova che TrainMind nasce per il basket: rapporto giocatori impiegati / disponibili, "
       "campi in uso, presenze a semaforo. È il pezzo che un software generico non ha."),
  reel=dict(
    frame0="A 12-minute drill is *not 12 minutes* of work.",
    source="record",
    record_what=("Pagina Allenamento in campo di una seduta demo: la tabella esercizi con un "
                 "cronometro che gira, poi la colonna del tempo effettivo, poi Completa Sessione."),
    overlays=[
      ("Two timers *per drill.*", "ACTIVITY · PAUSES"),
      ("*Effective* time.", "NET × PLAYERS USED ÷ AVAILABLE"),
      ("What each player *really* trained.", "COMPLETE SESSION"),
    ],
    end_mono="LAB NOTES 02 · WEDNESDAY",
    caption=(
      "Un esercizio da 12 minuti non è 12 minuti di lavoro.\n"
      "Togli le pause, poi guarda quanti giocatori erano davvero in campo.\n\n"
      "Netto per giocatori impiegati, diviso gli atleti disponibili: quello è il tempo effettivo "
      "di ciascuno. È il calcolo che si fa su un foglio a bordo campo. Noi lo abbiamo messo dentro "
      "TrainMind, cronometro compreso.\n\n"
      "Mercoledì la Lab note completa."),
  ),
  carousel=dict(
    title="The court sheet",
    slides=[
      dict(kind="cover", title="This page started as a *courtside spreadsheet.*", body="So we rebuilt it, line by line."),
      dict(kicker="ATTENDANCE", title="Three colors.", body="Green: present. Yellow: unavailable. Red: absent. Yellow and red take a note with the reason."),
      dict(kicker="AVAILABLE PLAYERS", title="Counted, *not typed.*", body="It's the number of green lights. Guests included."),
      dict(kicker="TWO TIMERS", title="Activity and pauses, *separately.*", body="Net time = activity − pauses."),
      dict(kicker="EFFECTIVE TIME", title="Net × players used ÷ players available.",
           body="Ten players in a drill with twelve available isn't the same drill for everyone."),
      dict(kicker="INTENSITY", title="Effective time × *courts in use.*",
           body="Warm-up is one checkbox, and it stays out of the total. Breaks between drills don't count either."),
      dict(kicker="COMPLETE SESSION", title="Every present player *gets their session.*",
           body="With their effective duration already calculated."),
      dict(kind="end", title="Built for basketball, *not adapted to it.*", mono="LAB NOTES 03 · NEXT WEEK"),
    ],
    caption=(
      "Questa pagina di TrainMind è nata da un foglio Excel usato a bordo campo.\n"
      "E l'abbiamo ricostruita riga per riga.\n\n"
      "Presenze a semaforo, due cronometri per esercizio, il tempo effettivo calcolato sul "
      "rapporto fra giocatori impiegati e disponibili, l'intensità moltiplicata per i campi in uso. "
      "A fine seduta ogni atleta presente ha la sua sessione, con la durata effettiva già calcolata.\n\n"
      "Tu il tempo effettivo per giocatore lo calcoli, o ti basta la durata dell'esercizio?"),
  ),
  linkedin=(
    "Una pagina di TrainMind è nata da un foglio Excel usato a bordo campo.\n\n"
    "Presenze a semaforo, due cronometri per ogni esercizio — attività e pause — e poche formule: "
    "il netto, il tempo effettivo per giocatore (netto × giocatori impiegati ÷ atleti disponibili), "
    "l'intensità moltiplicata per i campi in uso.\n\n"
    "All'inizio avevamo costruito un cronometro per ogni atleta. Lo abbiamo tolto: il foglio a "
    "bordo campo funzionava meglio, e il software doveva adattarsi a quello, non il contrario.\n\n"
    "La regola che ci siamo dati per chiudere il lavoro: i numeri dell'app devono combaciare al "
    "secondo con quelli del foglio di riferimento. Se non combaciano, ha torto l'app.\n\n"
    "È un dettaglio, ma dice come lavoriamo: prima guardiamo come si allena davvero una squadra, "
    "poi scriviamo il codice.\n\n"
    "Tu il tempo effettivo per giocatore lo calcoli, o ti basta la durata dell'esercizio?"),
  stories=[
    dict(title="Last week's *answers are in.*", body="Results on the next screen."),
    dict(title="Do you track *effective time* per player?", poll=["Yes", "No", "What's that?"]),
    dict(title="Lab notes 02 *is on the grid.*", body="The court sheet, line by line."),
  ],
),
# ────────────────────────────────────────────────────────────── SETTIMANA 3
dict(
  n=3, start="12/10", theme="Il dato che manca",
  why=("La settimana del rigore: come TrainMind legge il carico e perché non inventa i numeri "
       "che non ha. È il contenuto che dà credibilità scientifica al laboratorio."),
  reel=dict(
    frame0="A missing number *is not a zero.*",
    source="record",
    record_what=("Analisi → ACWR con dati demo: il grafico con le fasce colorate, poi la tabella "
                 "per atleta con un atleta \"non valutabile\"."),
    overlays=[
      ("Draw a gap *as zero…*", "ACWR · LOAD RATIO"),
      ("…and it reads *'under-trained'.*", "BELOW 0.8"),
      ("Under 14 days: *not assessable.*", "NOT ZERO · NOT DRAWN"),
    ],
    end_mono="LAB NOTES 03 · WEDNESDAY",
    caption=(
      "Un dato che manca non è uno zero.\n"
      "Sembra ovvio, ma su un grafico del carico cambia tutto.\n\n"
      "Se un giorno senza dati viene disegnato come zero, il grafico dell'ACWR dice "
      "\"sotto-allenamento\": un buco nella raccolta diventa un'informazione, e falsa.\n\n"
      "In TrainMind, sotto i 14 giorni di storico l'atleta risulta non valutabile e il punto "
      "semplicemente non c'è. Meglio un vuoto onesto di un numero sbagliato."),
  ),
  carousel=dict(
    title="How we read load",
    slides=[
      dict(kind="cover", title="How TrainMind *reads load.*", body="Six rules we built in."),
      dict(kicker="1 · ONE NUMBER", title="sRPE.", body="Session RPE × effective duration. Everything else starts here."),
      dict(kicker="2 · ACUTE", title="The last *7 days.*", body="Acute load."),
      dict(kicker="3 · CHRONIC", title="The last *3 weeks.*", body="Chronic load, averaged."),
      dict(kicker="4 · RATIO", title="Acute ÷ chronic.",
           body="Bands: below 0.8 · 0.8–1.3 · 1.3–1.5 · above 1.5. A reading aid, not a diagnosis."),
      dict(kicker="5 · TEAM SESSIONS", title="Group work counts *for the whole roster.*",
           body="Most athletes train with the team. If group sessions aren't attributed, most of the roster looks like it has no load."),
      dict(kicker="6 · MISSING DATA", title="Under 14 days of history: *not assessable.*",
           body="Not zero. A gap drawn as zero turns into a false signal."),
      dict(title="Wellness doesn't decide.", body="It confirms or contradicts what the load is saying."),
      dict(kind="end", title="Follow *the lab.*", mono="LAB NOTES 04 · NEXT WEEK"),
    ],
    caption=(
      "Come TrainMind legge il carico, in sei regole.\n"
      "Nessuna è nuova. Il punto è applicarle tutte, sempre, nello stesso modo.\n\n"
      "sRPE come unità di partenza, acuto a 7 giorni, cronico a 3 settimane, il loro rapporto. "
      "Le sedute di squadra attribuite a tutta la rosa. E un atleta con meno di 14 giorni di "
      "storico non viene valutato: non gli si assegna uno zero.\n\n"
      "Le fasce dell'ACWR sono un aiuto alla lettura, non una diagnosi. La decisione resta allo staff.\n\n"
      "Tu con quale finestra lavori sul cronico?"),
  ),
  linkedin=(
    "Un dato che manca non è uno zero.\n\n"
    "È una delle regole che ci siamo dati costruendo i grafici del carico in TrainMind, ed è meno "
    "ovvia di quanto sembri. Se un giorno senza dati entra nel grafico dell'ACWR come zero, il "
    "grafico dice \"sotto-allenamento\". Un buco nella raccolta diventa un'informazione — sbagliata.\n\n"
    "Per questo, sotto i 14 giorni di storico, un atleta in TrainMind risulta non valutabile e il "
    "punto non viene disegnato.\n\n"
    "La seconda regola riguarda chi si allena in gruppo, cioè quasi tutti. Una seduta di squadra "
    "vale per tutta la rosa. Se non la si attribuisce a ciascun atleta, metà della squadra sembra "
    "non avere carico e finisce tra i non valutabili per il motivo sbagliato.\n\n"
    "Sono dettagli di calcolo, ma decidono se un preparatore può fidarsi del numero che ha davanti. "
    "E un numero di cui non ti fidi è peggio di nessun numero.\n\n"
    "In allegato le sei regole della Lab note di questa settimana."),
  stories=[
    dict(title="Last week's *answers are in.*", body="Results on the next screen."),
    dict(title="Do you use *ACWR* with your team?", poll=["Every week", "Sometimes", "No"]),
    dict(title="Lab notes 03 *is on the grid.*", body="Six rules for reading load."),
  ],
),
# ────────────────────────────────────────────────────────────── SETTIMANA 4
dict(
  n=4, start="19/10", theme="Il wellness",
  why=("Il contenuto più utile anche per chi non comprerà mai: come far compilare il wellness "
       "alla squadra. È quello che la gente salva, e il salvataggio è la metrica che conta."),
  reel=dict(
    frame0="Wellness on WhatsApp *isn't data.* It's a chat.",
    source="record",
    record_what=("Sul telefono, l'app atleta di un atleta demo: la compilazione del wellness. "
                 "Poi, dal lato staff, la heatmap del wellness in Analisi. I nomi vanno "
                 "sostituiti o tagliati (vedi le regole di ripresa)."),
    overlays=[
      ("Five items. *One minute.*", "SLEEP · FATIGUE · PAIN · STRESS · MOOD"),
      ("From the *athlete's phone.*", "ATHLETE APP"),
      ("The red row *stands out.*", "STAFF VIEW · HEATMAP"),
    ],
    end_mono="LAB NOTES 04 · WEDNESDAY",
    caption=(
      "Il wellness su WhatsApp non è un dato. È una chat.\n"
      "Messaggi sparsi, orari diversi, qualcuno che risponde e qualcuno no.\n\n"
      "In TrainMind l'atleta compila cinque voci dal suo telefono in un minuto: sonno, fatica, "
      "dolore, stress, umore. Dal lato staff diventano una heatmap, e la riga che vira al rosso per "
      "più giorni di fila si vede da sola.\n\n"
      "Tu come raccogli il wellness oggi?"),
  ),
  carousel=dict(
    title="Getting athletes to fill in wellness",
    slides=[
      dict(kind="cover", title="Getting athletes to fill in wellness. *Every day.*", body="Three things. None of them is technical."),
      dict(title="The problem *isn't the app.*", body="It's whether the athlete knows what it's for."),
      dict(kicker="1 · EXPLAIN IT", title="Say what it's for.",
           body="An athlete who sees wellness as control won't fill it in. One who sees it shaping his week will."),
      dict(kicker="2 · FIX THE MOMENT", title="Same time, *every day.*",
           body="Before breakfast, or when arriving at the gym. A fixed moment beats any reminder."),
      dict(kicker="3 · SHOW IT", title="Close the loop.",
           body="When an athlete sees his numbers changed Thursday's session, filling it in stops being a chore."),
      dict(title="And make the scale *impossible to misread.*",
           body="In TrainMind, 5 is always the best condition. On every item."),
      dict(title="Five items. *One minute.*", body="Sleep · fatigue · pain · stress · mood. Plus hours of sleep."),
      dict(kind="end", title="Follow *the lab.*", mono="LAB NOTES 05 · NEXT WEEK"),
    ],
    caption=(
      "Far compilare il wellness alla squadra, tutti i giorni.\n"
      "Tre cose fanno la differenza, e nessuna è tecnica.\n\n"
      "Spiegare a cosa serve. Fissare il momento. Far vedere all'atleta che i suoi numeri hanno "
      "cambiato la seduta del giovedì: da lì la compilazione smette di essere un compito.\n\n"
      "Salvalo per la prossima riunione con la squadra, e dicci nei commenti qual è il trucco che funziona "
      "con la tua squadra."),
  ),
  linkedin=(
    "Una decisione piccola su cui abbiamo discusso parecchio: in che verso va la scala del wellness?\n\n"
    "Sonno, fatica, dolore, stress, umore, da 1 a 5. Il problema è che su alcune voci verrebbe "
    "naturale che 5 sia \"molto\" — molta fatica, molto dolore — e su altre che 5 sia \"bene\". "
    "Chi legge una tabella di trenta righe deve ricordarsi, colonna per colonna, se alto è buono "
    "o cattivo.\n\n"
    "Abbiamo scelto una scala uniforme: in TrainMind, su tutte le voci, 5 è la condizione migliore. "
    "Un solo verso, un solo colore per lo stesso significato.\n\n"
    "Costa qualcosa all'atleta la prima volta che compila. Fa risparmiare un errore di lettura a "
    "chi guarda i dati ogni mattina. Ci è sembrato lo scambio giusto.\n\n"
    "In allegato la Lab note di questa settimana: i tre accorgimenti che fanno compilare il "
    "wellness a una squadra, e nessuno è tecnico."),
  stories=[
    dict(title="Last week's *answers are in.*", body="Results on the next screen."),
    dict(title="How do you collect *wellness* today?", poll=["Group chat", "Paper", "An app", "We don't"]),
    dict(title="Lab notes 04 *is on the grid.*", body="Save it for your next team talk."),
  ],
),
# ────────────────────────────────────────────────────────────── SETTIMANA 5
dict(
  n=5, start="26/10", theme="Il report",
  why=("Si torna al problema della settimana 1 — il report — con la risposta. È anche la "
       "settimana in cui si usano i risultati veri del primo sondaggio."),
  reel=dict(
    frame0="Your coach and your doctor *don't read the same report.*",
    source="record",
    record_what=("Analisi & Report → Report: la configurazione con la scelta del destinatario, "
                 "l'opzione della sintesi AI, poi l'anteprima."),
    overlays=[
      ("Pick *who it's for.*", "STAFF · MEDICAL · MANAGEMENT"),
      ("The language *changes with the reader.*", "SAME DATA · DIFFERENT REPORT"),
      ("AI drafts. *You check.*", "PREVIEW · PDF · WORD"),
    ],
    end_mono="LAB NOTES 05 · WEDNESDAY",
    caption=(
      "Il capo allenatore e il medico non leggono lo stesso report.\n"
      "E il presidente ne legge un terzo, se lo legge.\n\n"
      "In TrainMind scegli prima per chi è: staff tecnico, medico, dirigenza. Stessi dati, "
      "linguaggio e contenuti diversi. La sintesi la può scrivere l'assistente AI; la controlli "
      "in anteprima prima che parta.\n\n"
      "[RISULTATO VERO DEL SONDAGGIO DELLA SETTIMANA 1 — es. \"Tre settimane fa vi abbiamo chiesto "
      "quanto ci mettete a fare il report settimanale: il __% ha risposto più di due ore.\"]"),
  ),
  carousel=dict(
    title="The end-of-day sheet",
    slides=[
      dict(kind="cover", title="The *end-of-day* sheet.", body="What the daily report holds, and why."),
      dict(kicker="TODAY", title="What was done.", body="Activities of the day, in one place."),
      dict(kicker="AVAILABILITY", title="Every player, *0 to 5.*",
           body="Out · rehab · no contact · reduced load · with substitutions · full training."),
      dict(kicker="NOTES", title="One line *per player.*", body="The detail the numbers don't carry."),
      dict(kicker="TOMORROW", title="The plan for the next day.", body="So the morning starts from a decision, not a search."),
      dict(kicker="CHECK FIRST", title="Suggested statuses *on top.*",
           body="If an injury or a return-to-play protocol suggests a status, it shows up first — to review before saving."),
      dict(kicker="OUT", title="PDF, Word, *or on its own.*", body="Schedule it, and it goes out by email with the cadence you choose."),
      dict(kind="end", title="Follow *the lab.*", mono="LAB NOTES 06 · NEXT WEEK"),
    ],
    caption=(
      "Il report di fine giornata, voce per voce.\n"
      "Cosa è stato fatto, chi è disponibile domani, e con quali limiti.\n\n"
      "Disponibilità da 0 a 5 per ogni giocatore, una nota a testa, le linee per il giorno dopo. "
      "Se un infortunio o un protocollo di rientro propone uno stato, compare in cima: si "
      "controlla prima di salvare. Poi PDF, Word, o invio automatico per email.\n\n"
      "Chi legge davvero i tuoi report? Rispondi nelle storie di venerdì."),
  ),
  linkedin=(
    "[APERTURA CON IL RISULTATO VERO DEL SONDAGGIO DELLA SETTIMANA 1 — es. \"Un mese fa ho chiesto "
    "quanto tempo porta via il report settimanale. Su __ risposte, il __% ha detto più di due ore.\"]\n\n"
    "Il punto però non è solo il tempo. È che lo stesso report finisce davanti a persone che "
    "cercano cose diverse. Il capo allenatore vuole sapere chi può allenarsi domani. Il medico "
    "vuole il dettaglio di un rientro. La dirigenza vuole capire se la squadra è a posto, in due "
    "righe.\n\n"
    "In TrainMind il report si configura partendo da chi lo legge — staff tecnico, medico, "
    "dirigenza — e cambia linguaggio e contenuti di conseguenza. La sintesi può scriverla "
    "l'assistente AI; il preparatore la controlla in anteprima prima che parta.\n\n"
    "L'AI scrive. La firma resta tua.\n\n"
    "In allegato la Lab note della settimana: il report di fine giornata, voce per voce."),
  stories=[
    dict(title="Last week's *answers are in.*", body="Results on the next screen."),
    dict(title="Who actually reads *your reports?*", poll=["Head coach", "Medical staff", "Management", "Honestly, nobody"]),
    dict(title="Lab notes 05 *is on the grid.*", body="The end-of-day sheet."),
  ],
),
# ────────────────────────────────────────────────────────────── SETTIMANA 6
dict(
  n=6, start="02/11", theme="Il rientro, e cosa esce dal laboratorio",
  why=("L'ultima Lab note e il riepilogo delle sei. Chiude la serie e sposta l'attenzione da "
       "LAB21 a TrainMind senza dare una data: chi segue il profilo sarà il primo a saperlo."),
  reel=dict(
    frame0="Return to play has criteria. *You can't skip one.*",
    source="record",
    record_what=("Infortuni & RTP con un protocollo demo: le fasi, i criteri di una fase, il "
                 "tentativo di avanzare con un criterio non soddisfatto e il messaggio che lo "
                 "impedisce. Nessun nome, nessuna sede di infortunio leggibile di un atleta vero."),
    overlays=[
      ("Every protocol *has phases.*", "RETURN TO PLAY"),
      ("Every phase *has criteria.*", "CLEARANCE"),
      ("No criteria, *no next phase.*", "NO OVERRIDE BUTTON"),
      ("The call stays with *the medical staff.*", "ROLE · MEDICAL"),
    ],
    end_mono="OPENING SOON",
    caption=(
      "Il rientro da un infortunio ha dei criteri. Non se ne salta nessuno.\n"
      "Nemmeno quando la partita è domenica.\n\n"
      "In TrainMind ogni protocollo di rientro ha le sue fasi, e ogni fase i suoi criteri. La fase "
      "avanza solo quando sono soddisfatti: non esiste un pulsante per forzarla. E la decisione "
      "resta allo staff medico.\n\n"
      "Mercoledì l'ultima Lab note. Poi, TrainMind."),
  ),
  carousel=dict(
    title="Six weeks in the lab",
    slides=[
      dict(kind="cover", title="Six weeks *in the lab.*", body="What's coming out of it."),
      dict(kicker="01", title="One place.", body="Plan, court, monitoring and return to play."),
      dict(kicker="02", title="The court sheet.", body="Effective time, per player."),
      dict(kicker="03", title="Load, *read honestly.*", body="A missing number is not a zero."),
      dict(kicker="04", title="Wellness in a minute.", body="From the athlete's phone."),
      dict(kicker="05", title="A report *for whoever reads it.*", body="AI drafts, you check."),
      dict(kicker="06", title="Return to play.", body="One criterion at a time."),
      dict(title="This is *TrainMind.*", body="Built in the lab, for basketball. Opening soon."),
      dict(kind="end", title="Be the *first to know.*", mono="FOLLOW " + HANDLE_IG.upper()),
    ],
    caption=(
      "Sei settimane di Lab notes, in una pagina.\n"
      "Un posto solo, il foglio di campo, il carico letto con onestà, il wellness in un minuto, "
      "il report per chi lo legge, il rientro un criterio alla volta.\n\n"
      "Tutto questo è TrainMind, ed esce dal laboratorio a breve.\n\n"
      "Segui il profilo: chi è qui lo saprà per primo."),
  ),
  linkedin=(
    "Sei settimane fa ho iniziato a raccontare qui come stiamo costruendo TrainMind.\n\n"
    "Un posto solo per programmazione, campo, monitoraggio e rientro. Una pagina nata da un "
    "foglio Excel di bordo campo. Un carico letto senza inventare i numeri che mancano. Un "
    "wellness che l'atleta compila in un minuto. Un report che cambia a seconda di chi lo legge. "
    "Un rientro da infortunio che avanza solo quando i criteri sono soddisfatti.\n\n"
    "Il filo che li tiene insieme è uno: prima guardare come lavora davvero chi allena, poi "
    "scrivere il software. E lasciare sempre la decisione allo staff.\n\n"
    "TrainMind esce dal laboratorio a breve. Chi segue LAB21 lo saprà per primo.\n\n"
    "Grazie a chi in queste settimane ha commentato, risposto ai sondaggi e fatto domande."),
  stories=[
    dict(title="Last week's *answers are in.*", body="Results on the next screen."),
    dict(title="Which one do you *need most?*", poll=["Court sheet", "Load & ACWR", "Wellness app", "Reports"]),
    dict(title="Something is *leaving the lab.*", body="Soon."),
  ],
),
]
