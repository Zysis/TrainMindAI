## Prima di pubblicare: tre cose da sistemare

1. **Settimana 4, scala del wellness.** Il carosello e il post LinkedIn dicono che in TrainMind *5 è sempre la condizione migliore, su tutte le voci*. Così è scritto nella guida utente di settembre. Negli appunti di agosto, però, fatica 5 era «Estrema» e appariva in verde. Controlla nell'app qual è il comportamento attuale **prima** di pubblicare: se non torna, quella slide e quel post vanno riscritti.
2. **Settimana 5, risultati del sondaggio.** La didascalia del reel e il post LinkedIn partono dal risultato vero del sondaggio della settimana 1. Il segnaposto tra quadre va sostituito con i numeri reali, oppure tolto. Non va mai pubblicato con un numero stimato.
3. **Beta tester.** Se nel frattempo arrivano screenshot, frasi o video brevi dai preparatori che usano il prodotto, il posto giusto è una storia in più il venerdì delle settimane 3–5. Un professionista che dice «lo uso» vale più di qualunque grafica.

---

## Come si registrano le schermate per i reel (settimane 2–6)

- **Dati demo, sempre.** Per esempio l'organizzazione preparata per la guida utente (`seed-guida.ts`). Mai i dati di una squadra vera.
- **Nomi.** Prima di registrare, sostituisci quelli degli atleti con nomi di fantasia. Se non è possibile, taglia la colonna dei nomi in montaggio. Sfocarli non basta: un'esportazione con meno sfocatura li rende di nuovo leggibili.
- **Formato.** Verticale 1080×1920. Puoi registrare dal telefono, oppure dal browser con la finestra stretta, e poi ritagliare. Per scena bastano 2–3 secondi di movimento vero: un clic, un cronometro che parte, un grafico che si disegna.
- **Montaggio.** Frame 0 → per ogni scena la registrazione con sopra la sua `reel-scena-K.png` (è trasparente, con il testo già dentro) → chiusura `reel-end.png`. Durata totale 10–13 secondi. Nessun testo aggiunto a mano: la tipografia è già quella del marchio.
- **Audio.** Il letto musicale del reel già pubblicato (`public/audio/bed-lab21.mp3` nel progetto video) va bene per tutti: la continuità sonora fa parte del marchio.
- **Il test dei sei punti** (§7.7 di `SISTEMA_MARKETING`) prima di ogni pubblicazione.

---

## Cosa guardare ogni venerdì

| Metrica | Dove | Cosa ti dice |
|---|---|---|
| Retention a 3 secondi dei reel | Insights del reel | Se l'hook funziona. Sotto il 35% per due settimane: cambia tipo di apertura |
| Salvataggi dei caroselli | Insights del post | Se le Lab notes sono utili. È la metrica che conta di più nel pre-lancio |
| Nuovi follower da non follower | Insights del profilo | Se l'attesa sta crescendo. È la tua lista d'attesa, senza modulo |
| Risposte ai sondaggi | Storie | Quante persone sono abbastanza coinvolte da rispondere, e i dati veri per i contenuti |
| Commenti di gente del settore | LinkedIn | Se stai arrivando alle società e ai responsabili performance |

---

## Dopo la settimana 6

Le Lab notes finiscono il 6 novembre. Da lì le strade sono due, e dipendono solo dai pagamenti:

- **Se la data di apertura è certa:** una settimana di annuncio. Sticker conto alla rovescia nelle storie, un reel *TrainMind is open*, il post LinkedIn di apertura, e la CTA del sito che diventa «Prova TrainMind».
- **Se non lo è ancora:** si prosegue con il ritmo settimanale e i pilastri 4–6 del sistema (§8.2), che non dipendono dall'apertura. Non si annuncia niente finché non è vero.

---

## Come rigenerare le grafiche

Tutti i testi stanno in `_sorgenti/content.py`: se cambi una frase lì e rilanci lo script, grafiche e calendario restano allineati.

```bash
cd marketing/prelancio/_sorgenti
pip install pillow numpy
python build_kit.py
```

I font del marchio (Space Grotesk, Inter, JetBrains Mono, licenza OFL) sono in `_sorgenti/fonts`.
