---
title: "Monotonia e Strain — Indicatori di rischio"
source: "Foster 1998 — Monitoring training in athletes"
domain: workload
level: intermediate
lang: it
version: 1
date: 2026-05-01
tags: [monotonia, strain, overtraining, risk, workload]
---

# Monotonia e Strain

## Definizione

**Monotonia** e **Strain** sono due indici complementari proposti da Foster (1998) per identificare atleti a rischio di sovrallenamento, malattia o infortunio.

- **Monotonia**: misura quanto il carico è uniforme durante la settimana. Un carico troppo costante (senza variazione) non permette un recupero adeguato.
- **Strain**: combina il volume totale del carico con la sua uniformità. Un alto strain indica un atleta sottoposto sia a carico elevato sia a poca variazione.

## Formule

### Monotonia
```
Monotonia = Media giornaliera sRPE (7 giorni) / Deviazione Standard sRPE (7 giorni)
```

### Strain
```
Strain = Carico settimanale totale × Monotonia
```

Dove:
- Carico settimanale totale = Σ sRPE di tutti i giorni della settimana (inclusi i giorni di riposo con sRPE = 0)

## Interpretazione

### Monotonia

| Valore | Interpretazione | Azione |
|--------|-----------------|--------|
| < 1.0 | Buona variazione del carico | Proseguire, variazione adeguata |
| 1.0 – 1.5 | Variazione accettabile | Monitorare |
| 1.5 – 2.0 | Attenzione: carico troppo uniforme | Inserire maggiore variazione |
| > 2.0 | Rischio elevato: carico monotono | Modificare la programmazione immediatamente |

### Strain

Il valore assoluto di strain dipende dal livello dell'atleta e dallo sport. Non esistono soglie universali. Si lavora con:
- **Media individuale**: calcolare la media di strain dell'atleta nelle ultime 4-6 settimane
- **Deviazione**: uno strain > media + 1.5 SD è un red flag
- **Confronto con periodo salutare**: confrontare con periodi in cui l'atleta era sano e performante

## Esempio pratico

### Settimana ad alta variazione (BUONA)
| Giorno | sRPE |
|--------|------|
| Lun | 0 (riposo) |
| Mar | 630 |
| Mer | 480 |
| Gio | 300 |
| Ven | 150 |
| Sab | 720 (partita) |
| Dom | 0 (riposo) |

- Media = 326 AU
- DS = 286 AU
- **Monotonia = 326 / 286 = 1.14** ✅ (buona variazione)
- Carico settimanale = 2.280 AU
- **Strain = 2.280 × 1.14 = 2.599** (nella norma)

### Settimana monotona (RISCHIO)
| Giorno | sRPE |
|--------|------|
| Lun | 400 |
| Mar | 450 |
| Mer | 420 |
| Gio | 430 |
| Ven | 410 |
| Sab | 440 |
| Dom | 400 |

- Media = 421 AU
- DS = 18.7 AU
- **Monotonia = 421 / 18.7 = 22.5** ⚠️ (estremamente monotono!)
- Carico settimanale = 2.950 AU
- **Strain = 2.950 × 22.5 = 66.375** (molto elevato!)

Anche se il carico totale è simile (2.280 vs 2.950), la monotonia rende il secondo scenario molto più rischioso.

## Perché la monotonia è pericolosa

1. **Mancanza di recupero**: senza giorni leggeri, i tessuti non si rigenerano
2. **Adattamento ridotto**: il corpo ha bisogno di stimoli variabili per adattarsi
3. **Fatica cumulativa**: il carico costante accumula fatica senza supercompensazione
4. **Rischio immunodepressione**: Foster ha dimostrato correlazione tra alta monotonia e infezioni delle vie aeree superiori

## Applicazione nel basket

### Fonti di monotonia nel basket
- Pre-season con doppie sedute giornaliere tutte ad alta intensità
- Sequenze di partite ravvicinate (3 partite in 7 giorni) senza gestione minutaggio
- Programmazione che non differenzia tra giorni pesanti e leggeri
- Atleti che non riposano nei giorni off (allenamento extra non registrato)

### Come ridurre la monotonia
- Alternare giorni ad alto e basso carico
- Inserire almeno 1-2 giorni a carico molto basso o nullo per settimana
- Variare il tipo di sessione (tecnica leggera vs preparazione fisica intensa)
- Gestire il minutaggio in partita per i giocatori più utilizzati
- Registrare anche i giorni di riposo (sRPE = 0) nel calcolo

## Alert automatici suggeriti

```python
# Soglie per alert automatici
if monotonia > 2.0:
    alert("WARNING", "Monotonia elevata", "Inserire variazione nel carico settimanale")
    
if monotonia > 2.0 and carico_settimanale > media_4_settimane * 1.2:
    alert("CRITICAL", "Strain critico", "Ridurre carico e inserire recupero")
```

## Riferimenti

- Foster C (1998). Monitoring training in athletes with reference to overtraining syndrome. Medicine & Science in Sports & Exercise.
- Foster C et al. (2001). A new approach to monitoring exercise training. JSCR.
- Brink MS et al. (2010). Monitoring stress and recovery: new insights for the prevention of injuries and illnesses in elite youth soccer players.
