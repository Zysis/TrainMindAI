---
title: "Monitoraggio della Frequenza Cardiaca nel Basket"
domain: "heart_rate"
level: "base"
lang: "it"
version: 1
date: "2026-05-01"
tags: ["frequenza cardiaca", "HR", "zone", "TRIMP", "Edwards", "HRV"]
---

# Monitoraggio della Frequenza Cardiaca nel Basket

## Fondamenti

La frequenza cardiaca (HR) è uno degli indicatori di carico interno più accessibili e utilizzati. Riflette la risposta cardiovascolare allo sforzo e fornisce informazioni complementari alla RPE.

### FC Massima Individuale

La FC massima (HRmax) deve essere determinata individualmente. I metodi comuni:

- **Test massimale diretto**: protocollo incrementale su treadmill o Yo-Yo test (gold standard)
- **FC massima da partita**: prendere il valore più alto registrato in partita come riferimento
- **Formula predittiva**: 220 - età (poco precisa, errore ±10-12 bpm, sconsigliata per il monitoraggio)
- **Formula Tanaka**: 208 - 0.7 × età (leggermente più precisa)

**Raccomandazione**: usare sempre HRmax individuale misurata, non stimata.

### FC a Riposo

La FC a riposo (HRrest) è un indicatore semplice dello stato di recupero:

- **Baseline**: misurare per 5 giorni consecutivi al risveglio (posizione supina, 5 min)
- **Valore normale**: 45-65 bpm negli atleti di basket
- **Alert**: aumento di +5 bpm rispetto al baseline per 2+ giorni consecutivi → possibile fatica, malattia o stress

## Zone di Frequenza Cardiaca

Le zone HR sono definite come percentuale della HRmax individuale:

| Zona | % HRmax | Nome | Descrizione | Uso nel basket |
|------|---------|------|-------------|----------------|
| 1 | 50-60% | Recupero attivo | Intensità molto bassa, recupero | Post-partita, recovery |
| 2 | 60-70% | Aerobico base | Resistenza di base | Warm-up, off-season |
| 3 | 70-80% | Aerobico intenso | Soglia aerobica | Conditioning estensivo |
| 4 | 80-90% | Soglia anaerobica | Alta intensità sostenuta | Interval training, SSG |
| 5 | 90-100% | Massimale | Sforzo massimale | Sprint, azioni decisive |

### Profilo HR nel Basket

In una partita di basket tipica:
- Zona 1-2: 25-35% del tempo (pause, tiri liberi, time-out)
- Zona 3: 20-30% del tempo (gioco a ritmo moderato)
- Zona 4: 25-35% del tempo (fasi di gioco intense)
- Zona 5: 5-15% del tempo (sprint, azioni esplosive)

La HR media in partita è tipicamente 75-85% della HRmax, con picchi al 95-100%.

## Metriche Basate sulla Frequenza Cardiaca

### TRIMP (Training Impulse)

Il TRIMP quantifica il carico interno basandosi su durata e intensità della HR:

**TRIMP di Banister**:
```
TRIMP = durata (min) × ΔHR ratio × 0.64 × e^(1.92 × ΔHR ratio)
```
Dove: ΔHR ratio = (HR esercizio - HRrest) / (HRmax - HRrest)

**TRIMP di Edwards** (più semplice):
| Zona | Durata (min) | Fattore | Contributo |
|------|-------------|---------|------------|
| Zona 1 (50-60%) | × 1 | × 1 | = punteggio |
| Zona 2 (60-70%) | × 1 | × 2 | = punteggio |
| Zona 3 (70-80%) | × 1 | × 3 | = punteggio |
| Zona 4 (80-90%) | × 1 | × 4 | = punteggio |
| Zona 5 (90-100%) | × 1 | × 5 | = punteggio |

TRIMP Edwards = somma dei contributi di tutte le zone.

### Confronto HR vs sRPE

| Metrica | Vantaggi | Limiti |
|---------|----------|-------|
| **sRPE** | Semplice, integra anche lo sforzo neuromuscolare | Soggettiva, bias individuale |
| **HR/TRIMP** | Oggettiva, continua, automatica | Non cattura il carico neuromuscolare (es. forza) |
| **Combinata** | Quadro più completo | Richiede più strumentazione |

La **dissociazione HR-RPE** è un indicatore importante:
- **HR bassa + RPE alta**: possibile sforzo neuromuscolare elevato (es. lavoro di forza) o fatica mentale
- **HR alta + RPE bassa**: buona efficienza cardiovascolare
- **Trend di dissociazione crescente**: possibile indicatore precoce di overreaching

## Applicazione Pratica

### Quando Usare la HR

- **Conditioning aerobico**: per garantire che l'atleta lavori nella zona corretta
- **Small-sided games**: per monitorare l'intensità in tempo reale e adattare le regole
- **Recovery**: per verificare che le sessioni di recupero siano effettivamente a bassa intensità
- **Return to play**: per monitorare la risposta cardiovascolare durante la progressione

### Quando NON Affidarsi Solo alla HR

- **Allenamento di forza**: la HR non riflette adeguatamente il carico neuromuscolare
- **Azioni esplosive brevi**: la HR risponde con ritardo rispetto allo sforzo anaerobico
- **Atleti in terapia farmacologica**: beta-bloccanti e altri farmaci alterano la risposta HR
- **Condizioni ambientali estreme**: caldo, umidità, altitudine influenzano la HR indipendentemente dal carico

### Integrazione nel Sistema TrainMindAI

La HR viene integrata nel sistema come:
1. **TRIMP Edwards** calcolato automaticamente dai dati del cardiofrequenzimetro
2. **Rapporto TRIMP/sRPE**: per identificare dissociazioni
3. **Trend FC a riposo**: alert se aumento >5 bpm per 2+ giorni
4. **Zone HR in partita**: profilo individuale per confronto longitudinale
