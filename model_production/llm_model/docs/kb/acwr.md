---
title: "ACWR — Acute:Chronic Workload Ratio"
source: "Gabbett 2016 — The training-injury prevention paradox"
domain: workload
level: intermediate
lang: it
version: 1
date: 2026-05-01
tags: [acwr, workload, monitoring, injury_prevention]
---

# ACWR — Acute:Chronic Workload Ratio

## Definizione

L'Acute:Chronic Workload Ratio (ACWR) è il rapporto tra il carico acuto (rolling 7 giorni) e il carico cronico (rolling 28 giorni). È uno degli indicatori più utilizzati nel monitoraggio del carico di lavoro per la prevenzione degli infortuni nello sport.

## Formula

```
ACWR = Carico Acuto (7 giorni) / Carico Cronico (28 giorni)
```

Dove:
- **Carico Acuto**: somma dei carichi giornalieri degli ultimi 7 giorni
- **Carico Cronico**: media settimanale dei carichi degli ultimi 28 giorni (o rolling 28 giorni)

## Metodo di calcolo

### Rolling Average (metodo classico)
```
ACWR = Σ(carico ultimi 7gg) / media_settimanale(carico ultimi 28gg)
```

### Exponentially Weighted Moving Average (EWMA)
```
EWMA_acuto = carico_oggi × λ_a + EWMA_ieri × (1 - λ_a)
EWMA_cronico = carico_oggi × λ_c + EWMA_ieri × (1 - λ_c)

λ_a = 2 / (7 + 1) = 0.25
λ_c = 2 / (28 + 1) = 0.069
```

Il metodo EWMA è considerato più accurato perché assegna maggior peso ai dati recenti.

## Zone di rischio

| ACWR | Zona | Interpretazione | Azione consigliata |
|------|------|-----------------|-------------------|
| < 0.8 | Undertraining | Carico troppo basso rispetto alla preparazione | Incremento graduale del carico |
| 0.8 – 1.3 | Sweet spot | Zona ottimale, rischio infortunio basso | Mantenere programmazione |
| 1.3 – 1.5 | Zona grigia | Attenzione, monitorare altri indicatori | Valutare riduzione se altri red flag |
| > 1.5 | Danger zone | Rischio infortunio significativamente elevato | Ridurre carico acuto, recupero attivo |
| > 2.0 | Zona critica | Rischio molto elevato | Stop o carico minimo, valutare staff medico |

## Applicazione nel basket

Nel basket, il carico può essere calcolato usando:
- **Carico interno**: sRPE (session-RPE × durata in minuti)
- **Carico esterno**: distanza totale, accelerazioni, decelerazioni, PlayerLoad (se disponibili dati GPS/accelerometro)

### Esempio pratico
Un giocatore con:
- Carico acuto (ultimi 7gg): 3.200 AU (arbitrary units via sRPE)
- Carico cronico (media 28gg): 2.400 AU

ACWR = 3.200 / 2.400 = **1.33** → Zona grigia, monitorare

## Limiti e considerazioni

1. **Non usare isolatamente**: l'ACWR va combinato con altri indicatori (monotonia, strain, dati soggettivi)
2. **Specificità sport**: le soglie possono variare tra sport; nel basket la variabilità intra-settimanale è alta
3. **Dati mancanti**: assenze non registrate possono alterare il calcolo del carico cronico
4. **Atleti infortunati**: al ritorno, il carico cronico sarà basso → ACWR artificialmente alto
5. **Stagionalità**: durante la pre-season i valori possono essere fisiologicamente elevati

## Riferimenti

- Gabbett TJ (2016). The training-injury prevention paradox. British Journal of Sports Medicine.
- Hulin BT et al. (2014). The acute:chronic workload ratio predicts injury. British Journal of Sports Medicine.
- Blanch P, Gabbett TJ (2016). Has the athlete trained enough to return to play safely?
