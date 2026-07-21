---
title: "Metriche GPS e Tracking nel Basket"
domain: "gps_tracking"
level: "intermediate"
lang: "it"
version: 1
date: "2026-05-01"
tags: ["gps", "tracking", "metriche esterne", "carico esterno", "LPS"]
---

# Metriche GPS e Tracking nel Basket

## Sistemi di Tracking Indoor

Nel basket, i sistemi GPS classici non funzionano al chiuso. Si utilizzano:

- **Local Positioning System (LPS)**: sistemi a ultra-wideband (UWB) come Catapult ClearSky, Kinexon, Wimu. Frequenza campionamento: 10-20 Hz. Precisione: ±10-30 cm.
- **Video-based tracking**: sistemi a telecamere multiple (Second Spectrum, Hawk-Eye). Non richiedono sensori indossabili.
- **Accelerometri inerziali (IMU)**: integrati nei dispositivi indossabili. Misurano accelerazioni triassiali, giroscopi, magnetometri.

Per il basket outdoor (allenamenti all'aperto), si possono usare anche sistemi GNSS tradizionali.

## Metriche di Carico Esterno

### Metriche di Volume

| Metrica | Unità | Descrizione | Range tipico basket |
|---------|-------|-------------|---------------------|
| Distanza totale | m | Distanza percorsa nella sessione | 3000-6000 m/partita |
| Distanza ad alta intensità | m | Distanza >14.4 km/h (4 m/s) | 400-1200 m/partita |
| Distanza sprint | m | Distanza >20 km/h (5.5 m/s) | 100-400 m/partita |
| Player Load | AU | Accelerazione triassiale cumulativa | 300-600 AU/partita |
| Numero accelerazioni | count | Acc >2 m/s² | 40-100/partita |
| Numero decelerazioni | count | Dec < -2 m/s² | 40-100/partita |
| Numero cambi di direzione | count | Rotazioni >45° ad alta velocità | 50-150/partita |

### Metriche di Intensità

| Metrica | Unità | Descrizione | Soglia alert |
|---------|-------|-------------|--------------|
| Velocità massima | km/h | Picco di velocità nella sessione | N/A |
| Player Load/min | AU/min | Intensità media della sessione | >8 AU/min = alta |
| Acc/min | count/min | Frequenza azioni esplosive | Variabile per ruolo |
| Distance/min | m/min | Intensità locomotoria | >80 m/min = alta |
| High-intensity events/min | count/min | Azioni >4 m/s per minuto | >3/min = alta |

### Metriche Specifiche per il Basket

- **Salti**: conteggio e altezza media dei salti. Particolarmente importante per tendinopatia rotulea. Soglia settimanale consigliata: 200-400 salti (ruolo-dipendente).
- **Impatti**: accelerazioni verticali al contatto con il suolo. Correlano con stress articolare.
- **Live time**: tempo effettivo di gioco (escluse pause, time-out, tiri liberi). In NBA circa 48 min, in FIBA circa 40 min, ma il live time è circa il 50-60%.
- **Work-to-rest ratio**: rapporto tra fasi di alta intensità e recupero. Nel basket tipicamente 1:4 a 1:6.

## Interpretazione dei Dati

### Carico Esterno vs Carico Interno

Il carico esterno (GPS/LPS) e il carico interno (RPE, HR) devono essere valutati insieme:

- **Carico esterno alto + carico interno basso**: buona condizione fisica, efficienza cardiovascolare
- **Carico esterno basso + carico interno alto**: possibile affaticamento, detraining, o malessere
- **Entrambi alti**: sessione molto impegnativa, monitorare recupero
- **Entrambi bassi**: sessione leggera (tapering, recupero attivo)

La **dissociazione** tra carico esterno e interno è un segnale importante:
- Se lo stesso carico esterno produce un RPE crescente nel tempo → possibile accumulo di fatica
- Se lo stesso RPE corrisponde a carico esterno decrescente → possibile overreaching

### Profili per Ruolo

I giocatori di basket hanno profili di carico diversi per ruolo:

| Ruolo | Distanza tipica | Player Load | Salti/partita | Caratteristiche |
|-------|----------------|-------------|---------------|-----------------|
| PG (Point Guard) | 5500-6200 m | 450-550 AU | 15-25 | Più distanza totale, meno salti |
| SG (Shooting Guard) | 5200-5800 m | 420-520 AU | 20-30 | Molti cambi di direzione |
| SF (Small Forward) | 5000-5600 m | 430-530 AU | 25-35 | Profilo intermedio |
| PF (Power Forward) | 4500-5200 m | 400-500 AU | 30-45 | Più salti e contatti |
| C (Center) | 3800-4500 m | 380-480 AU | 35-50 | Meno distanza, più impatti verticali |

### Soglie Individualizzate

Le soglie per il monitoraggio del carico esterno devono essere individualizzate:

1. **Rolling average**: calcolare la media mobile a 4 settimane per ogni atleta
2. **Deviazione standard**: variazioni >1.5 SD dalla media personale sono segnali di allarme
3. **Rapporto acuto:cronico (EWMA)**: applicabile anche a metriche GPS (Player Load A:C ratio)
4. **Day-to-day variability**: variazioni >30% tra giorni consecutivi meritano attenzione

## Limiti e Considerazioni

- I dati GPS/LPS sono uno strumento, non una risposta. Devono sempre essere integrati con il feedback soggettivo dell'atleta e il giudizio del preparatore.
- La qualità dei dati dipende dalla calibrazione del sistema e dalla corretta identificazione dei giocatori.
- Il confronto tra sistemi diversi (es. Catapult vs Kinexon) non è diretto: le metriche calcolate possono differire.
- Il Player Load non è una metrica standardizzata: ogni produttore ha il suo algoritmo.
- Per decisioni critiche (return to play, carico post-infortunio), non affidarsi solo ai dati GPS.
