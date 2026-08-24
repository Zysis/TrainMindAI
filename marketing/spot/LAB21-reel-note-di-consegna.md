# Reel istituzionale LAB21 — note di consegna

17 agosto 2026. Tre file, una sola timeline.

| file | formato | durata | picco audio |
|---|---|---|---|
| `LAB21-reel-24s-9x16.mp4` | 1080×1920 — **master** | 720f @30fps | −2.04 dBFS |
| `LAB21-reel-24s-16x9.mp4` | 1920×1080 | 720f @30fps | −2.11 dBFS |
| `LAB21-reel-10s-9x16.mp4` | 1080×1920 | 300f @30fps | −1.99 dBFS |

Il 16:9 **non è un ritaglio**: ha i suoi a-capo, la sua scala, i suoi bersagli di
annotazione e la sua geometria della cornice. Il 10s **non è una troncatura**: è un
montaggio di tre scene.

Tutti e tre taggati BT.709 / bt709 / bt709 / range TV. Zero campioni oltre 0.99, verificato
in stereo. Il teal del marchio nel montato misura (6,164,137) contro il token (0,164,137):
il +6 sul rosso è il passaggio in yuv420p.

## Le cinque scene

| | tempo | tecnica (card video-shotcraft) | frase |
|---|---|---|---|
| S1 | 0–3s | `typography/type-assembly-moves` · split-text-stagger | Your innovation lab / for science in sport. |
| S2 | 3–9s | `effects/scanline-annotate-focus` | Look at how coaches work. |
| S3 | 9–15s | `typography/marker-underline-title` | Separate places where the data lives / Your reports, every Sunday night |
| S4 | 15–20s | fondo strumento fuori fuoco in deriva | We build tools that support your daily work. |
| S5 | 20–24s | `ui-entrance/draw-svg-trace` | We turn data into real performance. → link in bio |

Regola sovrana rispettata: ogni scena ha una frase a schermo per tutta la sua durata, con
altezza maiuscola **104–105px** su 1080 di larghezza (misurata sui file consegnati, non
stimata), tutta dentro la fascia 380–1540. Test del telefono superato: a 480px di larghezza
ogni frase resta leggibile, comprese le etichette mono e la call-to-action.

Il taglio da 10s è **dichiarazione → beneficio → firma** (S1 → S4 → S5). Non usa la riga
«Your reports, every Sunday night»: nel master è il problema che il pezzo introduce, ma
isolata e con "Sunday" sottolineata a pennarello si leggerebbe come una promessa di
prodotto, che un istituzionale di Fase 1 non fa.

## Cinque scostamenti dal brief, tutti deliberati

1. **S2 dice LOAD / CUE / ATHLETE, non TABLET / PRACTICE / ATHLETE.** Lo storyboard
   chiedeva una foto generata di "coach dubbioso"; in questa sessione non è disponibile
   nessuna generazione di immagini, quindi la scena gira su `video1.jpg`, dove un tablet non
   c'è. La card vieta di etichettare un oggetto assente. I due sostituti sono bersagli veri
   in quadro: i dischi e la mano che corregge.
2. **S5 usa `draw-svg-trace` e non `letterspace-materialize`.** Quella card pretende
   scheletri monolineari disegnati a mano e una spaziatura di ~0.6em che dichiara essere la
   propria identità, con la regola esplicita che sotto 0.3em si usa la card di descrizione
   normale. Il lockup LAB21 è un geometrico pesante a spaziatura quasi nulla. Con
   `draw-svg-trace` una penna corre sul contorno **vero** del marchio e poi passa il
   testimone al pieno: la forma è quella giusta dal primo frame all'ultimo, senza il salto
   che qualsiasi scheletro fatto a mano avrebbe imposto.
3. **Lo sfalsamento del testo è per riga (4 frame), non per carattere (2).** Con frasi da
   19–36 caratteri l'ultima lettera partirebbe 70 frame dopo la prima. Restano la scatola di
   ritaglio, l'oltrepasso del 10% e il rientro, cioè la grammatica della card.
4. **Il payoff finale è in display a 146px, non in corpo minore.** In Inter 300 a 61px
   l'altezza maiuscola sarebbe 44px: la regola sovrana non fa eccezioni per l'ultima scena,
   ed è quello il frame che la gente fotografa.
5. **Su `video1.jpg` sono stati mascherati quattro marchi di terzi** (scritta sulla maglia,
   numero di maglia con stemma, logo sui pantaloncini, logo sulla scarpa) con una sfocatura
   locale a bordo sfumato applicata alla fonte. Erano leggibili anche nel test del telefono,
   e il numero di maglia era anche una cifra a schermo, vietata dal brief. Dallo screenshot
   della heatmap di S4 è stata ritagliata la colonna con i nomi degli atleti.

## Due punti che tornano a te

**Il teal del wordmark.** Il brief dice «accDark #00A489 (SOLO per il logo: è il teal del
marchio)» e così è stato fatto, per coerenza anche con i due pezzi già consegnati. Ma
campionando `LAB21/logo/lab21-wordmark-light.png` **compresi i pixel semitrasparenti**, i
41.992 pixel colorati del "21" e della coda della B hanno mediana esatta **(0, 201, 173)**,
cioè `--acc #00C9A7`. Stesso valore su `lab21-wordmark.png` e sull'icona 512. Nel mockup
`--acc-d` compare unicamente su fondo chiaro: è il teal leggibile sul bianco, non quello del
segno. Sul fondo ink il "21" resta quindi più spento del teal che il brand usa davvero, e
nella scena finale convivono due verdi (il "21" a #00A489 e "link in bio" a #00C9A7).
È una riga di codice: dimmi e riesporto i tre file — e volendo anche il logo sting.

**L'altezza maiuscola in 16:9.** La regola dice «≥100px su 1080 di larghezza». Nel 16:9 il
testo misura 105px reali su un quadro di 1920, cioè 59px se si normalizza a 1080. Ho tenuto
la lettura assoluta (105px veri, e sul 9.7% dell'altezza del quadro il testo è già molto
grande). Se intendevi la lettura normalizzata servirebbero ~185px, che in 16:9 vuol dire
quattro righe per frase: è una scelta di composizione, non un dettaglio tecnico.

## Un limite noto

Il file audio comincia con ~38 ms di silenzio. È la latenza dell'encoder AAC in MP4, la
stessa che ha ogni file consegnato a qualunque piattaforma; non è un buco nel montaggio. La
sincronia è verificata: il picco assoluto del pezzo cade al frame 641.8 contro il frame 642
in cui si chiude il contorno del marchio.
