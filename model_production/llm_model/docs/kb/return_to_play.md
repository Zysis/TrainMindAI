---
title: "Return to Play (RTP) — Protocollo ritorno da infortunio"
source: "Consensus statement on return to sport - IOC 2016"
domain: rtp
level: advanced
lang: it
version: 1
date: 2026-05-01
tags: [rtp, return_to_play, injury, rehabilitation, basketball]
---

# Return to Play (RTP)

## Definizione

Il Return to Play (RTP) è il processo decisionale strutturato che guida il ritorno di un atleta all'attività sportiva completa dopo un infortunio. Il processo coinvolge staff medico, fisioterapista, preparatore fisico e coach.

**IMPORTANTE**: Il sistema TrainMindAI supporta il preparatore fisico nel monitoraggio del carico durante il RTP, ma NON emette decisioni cliniche. La decisione di autorizzare il ritorno è competenza dello staff medico.

## Fasi del RTP

### Fase 1: Return to Activity (RTA)
L'atleta torna a fare attività fisica generale, non sport-specifica.
- Obiettivo: ripristino della funzione fisica di base
- Criteri: assenza di dolore a riposo, ROM recuperato, forza >70% controlaterale

### Fase 2: Return to Sport (RTS)
L'atleta torna ad allenarsi con la squadra, con limitazioni.
- Obiettivo: riacquisire le qualità sport-specifiche
- Criteri: superamento test funzionali, forza >85% controlaterale, no dolore sotto carico

### Fase 3: Return to Performance (RTP)
L'atleta è disponibile per la competizione senza limitazioni.
- Obiettivo: piena partecipazione a partite ufficiali
- Criteri: completamento di 2+ settimane di allenamento completo senza sintomi

## Progressione del carico nel RTP

### Principi fondamentali
1. **Progressione graduale**: incrementi del 10-15% settimanale massimo
2. **Monitoraggio ACWR**: attenzione all'ACWR artificialmente alto (carico cronico basso)
3. **Criteri oggettivi**: non basarsi solo sulla sensazione dell'atleta
4. **No back-to-back**: evitare carichi elevati in giorni consecutivi inizialmente
5. **Registrare tutto**: ogni sessione deve essere documentata

### Schema di progressione tipo (basket)

| Settimana | Attività | % Carico team | Minutaggio partita |
|-----------|----------|---------------|-------------------|
| 1 | Condizionamento individuale | 30-40% | 0 |
| 2 | Tecnica individuale + condizionamento | 40-50% | 0 |
| 3 | Allenamento parziale con squadra | 50-60% | 0 |
| 4 | Allenamento completo (no contatto) | 60-75% | 0 |
| 5 | Allenamento completo (con contatto) | 75-90% | 0-10 min |
| 6 | Allenamento completo + partita controllata | 90-100% | 10-20 min |
| 7+ | Piena partecipazione | 100% | Normale |

### Gestione dell'ACWR durante il RTP

**Problema**: dopo un infortunio lungo (>2 settimane), il carico cronico cala drasticamente. Quando l'atleta torna, anche un carico modesto produce un ACWR elevato.

**Soluzione**:
- Non usare l'ACWR come unico criterio nelle prime 2 settimane di rientro
- Usare il carico assoluto come riferimento (confronto con valori pre-infortunio)
- Ricalcolare il carico cronico considerando le settimane effettive di ripresa
- Monitorare la percezione soggettiva (RPE, dolore, fatica) come indicatore primario

```
# Esempio calcolo ACWR adattato post-infortunio
if settimane_dal_rientro < 3:
    # Usare riferimento assoluto, non ACWR
    riferimento = carico_medio_pre_infortunio
    target_giornaliero = riferimento * progressione_settimana
else:
    # Tornare al calcolo ACWR standard
    acwr = acute_load / chronic_load
```

## Monitoraggio specifico durante RTP

### Indicatori da tracciare quotidianamente
- sRPE della sessione
- Dolore (scala 0-10, localizzazione)
- Gonfiore (sì/no, grado)
- ROM (range of motion) dell'articolazione coinvolta
- Qualità del sonno
- Readiness percepita
- Note del fisioterapista

### Criteri di allarme (stop/regressione)
- Dolore ≥ 4/10 durante l'attività
- Dolore che aumenta il giorno dopo (>24h)
- Gonfiore nuovo o aumentato
- Sensazione di instabilità
- Riduzione del ROM rispetto al giorno precedente
- RPE molto più alta dell'atteso per il tipo di sessione

### Criteri per avanzamento alla fase successiva
- Completamento di almeno 3 sessioni consecutive senza sintomi
- sRPE coerente con il tipo di sessione
- Nessun dolore residuo il giorno dopo
- Test funzionali superati (se previsti per la fase)
- Validazione dello staff medico

## Specificità del basket

### Infortuni più comuni e tempi medi
| Infortunio | Tempo RTP tipico | Attenzione specifica |
|-----------|-----------------|---------------------|
| Distorsione caviglia grado 1 | 1-2 settimane | Stabilità, propriocezione |
| Distorsione caviglia grado 2 | 3-6 settimane | Salti, cambi direzione |
| Stiramento muscolare grado 1 | 1-3 settimane | Sprint, decelerazioni |
| Stiramento muscolare grado 2 | 3-8 settimane | Progressione sprint graduale |
| Tendinopatia rotulea | Variabile | Gestione volume salti |
| Lesione LCA | 6-12 mesi | Protocollo specifico lungo |

### Considerazioni basket-specifiche
- I salti sono l'ultimo gesto da reintrodurre per infortuni agli arti inferiori
- Il contatto va reintrodotto progressivamente
- Il minutaggio in partita va controllato anche dopo il pieno rientro (2-3 settimane)
- Back-to-back games sono sconsigliati nelle prime 2 settimane post-rientro

## Ruolo del preparatore fisico nel RTP

Il preparatore fisico:
1. **Pianifica** la progressione del carico (in accordo con staff medico)
2. **Monitora** i dati giornalieri (sRPE, dolore, readiness)
3. **Segnala** anomalie allo staff medico
4. **Adatta** la programmazione in base ai feedback
5. **Documenta** ogni sessione e progressione

Il preparatore fisico **NON**:
- Decide autonomamente il ritorno in campo
- Modifica la progressione senza consultare lo staff medico
- Ignora segnali di allarme dell'atleta
- Accelera la progressione per pressioni esterne (coach, dirigenza)

## Riferimenti

- Ardern CL et al. (2016). 2016 Consensus statement on return to sport. BJSM.
- Blanch P, Gabbett TJ (2016). Has the athlete trained enough to return to play safely?
- Buckthorpe M et al. (2019). Recommendations for hamstring function testing and return to sport criteria.
