---
title: "RPE e sRPE — Rating of Perceived Exertion"
source: "Foster et al. 2001 — A new approach to monitoring exercise training"
domain: workload
level: base
lang: it
version: 1
date: 2026-05-01
tags: [rpe, srpe, workload, monitoring, internal_load]
---

# RPE e sRPE — Rating of Perceived Exertion

## Definizione

La **RPE** (Rating of Perceived Exertion) è una scala soggettiva che misura l'intensità percepita dell'esercizio da parte dell'atleta. La **sRPE** (session-RPE) è il prodotto tra la RPE e la durata della sessione, e rappresenta il carico interno della sessione.

## Scala RPE CR-10 (Foster modificata)

| Valore | Descrizione | Intensità |
|--------|-------------|-----------|
| 0 | Riposo | Nessuno sforzo |
| 1 | Molto leggero | Attività minima |
| 2 | Leggero | Facile, conversazione normale |
| 3 | Moderato | Conversazione possibile |
| 4 | Piuttosto duro | Conversazione difficile |
| 5 | Duro | Impegnativo |
| 6 | – | Tra duro e molto duro |
| 7 | Molto duro | Molto impegnativo |
| 8 | – | Tra molto duro e quasi massimale |
| 9 | Quasi massimale | Appena sostenibile |
| 10 | Massimale | Sforzo massimo assoluto |

## Formula sRPE

```
sRPE (AU) = RPE × durata sessione (minuti)
```

### Esempio
- RPE dichiarata dall'atleta: 7
- Durata sessione: 90 minuti
- sRPE = 7 × 90 = **630 AU** (arbitrary units)

## Timing della rilevazione

La RPE va raccolta **30 minuti dopo** la fine della sessione di allenamento.
- Prima di 30 min: la percezione è influenzata dall'ultimo esercizio svolto
- Dopo 30 min: la percezione riflette l'intera sessione

## Applicazione nel basket

### Tipi di sessione e RPE attesi

| Tipo sessione | RPE tipica | Durata tipica | sRPE attesa |
|---------------|-----------|---------------|-------------|
| Tecnica leggera | 2-3 | 60-75 min | 120-225 |
| Tattica | 4-5 | 75-90 min | 300-450 |
| Allenamento completo | 5-7 | 90-120 min | 450-840 |
| Partita amichevole | 6-8 | 40-48 min (effettivi) | 240-384 |
| Partita ufficiale | 7-9 | 40-48 min (effettivi) | 280-432 |
| Preparazione fisica intensa | 7-9 | 45-60 min | 315-540 |
| Recupero attivo | 1-3 | 30-45 min | 30-135 |

### Note importanti per il basket
1. La durata nel basket va calcolata come **tempo effettivo di gioco/allenamento** (escluse pause lunghe)
2. La RPE va chiesta individualmente, non è unica per tutta la squadra
3. Giocatori con minutaggio diverso in partita avranno RPE diverse
4. La RPE della preparazione fisica va registrata separatamente dalla componente tecnico-tattica

## Calcoli derivati dalla sRPE

### Carico settimanale
```
Carico settimanale = Σ sRPE (7 giorni)
```

### Monotonia
```
Monotonia = media_giornaliera(sRPE) / deviazione_standard(sRPE)
```
- Monotonia > 2.0 → rischio elevato (carico troppo uniforme)

### Strain
```
Strain = Carico settimanale × Monotonia
```
- Strain elevato → combinazione di carico alto e monotonia alta → rischio massimo

## Affidabilità e limiti

### Punti di forza
- Semplice da raccogliere (1 numero per sessione)
- Non richiede tecnologia
- Validata scientificamente da decenni
- Correlazione buona con FC media e lattato

### Limiti
- Soggettiva: può essere influenzata da umore, motivazione, contesto
- Dipende dall'onestà dell'atleta
- Non distingue tra tipi di stress (muscolare vs cardiovascolare vs cognitivo)
- Va educato l'atleta all'uso corretto della scala

## Riferimenti

- Foster C et al. (2001). A new approach to monitoring exercise training. Journal of Strength and Conditioning Research.
- Impellizzeri FM et al. (2004). Use of RPE-based training load in soccer. Medicine & Science in Sports & Exercise.
- Manzi V et al. (2010). Dose-response relationship of RPE and heart rate in basketball.
