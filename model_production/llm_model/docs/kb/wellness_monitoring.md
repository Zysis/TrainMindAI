---
title: "Wellness Monitoring e Questionari Soggettivi"
domain: "wellness"
level: "base"
lang: "it"
version: 1
date: "2026-05-01"
tags: ["wellness", "questionari", "soggettivo", "sleep", "readiness", "HRV"]
---

# Wellness Monitoring e Questionari Soggettivi

## Importanza del Monitoraggio Soggettivo

Il monitoraggio del benessere soggettivo (wellness) è complementare ai dati oggettivi di carico. La ricerca ha dimostrato che:

- I questionari di wellness sono **più sensibili** dei marcatori biochimici nel rilevare variazioni di readiness.
- La combinazione di dati oggettivi (sRPE, GPS) e soggettivi (wellness) migliora la capacità predittiva per infortuni e malattie.
- Il **trend** è più importante del valore assoluto: un calo progressivo su 3+ giorni è più significativo di un singolo valore basso.

## Questionario Wellness Giornaliero

### Scala di Hooper (adattata)

Compilazione: ogni mattina, entro 30 minuti dal risveglio. Scala 1-10 per ogni item.

| Item | 1-3 (Basso) | 4-6 (Medio) | 7-10 (Alto) |
|------|-------------|-------------|-------------|
| **Qualità del sonno** | Sonno molto disturbato, risvegli multipli | Sonno discreto | Sonno ristoratore, senza interruzioni |
| **Livello di fatica** | Spossatezza, difficoltà nei movimenti quotidiani | Fatica moderata | Fresco, energico |
| **Dolore muscolare (DOMS)** | Dolore intenso, limitante | Indolenzimento moderato | Assenza di dolore |
| **Stress percepito** | Stress elevato (sport, studio, vita personale) | Stress gestibile | Rilassato, nessun stress |
| **Motivazione** | Nessuna voglia di allenarsi | Motivazione sufficiente | Molto motivato, pronto |
| **Readiness** | Non pronto | Parzialmente pronto | Completamente pronto ad allenarsi |

### Wellness Index

Il Wellness Index è calcolato come media dei 6 item (range 1-10):

- **≥ 7.0**: condizione ottimale, allenamento secondo programma
- **5.0 - 6.9**: monitorare, possibile adattamento del carico
- **< 5.0**: attenzione, ridurre carico o inserire giornata di recupero

### Soglie di Alert

| Condizione | Trigger | Azione |
|------------|---------|--------|
| Wellness Index < 5.0 per 1 giorno | ⚠️ Warning | Comunicare allo staff, valutare riduzione |
| Wellness Index < 5.0 per 3+ giorni | 🔴 Critical | Riduzione carico obbligatoria, colloquio con atleta |
| Sleep quality < 4 per 2+ notti | ⚠️ Warning | Investigare cause, igiene del sonno |
| DOMS ≥ 8 | ⚠️ Warning | No allenamento ad alta intensità |
| Stress ≥ 8 + fatica ≥ 8 | 🔴 Critical | Sessione leggera o riposo |
| Calo readiness ≥ 3 punti vs media | ⚠️ Warning | Valutazione individuale |

## Monitoraggio del Sonno

Il sonno è il fattore di recupero più importante. Parametri da monitorare:

### Metriche Chiave

- **Durata totale**: target 7-9 ore per atleti adulti, 8-10 per under 18
- **Efficienza del sonno**: % del tempo a letto effettivamente dormito. Target ≥85%
- **Latenza**: tempo per addormentarsi. Alert se >30 minuti
- **Risvegli notturni**: alert se >2 per notte in modo ricorrente
- **Regolarità**: variazione dell'orario di coricarsi/svegliarsi. Target: ≤30 min di variazione

### Impatto sulle Performance

- **<6h di sonno**: riduzione del 10-30% nella performance di sprint e reazione
- **<7h croniche**: aumento del rischio infortunio del 60-70%
- **Debito di sonno accumulato**: dopo 3 notti con <6h, la performance cognitiva decade significativamente
- **Jet lag / trasferte**: prevedere 1 giorno di adattamento per ogni fuso orario attraversato

### Raccomandazioni Pratiche

1. **Sleep hygiene**: no schermi 1h prima di dormire, camera fresca (18-20°C), buio completo
2. **Post-partita serale**: il cortisolo e l'adrenalina elevati dopo partita serale disturbano il sonno. Prevedere protocollo di cool-down esteso.
3. **Napping**: siesta di 20-30 min nel primo pomeriggio può compensare parzialmente il debito
4. **Trasferte**: pianificare arrivo almeno 24h prima della partita

## Heart Rate Variability (HRV)

L'HRV misura la variabilità degli intervalli tra battiti cardiaci e riflette il tono del sistema nervoso autonomo.

### Interpretazione

- **HRV alta (rispetto al baseline personale)**: buon recupero, predominanza parasimpatica
- **HRV bassa**: possibile affaticamento, stress, recupero insufficiente
- **Trend in calo su 3-5 giorni**: segnale di overreaching funzionale
- **Calo acuto >20% rispetto alla media 7gg**: alert immediato

### Limiti

- L'HRV è altamente individuale: i valori assoluti non sono comparabili tra atleti
- Deve essere misurata in condizioni standardizzate (mattina, supino, 5 min)
- Alcol, caffeina, malattia influenzano significativamente l'HRV
- Non è un indicatore di fitness ma di readiness al carico

## Integrazione nel Sistema TrainMindAI

Il wellness monitoring si integra nel sistema tramite:

1. **Input giornaliero**: l'atleta compila il questionario via app
2. **Calcolo automatico**: Wellness Index + trend rispetto alla settimana precedente
3. **Alert automatici**: se soglie superate, viene generato un alert di tipo `READINESS_LOW` o `SLEEP_LOW`
4. **Contestualizzazione RAG**: il LLM consulta la KB per fornire suggerimenti evidence-based
5. **Report staff**: il sistema genera note operative per il preparatore con raccomandazioni specifiche
