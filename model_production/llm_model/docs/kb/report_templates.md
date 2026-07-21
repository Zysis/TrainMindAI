---
title: "Template Report — Esempi gold-standard"
source: "Template interni TrainMindAI"
domain: report_template
level: base
lang: it
version: 1
date: 2026-05-01
tags: [report, template, output, daily, weekly, athlete_summary]
---

# Template Report — Esempi Gold-Standard

Questi template definiscono lo stile e la struttura degli output generati dal sistema.
Vengono usati sia nel RAG (come few-shot) sia nel dataset SFT per insegnare lo stile al modello.

---

## Template 1: Report Giornaliero

### Struttura obbligatoria
```
REPORT GIORNALIERO — [Data]
Sessione: [Tipo sessione] | Durata: [minuti] min | Fase: [fase stagione]

RIEPILOGO CARICO
- RPE media squadra: [valore]
- sRPE media: [valore] AU
- Atleti presenti: [n]/[totale]
- Atleti con carico elevato (RPE ≥ 7): [lista]

SEGNALAZIONI
- [Alert se presenti, altrimenti "Nessuna segnalazione critica"]

NOTE OPERATIVE
- [Osservazioni brevi del preparatore, max 3 punti]

---
Disclaimer: Questo output è uno strumento di supporto. Non sostituisce il giudizio
professionale dello staff tecnico-sanitario.
```

### Esempio compilato
```
REPORT GIORNALIERO — 15 Marzo 2026
Sessione: Allenamento completo (tecnica + tattica) | Durata: 105 min | Fase: In-season

RIEPILOGO CARICO
- RPE media squadra: 6.2
- sRPE media: 651 AU
- Atleti presenti: 11/13
- Atleti con carico elevato (RPE ≥ 7): A03 (RPE 8), A07 (RPE 7), A11 (RPE 8)

SEGNALAZIONI
- ⚠️ A03: ACWR 1.48, in zona grigia. Monitorare domani.
- ⚠️ A11: terzo giorno consecutivo con RPE ≥ 7. Valutare scarico giovedì.

NOTE OPERATIVE
- Contenuto tattico ad alta intensità in preparazione partita sabato
- A05 e A09 assenti per motivi personali, da recuperare domani
- Nessun segnale di dolore muscolare riportato

---
Disclaimer: Questo output è uno strumento di supporto. Non sostituisce il giudizio
professionale dello staff tecnico-sanitario.
```

---

## Template 2: Sintesi Atleta

### Struttura obbligatoria
```
SINTESI ATLETA — [ID Atleta]
Periodo: [data inizio] → [data fine]
Ruolo: [ruolo] | Categoria: [categoria]

STATO ATTUALE
- Disponibilità: [piena / parziale / non disponibile]
- ACWR: [valore] ([zona])
- Monotonia settimanale: [valore]
- Carico settimanale: [valore] AU
- Trend carico: [↑ in aumento / → stabile / ↓ in calo]

INDICATORI SOGGETTIVI (ultima rilevazione)
- Sonno: [1-10]
- Fatica: [1-10]
- Dolore muscolare: [1-10]
- Readiness: [1-10]

OSSERVAZIONI
- [Max 3 punti sintetici sullo stato dell'atleta]

SUGGERIMENTO OPERATIVO
- [1 suggerimento concreto per il preparatore fisico]
```

### Esempio compilato
```
SINTESI ATLETA — A07
Periodo: 11 Marzo → 17 Marzo 2026
Ruolo: PF (ala grande) | Categoria: Serie A2

STATO ATTUALE
- Disponibilità: piena
- ACWR: 1.22 (sweet spot ✅)
- Monotonia settimanale: 1.4
- Carico settimanale: 2.850 AU
- Trend carico: → stabile

INDICATORI SOGGETTIVI (ultima rilevazione: 17/03)
- Sonno: 7/10
- Fatica: 5/10
- Dolore muscolare: 3/10
- Readiness: 7/10

OSSERVAZIONI
- Carico ben distribuito nella settimana, buona alternanza alto/basso
- Nessun segnale di rischio. Atleta in condizione ottimale.
- Ha giocato 28 minuti nella partita di sabato senza problemi.

SUGGERIMENTO OPERATIVO
- Mantenere la programmazione attuale. Può sostenere allenamento ad alta intensità martedì.
```

---

## Template 3: Alert Workload

### Struttura obbligatoria (JSON)
```json
{
  "type": "alert_workload",
  "level": "warning|critical|info",
  "athlete_id": "A##",
  "code": "ACWR_HIGH|MONOTONIA_HIGH|STRAIN_HIGH|RPE_SPIKE|CONSECUTIVE_HIGH",
  "value": 1.52,
  "threshold": 1.5,
  "message": "[Descrizione breve dell'alert]",
  "suggestion": "[Suggerimento operativo concreto]",
  "timestamp": "2026-03-15T18:30:00Z"
}
```

### Esempio compilato
```json
{
  "type": "alert_workload",
  "level": "warning",
  "athlete_id": "A03",
  "code": "ACWR_HIGH",
  "value": 1.52,
  "threshold": 1.5,
  "message": "ACWR sopra soglia 1.5. L'atleta ha accumulato un carico acuto significativamente superiore al carico cronico.",
  "suggestion": "Valutare riduzione del carico nella prossima sessione. Verificare indicatori soggettivi (dolore, fatica, sonno). Se ACWR resta >1.5 per ulteriori 48h, inserire giorno di scarico.",
  "timestamp": "2026-03-15T18:30:00Z"
}
```

---

## Template 4: Sintesi Squadra

### Struttura obbligatoria
```
SINTESI SQUADRA — Settimana [n]
Periodo: [data inizio] → [data fine]
Sessioni svolte: [n] | Partite: [n]

CARICO COLLETTIVO
- sRPE media settimanale squadra: [valore] AU
- Trend vs settimana precedente: [↑ +X% / → / ↓ -X%]
- Giocatori con ACWR > 1.3: [lista o "nessuno"]
- Giocatori con monotonia > 2.0: [lista o "nessuno"]

DISPONIBILITÀ
- Pienamente disponibili: [n]/[totale]
- Disponibilità parziale: [lista con motivo]
- Non disponibili: [lista con motivo]

SEGNALAZIONI PRIORITARIE
- [Max 3 segnalazioni ordinate per urgenza]

NOTA PER LO STAFF
- [1-2 indicazioni operative per la settimana entrante]
```

---

## Template 5: Report Settimanale

### Struttura obbligatoria
```
REPORT SETTIMANALE — Settimana [n]
Periodo: [data inizio] → [data fine]
Fase stagione: [fase] | Microciclo: [tipo]

PANORAMICA CARICO
- Carico totale squadra: [valore] AU (media per atleta)
- Sessioni completate: [n]/[n programmate]
- Distribuzione carico: [grafico testuale o percentuali per giorno]
- Confronto vs settimana precedente: [+X% / -X%]

INDICI COLLETTIVI
- ACWR medio squadra: [valore]
- Monotonia media: [valore]
- Atleti in sweet spot (ACWR 0.8-1.3): [n]/[totale]

CLASSIFICAZIONE ATLETI
🟢 Condizione ottimale: [lista]
🟡 Monitoraggio: [lista con motivo breve]
🔴 Attenzione: [lista con motivo breve]

PARTITE DISPUTATE
- [Data]: vs [avversario] — Risultato [punteggio]
  Minutaggio top: [atleta (min)], ...

PROGRAMMAZIONE SETTIMANA ENTRANTE
- Obiettivo: [obiettivo microciclo]
- Note: [indicazioni specifiche]

---
Disclaimer: Questo output è uno strumento di supporto. Non sostituisce il giudizio
professionale dello staff tecnico-sanitario.
```

---

## Regole di stile per tutti i report

1. **Tono**: tecnico-operativo, asciutto, mai motivazionale
2. **Lunghezza**: conciso ma completo. No frasi inutili.
3. **Numeri**: sempre con unità di misura (AU, min, %, /10)
4. **Soglie**: citate esplicitamente quando si segnala un alert
5. **Incertezza**: se un dato manca, dichiararlo ("dato non disponibile")
6. **Suggerimenti**: sempre concreti e azionabili, mai generici
7. **Disclaimer**: sempre presente in fondo ai report testuali
