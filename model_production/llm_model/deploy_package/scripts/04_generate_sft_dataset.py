"""
scripts/04_generate_sft_dataset.py
==================================
STEP 4: Generazione Dataset SFT per il fine-tuning LoRA

Genera coppie input/output in formato JSONL per addestrare la LoRA.
Il dataset viene creato con esempi sintetici realistici che insegnano
al modello lo STILE dei report e degli alert (non la conoscenza, che è in RAG).

Composizione target:
- 40% report giornalieri
- 20% sintesi atleta
- 15% alert workload
- 15% sintesi squadra
- 10% rifiuti strutturati (fuori scope)

Esecuzione:
    python scripts/04_generate_sft_dataset.py

Output:
    data/sft/train.jsonl — Dataset di training (80% degli esempi)
    data/sft/eval.jsonl  — Dataset di validazione (20% degli esempi)

Ri-eseguibile: Sì. Rigenera i dataset.
"""

import json
import random
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rich.console import Console
from rich.panel import Panel

from config.settings import settings

console = Console()

# =============================================================================
# SYSTEM PROMPT FISSO per tutti gli esempi SFT
# =============================================================================
SYSTEM_PROMPT = (
    "Sei l'assistente AI del preparatore fisico di basket. "
    "Stile tecnico-operativo, asciutto, mai medico. "
    "Rispondi in italiano. Usa terminologia tecnica standard (RPE, ACWR, workload, strain). "
    "Se i dati sono insufficienti, dichiaralo. Se la richiesta è fuori ambito, rifiuta."
)

# =============================================================================
# GENERATORI DI ESEMPI
# =============================================================================

def generate_alert_examples(n: int = 50) -> list[dict]:
    """
    Genera esempi di alert workload.
    Ogni esempio è una coppia input (dati atleta JSON) → output (alert JSON).
    """
    examples = []
    
    alert_templates = [
        {
            "code": "ACWR_HIGH",
            "values": [(1.52, 1.5, "warning"), (1.65, 1.5, "warning"), (2.1, 2.0, "critical"), (1.8, 1.5, "critical")],
            "messages": [
                "ACWR {value} sopra soglia (>{threshold}). Carico acuto significativamente superiore al carico cronico.",
                "ACWR elevato a {value} (soglia {threshold}). Rapporto acuto/cronico indica sovraccarico recente.",
            ],
            "suggestions": [
                "Ridurre il carico nella prossima sessione del 30%. Verificare indicatori soggettivi (dolore, fatica, sonno). Se ACWR resta >{threshold} per 48h, inserire giorno di scarico.",
                "Valutare riduzione dell'intensità domani. Monitorare wellness mattutino. Evitare sessioni ad alta intensità nelle prossime 48h.",
            ],
        },
        {
            "code": "MONOTONIA_HIGH",
            "values": [(2.1, 2.0, "warning"), (2.5, 2.0, "warning"), (3.2, 2.0, "critical")],
            "messages": [
                "Monotonia {value} sopra soglia (>{threshold}). Il carico settimanale è troppo uniforme, manca variazione.",
                "Monotonia elevata ({value}). Distribuzione del carico nella settimana eccessivamente costante.",
            ],
            "suggestions": [
                "Inserire maggiore variazione nel carico giornaliero. Alternare sessioni ad alta e bassa intensità. Verificare che siano previsti giorni di scarico.",
                "Programmare almeno 2 giorni a carico molto ridotto nella prossima settimana. La monotonia prolungata aumenta rischio infortunio e immunodepressione.",
            ],
        },
        {
            "code": "RPE_SPIKE",
            "values": [(9, 7, "warning"), (10, 7, "critical"), (8, 5, "warning")],
            "messages": [
                "RPE {value} significativamente sopra l'atteso per la sessione (atteso ≤{threshold}). Possibile sovraccarico acuto.",
                "Spike RPE: valore {value} vs atteso {threshold}. L'atleta ha percepito la sessione come molto più intensa del programmato.",
            ],
            "suggestions": [
                "Verificare con l'atleta le cause della RPE elevata. Valutare se ridurre l'intensità nella prossima sessione. Monitorare dolore muscolare nelle 24-48h successive.",
                "Indagare la causa dello spike (sessione più intensa, stato di fatica preesistente, scarso recupero). Ridurre il carico domani.",
            ],
        },
        {
            "code": "CONSECUTIVE_HIGH",
            "values": [(3, 2, "warning"), (4, 2, "critical"), (5, 2, "critical")],
            "messages": [
                "{value} giorni consecutivi con RPE ≥ 7. L'atleta non ha avuto recupero adeguato.",
                "Sequenza di {value} sessioni consecutive ad alta intensità (RPE ≥ 7). Accumulo di fatica senza recupero.",
            ],
            "suggestions": [
                "Inserire almeno 1 giorno di carico ridotto (RPE ≤ 4) o riposo completo. Verificare qualità del sonno e dolore muscolare.",
                "Programmare scarico immediato. L'atleta necessita di almeno 24-48h a bassa intensità prima di riprendere carichi elevati.",
            ],
        },
    ]
    
    athletes = [f"A{i:02d}" for i in range(1, 16)]
    
    for _ in range(n):
        template = random.choice(alert_templates)
        value, threshold, level = random.choice(template["values"])
        athlete = random.choice(athletes)
        message = random.choice(template["messages"]).format(value=value, threshold=threshold)
        suggestion = random.choice(template["suggestions"]).format(threshold=threshold)
        
        user_input = json.dumps({
            "athlete_id": athlete,
            "alert_type": template["code"],
            "current_value": value,
            "threshold": threshold,
            "request": "Genera alert workload per questo atleta"
        }, ensure_ascii=False)
        
        assistant_output = json.dumps({
            "type": "alert_workload",
            "level": level,
            "athlete_id": athlete,
            "code": template["code"],
            "value": value,
            "threshold": threshold,
            "message": message,
            "suggestion": suggestion,
        }, ensure_ascii=False, indent=2)
        
        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": assistant_output},
            ]
        })
    
    return examples


def generate_athlete_summary_examples(n: int = 40) -> list[dict]:
    """Genera esempi di sintesi atleta."""
    examples = []
    
    roles = ["PG", "SG", "SF", "PF", "C"]
    statuses = ["green", "yellow", "red"]
    trends = ["increasing", "stable", "decreasing"]
    
    for _ in range(n):
        athlete = f"A{random.randint(1, 15):02d}"
        role = random.choice(roles)
        acwr = round(random.uniform(0.6, 2.0), 2)
        monotony = round(random.uniform(0.8, 3.0), 1)
        weekly_load = random.randint(1200, 4000)
        sleep = random.randint(3, 9)
        fatigue = random.randint(2, 9)
        readiness = random.randint(3, 9)
        trend = random.choice(trends)
        
        # Determina status basato sui valori
        if acwr > 1.5 or monotony > 2.0 or readiness <= 4:
            status = "red"
        elif acwr > 1.3 or monotony > 1.5 or readiness <= 6:
            status = "yellow"
        else:
            status = "green"
        
        # Genera zona ACWR
        if acwr < 0.8:
            acwr_zone = "undertraining"
        elif acwr <= 1.3:
            acwr_zone = "sweet_spot"
        elif acwr <= 1.5:
            acwr_zone = "gray_zone"
        else:
            acwr_zone = "danger_zone"
        
        user_input = json.dumps({
            "athlete_id": athlete,
            "role": role,
            "period": "ultima settimana",
            "acwr": acwr,
            "monotony": monotony,
            "weekly_load_au": weekly_load,
            "sleep": sleep,
            "fatigue": fatigue,
            "readiness": readiness,
            "load_trend": trend,
            "request": "Genera sintesi atleta"
        }, ensure_ascii=False)
        
        # Genera osservazioni basate sui dati
        observations = []
        if acwr > 1.5:
            observations.append(f"ACWR {acwr} in danger zone. Necessita riduzione carico immediata.")
        elif acwr > 1.3:
            observations.append(f"ACWR {acwr} in zona grigia. Monitorare evoluzione nelle prossime 48h.")
        else:
            observations.append(f"ACWR {acwr} in sweet spot. Carico ben gestito.")
        
        if monotony > 2.0:
            observations.append(f"Monotonia {monotony} elevata. Inserire variazione nel microciclo.")
        
        if sleep <= 5:
            observations.append(f"Qualità sonno bassa ({sleep}/10). Possibile impatto su recupero.")
        
        # Genera suggerimento
        if status == "red":
            suggestion = "Ridurre carico nella prossima sessione. Verificare con staff medico se necessario. Priorità: recupero."
        elif status == "yellow":
            suggestion = "Monitorare con attenzione. Evitare incrementi di carico. Sessione domani a intensità moderata."
        else:
            suggestion = "Proseguire con la programmazione prevista. L'atleta è in condizione ottimale."
        
        assistant_output = (
            f"SINTESI ATLETA — {athlete}\n"
            f"Ruolo: {role} | Periodo: ultima settimana\n\n"
            f"STATO ATTUALE\n"
            f"- ACWR: {acwr} ({acwr_zone})\n"
            f"- Monotonia: {monotony}\n"
            f"- Carico settimanale: {weekly_load} AU\n"
            f"- Trend: {trend}\n\n"
            f"INDICATORI SOGGETTIVI\n"
            f"- Sonno: {sleep}/10\n"
            f"- Fatica: {fatigue}/10\n"
            f"- Readiness: {readiness}/10\n\n"
            f"OSSERVAZIONI\n"
            + "\n".join(f"- {obs}" for obs in observations) + "\n\n"
            f"SUGGERIMENTO OPERATIVO\n"
            f"- {suggestion}"
        )
        
        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": assistant_output},
            ]
        })
    
    return examples


def generate_daily_report_examples(n: int = 60) -> list[dict]:
    """Genera esempi di report giornalieri."""
    examples = []
    
    session_types = [
        "Allenamento completo (tecnica + tattica)",
        "Preparazione fisica",
        "Tattica pre-partita",
        "Recupero attivo",
        "Allenamento tecnico individuale",
        "Scrimmage interno",
    ]
    
    for _ in range(n):
        session_type = random.choice(session_types)
        duration = random.randint(45, 120)
        n_present = random.randint(9, 14)
        n_total = 14
        avg_rpe = round(random.uniform(3.0, 8.5), 1)
        avg_srpe = round(avg_rpe * duration, 0)
        
        # Genera atleti con carico elevato
        high_load = []
        n_high = random.randint(0, 4)
        for i in range(n_high):
            athlete = f"A{random.randint(1, 15):02d}"
            rpe = random.randint(7, 9)
            high_load.append(f"{athlete} (RPE {rpe})")
        
        # Genera alert
        alerts = []
        if random.random() > 0.5:
            a = f"A{random.randint(1, 15):02d}"
            acwr = round(random.uniform(1.35, 1.7), 2)
            alerts.append(f"⚠️ {a}: ACWR {acwr}, in zona {'grigia' if acwr < 1.5 else 'di pericolo'}. Monitorare.")
        if random.random() > 0.7:
            a = f"A{random.randint(1, 15):02d}"
            alerts.append(f"⚠️ {a}: terzo giorno consecutivo con RPE ≥ 7. Valutare scarico.")
        
        user_input = json.dumps({
            "date": "2026-03-15",
            "session_type": session_type,
            "duration_min": duration,
            "athletes_present": n_present,
            "athletes_total": n_total,
            "rpe_values": {f"A{i:02d}": random.randint(3, 9) for i in range(1, n_present + 1)},
            "request": "Genera report giornaliero"
        }, ensure_ascii=False)
        
        alerts_text = "\n".join(f"- {a}" for a in alerts) if alerts else "- Nessuna segnalazione critica"
        high_load_text = ", ".join(high_load) if high_load else "nessuno"
        
        assistant_output = (
            f"REPORT GIORNALIERO — 15 Marzo 2026\n"
            f"Sessione: {session_type} | Durata: {duration} min | Fase: In-season\n\n"
            f"RIEPILOGO CARICO\n"
            f"- RPE media squadra: {avg_rpe}\n"
            f"- sRPE media: {int(avg_srpe)} AU\n"
            f"- Atleti presenti: {n_present}/{n_total}\n"
            f"- Atleti con carico elevato (RPE ≥ 7): {high_load_text}\n\n"
            f"SEGNALAZIONI\n{alerts_text}\n\n"
            f"NOTE OPERATIVE\n"
            f"- Sessione completata secondo programma\n"
            f"- Nessun segnale di dolore muscolare riportato\n"
            f"- Carico complessivo {'adeguato alla fase stagionale' if avg_rpe < 7 else 'elevato, monitorare domani'}\n\n"
            f"---\n"
            f"Disclaimer: Questo output è uno strumento di supporto. Non sostituisce il giudizio "
            f"professionale dello staff tecnico-sanitario."
        )
        
        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": assistant_output},
            ]
        })
    
    return examples


def generate_team_summary_examples(n: int = 30) -> list[dict]:
    """Genera esempi di sintesi squadra settimanale."""
    examples = []
    
    for _ in range(n):
        week = random.randint(1, 40)
        sessions_done = random.randint(4, 6)
        sessions_planned = random.randint(4, 6)
        matches = random.randint(0, 2)
        avg_load = random.randint(1800, 3500)
        prev_load = random.randint(1800, 3500)
        load_change = round((avg_load - prev_load) / prev_load * 100, 0)
        load_trend_str = f"+{int(load_change)}%" if load_change > 0 else f"{int(load_change)}%"
        n_total = 14
        n_available = random.randint(10, 14)
        
        # Atleti con ACWR > 1.3
        acwr_above = [f"A{random.randint(1,15):02d}" for _ in range(random.randint(0, 3))]
        mono_above = [f"A{random.randint(1,15):02d}" for _ in range(random.randint(0, 2))]
        
        # Classifica atleti
        green_list = [f"A{i:02d}" for i in random.sample(range(1, 15), random.randint(6, 10))]
        yellow_list = [f"A{i:02d}" for i in random.sample(range(1, 15), random.randint(1, 3))]
        red_list = [f"A{i:02d}" for i in random.sample(range(1, 15), random.randint(0, 2))]
        
        # Priority alerts
        alerts = []
        if acwr_above:
            alerts.append(f"{acwr_above[0]} con ACWR in zona grigia, monitorare prossime 48h")
        if mono_above:
            alerts.append(f"{mono_above[0]} monotonia elevata, inserire variazione")
        if not alerts:
            alerts.append("Nessuna segnalazione prioritaria questa settimana")
        
        user_input = json.dumps({
            "week_number": week,
            "sessions_completed": sessions_done,
            "sessions_planned": sessions_planned,
            "matches_played": matches,
            "avg_weekly_load_au": avg_load,
            "previous_week_load_au": prev_load,
            "athletes_total": n_total,
            "athletes_available": n_available,
            "acwr_above_13": acwr_above,
            "monotony_above_2": mono_above,
            "request": "Genera sintesi squadra settimanale"
        }, ensure_ascii=False)
        
        assistant_output = (
            f"SINTESI SQUADRA — Settimana {week}\n"
            f"Sessioni svolte: {sessions_done}/{sessions_planned} | Partite: {matches}\n\n"
            f"CARICO COLLETTIVO\n"
            f"- sRPE media settimanale squadra: {avg_load} AU\n"
            f"- Trend vs settimana precedente: {load_trend_str}\n"
            f"- Giocatori con ACWR > 1.3: {', '.join(acwr_above) if acwr_above else 'nessuno'}\n"
            f"- Giocatori con monotonia > 2.0: {', '.join(mono_above) if mono_above else 'nessuno'}\n\n"
            f"DISPONIBILITÀ\n"
            f"- Pienamente disponibili: {n_available}/{n_total}\n"
            f"- Non disponibili: {n_total - n_available} atleti\n\n"
            f"CLASSIFICAZIONE ATLETI\n"
            f"🟢 Condizione ottimale: {', '.join(green_list[:5])}\n"
            f"🟡 Monitoraggio: {', '.join(yellow_list)}\n"
            f"🔴 Attenzione: {', '.join(red_list) if red_list else 'nessuno'}\n\n"
            f"SEGNALAZIONI PRIORITARIE\n"
            + "\n".join(f"- {a}" for a in alerts) + "\n\n"
            f"NOTA PER LO STAFF\n"
            f"- {'Settimana gestita bene, proseguire programmazione.' if not acwr_above else 'Attenzione ai carichi individuali, valutare scarico per atleti segnalati.'}"
        )
        
        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": assistant_output},
            ]
        })
    
    return examples


def generate_refusal_examples(n: int = 20) -> list[dict]:
    """Genera esempi di rifiuti strutturati per richieste fuori scope."""
    examples = []
    
    out_of_scope_requests = [
        "L'atleta A03 ha dolore al ginocchio, cosa potrebbe essere? Che terapia suggerisci?",
        "Puoi prescrivere un antinfiammatorio per il giocatore A07?",
        "A12 ha un gonfiore alla caviglia, è una distorsione di grado 2?",
        "Quale integratore dovrebbe prendere l'atleta A05 per recuperare più velocemente?",
        "L'atleta A09 ha la febbre, può allenarsi domani?",
        "Diagnosi per dolore lombare ricorrente in A01",
        "Quale fasciatura applicare per la tendinite di A11?",
        "Prescrivi un protocollo riabilitativo per A08 post-operazione LCA",
        "L'atleta ha mal di testa ricorrente, cosa può essere?",
        "Suggerisci un piano nutrizionale per l'atleta A04",
    ]
    
    refusal_template = (
        "⚠️ RICHIESTA FUORI AMBITO\n\n"
        "Non posso rispondere a questa richiesta. {reason}\n\n"
        "AZIONE CONSIGLIATA\n"
        "- {action}\n\n"
        "Il mio ruolo è limitato al supporto operativo per la gestione del carico "
        "di lavoro e il monitoraggio delle prestazioni atletiche."
    )
    
    reasons_and_actions = [
        ("La valutazione clinica, la diagnosi e la prescrizione terapeutica sono di competenza esclusiva dello staff medico.",
         "Consultare il medico sportivo o il fisioterapista del team."),
        ("Non sono autorizzato a emettere diagnosi mediche né a suggerire trattamenti farmacologici.",
         "Rivolgersi allo staff sanitario per una valutazione clinica."),
        ("La prescrizione di farmaci, integratori o protocolli riabilitativi non rientra nelle mie competenze.",
         "Consultare il medico sportivo per indicazioni specifiche."),
        ("Questa richiesta riguarda un ambito clinico/sanitario che esula dal monitoraggio del carico di lavoro.",
         "Segnalare la situazione allo staff medico per una valutazione appropriata."),
    ]
    
    for i in range(min(n, len(out_of_scope_requests))):
        reason, action = random.choice(reasons_and_actions)
        
        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": out_of_scope_requests[i]},
                {"role": "assistant", "content": refusal_template.format(reason=reason, action=action)},
            ]
        })
    
    # Genera altri esempi con variazioni se n > len(out_of_scope_requests)
    for i in range(len(out_of_scope_requests), n):
        reason, action = random.choice(reasons_and_actions)
        request = random.choice(out_of_scope_requests)
        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": request + f" (variante {i})"},
                {"role": "assistant", "content": refusal_template.format(reason=reason, action=action)},
            ]
        })
    
    return examples


def generate_wellness_alert_examples(n: int = 30) -> list[dict]:
    """Genera esempi di alert basati su wellness monitoring."""
    examples = []
    athletes = [f"A{i:02d}" for i in range(1, 16)]

    scenarios = [
        {
            "code": "WELLNESS_LOW",
            "data_fn": lambda: {
                "wellness_index": round(random.uniform(3.0, 4.9), 1),
                "sleep_quality": random.randint(2, 5),
                "fatigue": random.randint(6, 9),
                "stress": random.randint(5, 9),
                "motivation": random.randint(3, 6),
                "days_below_5": random.randint(1, 4),
            },
            "messages": [
                "Wellness Index {wellness_index}/10, sotto soglia 5.0 da {days_below_5} giorni. Sonno {sleep_quality}/10, fatica {fatigue}/10.",
                "Calo wellness persistente ({wellness_index}/10). Stress {stress}/10, motivazione {motivation}/10. Attenzione.",
            ],
            "suggestions": [
                "Ridurre carico del 30-50% nella prossima sessione. Verificare cause extra-sportive (studio, vita personale). Se il trend non migliora entro 48h, giorno di riposo completo.",
                "Priorità recupero: sessione leggera o recovery attivo. Colloquio individuale con l'atleta per identificare fattori di stress. Monitorare sonno.",
            ],
        },
        {
            "code": "SLEEP_LOW",
            "data_fn": lambda: {
                "sleep_quality": random.randint(2, 4),
                "sleep_hours": round(random.uniform(4.0, 5.5), 1),
                "consecutive_nights": random.randint(2, 4),
            },
            "messages": [
                "Sonno {sleep_quality}/10 per {consecutive_nights} notti consecutive. Durata media {sleep_hours}h (target 8-10h).",
                "Qualità sonno critica: {sleep_quality}/10 da {consecutive_nights} notti. Solo {sleep_hours}h di media.",
            ],
            "suggestions": [
                "Verificare igiene del sonno: no schermi 1h prima, camera a 18-20°C. Se post-partita serale, prevedere protocollo cool-down esteso. Considerare napping 20-30 min.",
                "Investigare cause: trasferta recente? Partita serale? Stress extra-sportivo? No allenamento ad alta intensità finché sleep quality non torna sopra 5/10.",
            ],
        },
        {
            "code": "READINESS_LOW",
            "data_fn": lambda: {
                "readiness": random.randint(2, 4),
                "doms": random.randint(6, 9),
                "hrv_change_pct": random.randint(-30, -15),
            },
            "messages": [
                "Readiness {readiness}/10, DOMS {doms}/10. HRV in calo del {hrv_change_pct}% rispetto al baseline.",
                "Atleta non pronto: readiness {readiness}/10. Indolenzimento muscolare elevato ({doms}/10) e HRV {hrv_change_pct}%.",
            ],
            "suggestions": [
                "Sessione di recovery attivo o riposo completo. Se DOMS ≥ 8, no lavoro ad alta intensità. Rivalutare domani prima dell'allenamento.",
                "Escludere da sessioni intense. Foam rolling + stretching + idratazione. Monitorare evoluzione DOMS nelle prossime 24h.",
            ],
        },
    ]

    for _ in range(n):
        scenario = random.choice(scenarios)
        athlete = random.choice(athletes)
        data = scenario["data_fn"]()
        level = "critical" if data.get("days_below_5", 0) >= 3 or data.get("consecutive_nights", 0) >= 3 else "warning"
        message = random.choice(scenario["messages"]).format(**data)
        suggestion = random.choice(scenario["suggestions"])

        user_input = json.dumps({
            "athlete_id": athlete,
            "alert_type": scenario["code"],
            **data,
            "request": "Genera alert wellness"
        }, ensure_ascii=False)

        assistant_output = json.dumps({
            "type": "alert_workload",
            "level": level,
            "athlete_id": athlete,
            "code": scenario["code"],
            "message": message,
            "suggestion": suggestion,
        }, ensure_ascii=False, indent=2)

        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": assistant_output},
            ]
        })
    return examples


def generate_kb_qa_examples(n: int = 40) -> list[dict]:
    """Genera esempi Q&A tecnici basati sui contenuti della KB espansa."""
    examples = []

    qa_pairs = [
        # Injury prevention
        ("Quali sono i fattori di rischio principali per distorsione di caviglia nel basket?",
         "I principali fattori di rischio per distorsione di caviglia nel basket sono:\n\n"
         "FATTORI INTRINSECI\n"
         "- Storia di infortuni precedenti: fattore predittivo più forte (rischio 2-5x di recidiva)\n"
         "- Deficit propriocettivo (equilibrio monopodalico)\n"
         "- Ridotta dorsiflessione di caviglia (<35°)\n"
         "- Debolezza dei peronei\n\n"
         "FATTORI ESTRINSECI\n"
         "- Spike di carico (ACWR >1.5)\n"
         "- Superficie di gioco troppo aderente\n"
         "- Calzature consumate\n"
         "- Recupero insufficiente (<48h tra sessioni intense)\n\n"
         "PREVENZIONE\n"
         "- Programma propriocettivo 3x/settimana su tavoletta instabile\n"
         "- Rinforzo peronei con banda elastica\n"
         "- Taping/bracing per atleti con storia di distorsione\n\n"
         "Fonte: protocollo prevenzione infortuni KB."),
        # GPS metrics
        ("Come si interpretano le metriche GPS nel basket? Che differenza c'è per ruolo?",
         "Nel basket indoor si usano sistemi LPS (Local Positioning System) a ultra-wideband, non GPS classico.\n\n"
         "METRICHE CHIAVE\n"
         "- Distanza totale: 3000-6000 m/partita\n"
         "- Player Load: 300-600 AU/partita (accelerazione triassiale cumulativa)\n"
         "- Salti: 40-60/partita (critico per tendinopatia rotulea)\n"
         "- Accelerazioni/decelerazioni >2 m/s²: 40-100/partita\n\n"
         "PROFILO PER RUOLO\n"
         "- PG/SG: più distanza (5200-6200 m), meno salti (15-30)\n"
         "- SF: profilo intermedio\n"
         "- PF/C: meno distanza (3800-5200 m), più salti (30-50) e impatti\n\n"
         "INTERPRETAZIONE\n"
         "- Carico esterno alto + RPE basso → buona efficienza cardiovascolare\n"
         "- Carico esterno basso + RPE alto → possibile affaticamento\n"
         "- Dissociazione crescente nel tempo → segnale di overreaching\n\n"
         "Le soglie devono essere individualizzate (rolling average 4 settimane per atleta)."),
        # Wellness
        ("Come funziona il questionario wellness giornaliero? Quando diventa un alert?",
         "Il questionario wellness si compila ogni mattina, entro 30 min dal risveglio.\n\n"
         "ITEM (scala 1-10 ciascuno)\n"
         "- Qualità del sonno\n- Livello di fatica\n- Dolore muscolare (DOMS)\n- Stress percepito\n- Motivazione\n- Readiness\n\n"
         "WELLNESS INDEX = media dei 6 item\n"
         "- ≥ 7.0: condizione ottimale, programma regolare\n"
         "- 5.0-6.9: monitorare, possibile adattamento carico\n"
         "- < 5.0: attenzione, ridurre carico o recupero\n\n"
         "SOGLIE DI ALERT\n"
         "- Wellness < 5.0 per 1 giorno → ⚠️ warning\n"
         "- Wellness < 5.0 per 3+ giorni → 🔴 critical\n"
         "- Sleep < 4 per 2+ notti → ⚠️ warning\n"
         "- DOMS ≥ 8 → ⚠️ no alta intensità\n"
         "- Stress ≥ 8 + fatica ≥ 8 → 🔴 sessione leggera o riposo\n\n"
         "Il TREND è più importante del valore assoluto: un calo su 3+ giorni è più significativo di un singolo valore basso."),
        # Tapering
        ("Come si programma un tapering pre-playoff nel basket?",
         "Il tapering pre-playoff segue un protocollo esponenziale su 8-10 giorni:\n\n"
         "PRINCIPI\n"
         "- Riduzione volume: -40% a -60% rispetto alla settimana di picco\n"
         "- Mantenimento intensità: NON ridurre (o max -10%)\n"
         "- Frequenza: mantenuta o leggermente ridotta (-20% max)\n\n"
         "ESEMPIO PRATICO (10 giorni)\n"
         "- Giorno -10: 85% volume, 100% intensità\n"
         "- Giorno -7: 65% volume, 95% intensità (focus tattico)\n"
         "- Giorno -5: 50% volume, 90% intensità (recovery + tecnica)\n"
         "- Giorno -3: 40% volume, 85% (walk-through tattico)\n"
         "- Giorno -1: REST o recovery attivo leggero\n\n"
         "MONITORAGGIO\n"
         "- sRPE deve calare del 40-50%\n"
         "- ACWR scende verso 0.6-0.8 (normale durante taper)\n"
         "- Wellness dovrebbe migliorare\n"
         "- Se wellness non migliora → tapering insufficiente\n\n"
         "ATTENZIONE: la ripresa post-tapering deve essere graduale (≤10%/settimana) per evitare spike ACWR."),
        # Strength
        ("Come programmare la forza in-season con 2 partite a settimana?",
         "Con 2 partite/settimana, la sala pesi si riduce al minimo necessario:\n\n"
         "SCHEMA TIPO\n"
         "- MD+1 (post partita 1): recovery (solo chi ha giocato >20 min)\n"
         "- MD+2: forza full body ridotta — 70-80% 1RM, 2x4-6 rep, solo fondamentali (squat, RDL, bench)\n"
         "- MD-1 (pre partita 2): attivazione neuromuscolare — 50% 1RM, 2x3 rep\n"
         "- MD (partita 2)\n"
         "- MD+1: recovery\n"
         "- Free: sessione complementare (core, mobilità, prehab)\n\n"
         "REGOLE\n"
         "- Target RPE sala pesi: 7-8 (2-3 RIR). MAI a cedimento in-season.\n"
         "- sRPE forza (RPE × durata) va sommata al carico giornaliero totale.\n"
         "- Se ACWR > 1.3: ridurre volume forza del 30%.\n"
         "- Se Wellness < 5: saltare forza o ridurre a sola attivazione."),
        # Nutrition
        ("Qual è il protocollo di idratazione per una partita di basket?",
         "Protocollo idratazione per partita di basket:\n\n"
         "PRE-PARTITA (2-4h prima)\n"
         "- 5-7 ml/kg di peso corporeo (es. 400-560 ml per 80 kg)\n"
         "- Preferire acqua o bevanda con elettroliti\n\n"
         "DURANTE LA PARTITA\n"
         "- 150-250 ml ogni 15-20 minuti\n"
         "- Sfruttare time-out, pause e cambi\n"
         "- Bevande con 6-8% carboidrati per partite >60 min di live time\n\n"
         "POST-PARTITA\n"
         "- 150% del peso perso in liquidi entro 2-4 ore\n"
         "- Includere sodio (bevanda sportiva o pasto salato)\n\n"
         "MONITORAGGIO\n"
         "- Peso pre/post partita: perdita target < 2% del peso corporeo\n"
         "- Colore urine: target 1-3 (giallo chiaro)\n\n"
         "NOTA: una disidratazione del 2% riduce la performance del 10-20% e peggiora concentrazione e tempi di reazione."),
        # Overtraining
        ("Quali sono i segnali di overreaching non funzionale? Come si interviene?",
         "L'overreaching non funzionale (NFOR) è un accumulo eccessivo di fatica che NON porta a supercompensazione.\n\n"
         "SEGNALI PRECOCI\n"
         "- Wellness Index in calo per 5+ giorni\n"
         "- ACWR > 1.5 per 2+ settimane\n"
         "- RPE soggettivo molto superiore al carico programmato\n"
         "- HRV in calo su 5+ giorni\n"
         "- Sleep quality < 5 per 3+ notti\n"
         "- Calo motivazione persistente\n\n"
         "SEGNALI TARDIVI\n"
         "- Malattie frequenti (>2 episodi in 4 settimane)\n"
         "- FC a riposo elevata (+5-10 bpm vs baseline)\n"
         "- Perdita massa muscolare\n"
         "- Disturbi dell'umore persistenti\n\n"
         "PROTOCOLLO DI RECUPERO\n"
         "- Settimana 1: carico al 30-40%, focus recovery\n"
         "- Settimana 2: carico al 50-60%, reintroduzione graduale intensità\n"
         "- Settimana 3: carico al 70-80%, test performance\n"
         "- Settimana 4: ritorno al carico normale se performance ≥ 95% baseline\n\n"
         "La prevenzione è migliore della cura: monitoraggio integrato (sRPE + wellness + HRV + test funzionali)."),
        # Plyometrics
        ("Come gestire il volume di salti per un centro con tendinopatia rotulea in-season?",
         "La gestione della tendinopatia rotulea in-season per un centro richiede un approccio integrato:\n\n"
         "VOLUME SALTI\n"
         "- Target: < 200 salti/settimana (incluso partita)\n"
         "- Un centro fa 35-50 salti/partita → budget allenamento: 150-165 salti/settimana\n"
         "- Tracking settimanale obbligatorio (dati LPS/GPS)\n\n"
         "GESTIONE DOLORE (scala NRS 0-10)\n"
         "- NRS 0-2: programma normale\n"
         "- NRS 3-4: ridurre volume salti del 30%, isometrics pre-allenamento\n"
         "- NRS 5-6: ridurre volume del 50%, no pliometria alta intensità\n"
         "- NRS ≥ 7: sospendere pliometria, valutazione medica\n\n"
         "PROTOCOLLO GIORNALIERO\n"
         "- Pre-allenamento: isometrici (wall sit 5x45s @ 70% MVC) → effetto analgesico\n"
         "- Post-allenamento: ghiaccio 15 min se dolore > 3 NRS\n"
         "- 2x/settimana: Heavy Slow Resistance (squat decline 4x6, 3s eccentrico)\n\n"
         "ALERT AUTOMATICO: se volume salti settimanale > 200, il sistema genera alert."),
        # Heart rate
        ("Come si calcola il TRIMP di Edwards e quando usare HR vs sRPE?",
         "Il TRIMP di Edwards quantifica il carico interno basandosi sulle zone HR:\n\n"
         "CALCOLO\n"
         "Per ogni zona HR, si moltiplica il tempo speso (minuti) per un fattore:\n"
         "- Zona 1 (50-60% HRmax): min × 1\n"
         "- Zona 2 (60-70%): min × 2\n"
         "- Zona 3 (70-80%): min × 3\n"
         "- Zona 4 (80-90%): min × 4\n"
         "- Zona 5 (90-100%): min × 5\n"
         "TRIMP = somma dei contributi di tutte le zone.\n\n"
         "QUANDO USARE HR\n"
         "- Conditioning aerobico (garantire zona corretta)\n"
         "- Small-sided games (monitoraggio intensità real-time)\n"
         "- Recovery sessions (verificare bassa intensità)\n"
         "- Return to play (progressione cardiovascolare)\n\n"
         "QUANDO NON AFFIDARSI SOLO ALLA HR\n"
         "- Forza: HR non riflette il carico neuromuscolare\n"
         "- Azioni brevi esplosive: HR risponde con ritardo\n"
         "- Atleti in terapia farmacologica\n\n"
         "DISSOCIAZIONE HR-RPE\n"
         "- HR bassa + RPE alta → sforzo neuromuscolare o fatica mentale\n"
         "- HR alta + RPE bassa → buona efficienza cardiovascolare\n"
         "- Trend dissociazione crescente → possibile overreaching."),
        # Recovery
        ("Qual è la gerarchia delle strategie di recupero nel basket?",
         "Le strategie sono ordinate per importanza ed evidenza scientifica:\n\n"
         "TIER 1 — FONDAMENTALI (evidenza forte)\n"
         "1. Sonno: 8-10h/notte, target prioritario. È il più potente strumento di recupero.\n"
         "2. Nutrizione post-esercizio: entro 30-60 min. Carboidrati 1.0-1.2 g/kg + proteine 0.3-0.4 g/kg.\n"
         "3. Programmazione del carico: alternanza alto/basso, deload ogni 3-4 settimane.\n\n"
         "TIER 2 — SUPPORTO (evidenza moderata)\n"
         "4. Recovery attivo: 15-30 min a zona HR 1-2 (50-65% HRmax), RPE 2-3.\n"
         "5. Cold Water Immersion: 10-15°C, 10-15 min. Solo post-partita, MAI dopo forza.\n"
         "6. Foam rolling: 60-120s per gruppo muscolare. Riduce DOMS percepito.\n"
         "7. Stretching statico: 30-60s per posizione. Solo post-allenamento, mai pre.\n\n"
         "TIER 3 — COMPLEMENTARE (evidenza limitata)\n"
         "8. Compressione: beneficio piccolo ma consistente su DOMS\n"
         "9. Crioterapia whole body: evidenza limitata, effetto simile a CWI\n"
         "10. Massaggio: rilassamento, riduzione percezione dolore\n\n"
         "NOTA: in settimane con 3 partite, il recupero diventa prioritario su tutto il resto."),
        # Travel
        ("Come gestire i viaggi in trasferta per minimizzare l'impatto sulla performance?",
         "I viaggi impattano significativamente la performance nel basket.\n\n"
         "IMPATTO QUANTIFICATO\n"
         "- Home disadvantage: 3-5% nella performance\n"
         "- Viaggi >3 fusi: -5-8% in metriche fisiche\n"
         "- Qualità sonno: -15-20% la prima notte\n"
         "- Rischio infortuni: +10-15% in trasferta\n\n"
         "PROTOCOLLO PRE-VIAGGIO\n"
         "- Idratazione aumentata (+500 ml) 24h prima\n"
         "- Pasto completo prima della partenza\n"
         "- Snack preparati per il viaggio\n\n"
         "DURANTE IL VIAGGIO (>2h)\n"
         "- Alzarsi ogni 60-90 min\n"
         "- 200 ml acqua ogni ora\n"
         "- Compressione arti inferiori per voli >4h\n\n"
         "ALL'ARRIVO\n"
         "- Sessione mobilità/attivazione 15-20 min\n"
         "- Pasto completo entro 1h\n"
         "- Esposizione luce naturale (ritmo circadiano)\n\n"
         "JET LAG: circa 1 giorno di adattamento per fuso orario attraversato."),
        # Mobility
        ("Quali sono le aree di mobilità prioritarie per un giocatore di basket?",
         "Le aree prioritarie per la mobilità nel basket, in ordine di importanza:\n\n"
         "1. CAVIGLIA — DORSIFLESSIONE\n"
         "- Target: ≥ 35° (weight-bearing lunge test ≥ 10 cm)\n"
         "- Critica per: profondità squat, meccanica atterraggio, difesa\n"
         "- Esercizi: half-kneeling ankle mob, banded mob, soleus stretch\n\n"
         "2. ANCA — FLESSIONE, ESTENSIONE, ROTAZIONE\n"
         "- Target: flessione ≥120°, estensione ≥15°, rotazione interna ≥30°\n"
         "- Critica per: accelerazione, salto, cambi direzione\n"
         "- Esercizi: 90/90 hip switch, pigeon stretch, half-kneeling hip flexor\n\n"
         "3. COLONNA TORACICA — ROTAZIONE E ESTENSIONE\n"
         "- Critica per: meccanica tiro, postura difensiva\n"
         "- Esercizi: open book rotation, foam roller extension\n\n"
         "4. SPALLA\n"
         "- Critica per: tiro, passaggi sopra la testa\n"
         "- Esercizi: wall slides, shoulder CARs\n\n"
         "Test periodici ogni 4-6 settimane. Deficit sotto soglia → esercizi correttivi specifici nel warm-up."),
        # Load management
        ("Come funziona la classificazione semaforo giornaliera degli atleti?",
         "Il sistema classifica ogni atleta ogni giorno in base ai parametri di monitoraggio:\n\n"
         "🟢 VERDE — Disponibile pieno\n"
         "- Wellness ≥ 6\n"
         "- ACWR 0.8-1.3\n"
         "- Nessuna limitazione\n"
         "→ Allenamento secondo programma\n\n"
         "🟡 GIALLO — Disponibile con cautela\n"
         "- Wellness 5-6\n"
         "- OPPURE ACWR 1.3-1.5\n"
         "- OPPURE sleep < 5 per 1 notte\n"
         "→ Carico adattato, monitoraggio stretto\n\n"
         "🟠 ARANCIONE — Limitato\n"
         "- Wellness < 5\n"
         "- OPPURE ACWR > 1.5\n"
         "- OPPURE dolore NRS ≥ 4\n"
         "→ Partecipazione parziale, recupero prioritario\n\n"
         "🔴 ROSSO — Non disponibile\n"
         "- Infortunio attivo\n"
         "- OPPURE wellness < 4 per 3+ giorni\n"
         "- OPPURE ACWR > 1.8\n"
         "→ Sospensione attività, valutazione medica\n\n"
         "Il preparatore comunica la classificazione all'allenatore nel report pre-allenamento giornaliero."),
        # Pre-season
        ("Come strutturare le prime 2 settimane di pre-season per evitare infortuni?",
         "Le prime 2 settimane di pre-season (fase di ramp-up) sono le più rischiose.\n\n"
         "REGOLA CRITICA: incremento settimanale del carico (sRPE) NON deve superare il 15%.\n\n"
         "SETTIMANA 1\n"
         "- Volume: 40-50% del target in-season\n"
         "- Intensità: bassa-moderata (RPE 4-5)\n"
         "- 1 sessione/giorno (NO doppie)\n"
         "- Forza: circuito leggero, 50-60% 1RM, focus su forma e ROM\n"
         "- Conditioning: aerobico estensivo (corsa continua, bike)\n\n"
         "SETTIMANA 2\n"
         "- Volume: 55-65% del target (+10-15% vs settimana 1)\n"
         "- Intensità: moderata (RPE 5-6)\n"
         "- Ancora 1 sessione/giorno\n"
         "- Forza: incremento progressivo carichi\n"
         "- Conditioning: introduzione interval training leggero\n\n"
         "MONITORAGGIO\n"
         "- sRPE obbligatoria per ogni sessione dal giorno 1\n"
         "- Wellness questionnaire giornaliero\n"
         "- ACWR: calcolo settimanale, target 0.8-1.3\n"
         "- Screening funzionale completo nella settimana 1 (CMJ, Yo-Yo, Y-Balance, 1RM)\n\n"
         "ERRORE COMUNE: ramp-up troppo aggressivo. Incrementi >20%/settimana causano spike ACWR e infortuni."),
    ]

    for _ in range(n):
        question, answer = random.choice(qa_pairs)
        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": question},
                {"role": "assistant", "content": answer},
            ]
        })
    return examples


def generate_staff_note_examples(n: int = 25) -> list[dict]:
    """Genera esempi di note operative per lo staff (output JSON)."""
    examples = []
    athletes = [f"A{i:02d}" for i in range(1, 16)]
    priorities = ["high", "medium", "low"]

    note_templates = [
        {
            "context": lambda a: {"athlete_id": a, "acwr": round(random.uniform(1.4, 1.8), 2), "days_high": random.randint(2, 5), "request": "Genera nota operativa per gestione carico"},
            "note_fn": lambda d: f"Ridurre carico per {d['athlete_id']} (ACWR {d['acwr']}, elevato da {d['days_high']} gg). Sessione domani a RPE target ≤ 5. Monitorare wellness.",
            "priority": "high",
            "action": "load_reduction",
        },
        {
            "context": lambda a: {"athlete_id": a, "minutes_week": random.randint(70, 90), "games_week": 3, "request": "Genera nota operativa per load management minuti"},
            "note_fn": lambda d: f"{d['athlete_id']} a {d['minutes_week']} min/settimana su {d['games_week']} partite. Ridurre minutaggio partita di domani a max 25 min. Priorità recupero.",
            "priority": "high",
            "action": "minutes_management",
        },
        {
            "context": lambda a: {"athlete_id": a, "sleep_avg": round(random.uniform(3.5, 4.5), 1), "nights": random.randint(2, 4), "request": "Genera nota operativa per problema sonno"},
            "note_fn": lambda d: f"{d['athlete_id']}: sonno {d['sleep_avg']}/10 per {d['nights']} notti consecutive. Verificare igiene del sonno. No sessioni ad alta intensità finché sleep > 5.",
            "priority": "medium",
            "action": "sleep_intervention",
        },
        {
            "context": lambda a: {"athlete_id": a, "rtp_week": random.randint(2, 6), "injury": random.choice(["distorsione caviglia dx", "lesione muscolare hamstring sx", "tendinopatia rotulea"]), "request": "Genera nota operativa per rientro da infortunio"},
            "note_fn": lambda d: f"{d['athlete_id']} in rientro da {d['injury']} (settimana {d['rtp_week']}). Incremento minutaggio graduale (+5 min/settimana). ACWR individuale monitorato. Screening funzionale prima di partita ufficiale.",
            "priority": "medium",
            "action": "return_to_play",
        },
    ]

    for _ in range(n):
        athlete = random.choice(athletes)
        template = random.choice(note_templates)
        ctx = template["context"](athlete)
        note_text = template["note_fn"](ctx)

        user_input = json.dumps(ctx, ensure_ascii=False)
        assistant_output = json.dumps({
            "type": "staff_note",
            "athlete_id": athlete,
            "priority": template["priority"],
            "action": template["action"],
            "note": note_text,
            "disclaimer": "Questo output è uno strumento di supporto. Non sostituisce il giudizio professionale dello staff tecnico-sanitario."
        }, ensure_ascii=False, indent=2)

        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": assistant_output},
            ]
        })
    return examples


def main():
    """Entry point: generazione completa del dataset SFT."""
    
    console.print(Panel.fit(
        "[bold blue]STEP 4 — Generazione Dataset SFT[/bold blue]\n"
        f"Output: {settings.sft_dir}\n"
        "Composizione: 40% report, 20% sintesi atleta, 15% alert, 15% squadra, 10% rifiuti",
        title="TrainMindAI Pipeline"
    ))
    
    # Genera esempi per categoria
    console.print("\n[bold]📝 Generazione esempi...[/bold]")
    
    all_examples = []
    
    generators = [
        ("Alert workload", generate_alert_examples, 55),
        ("Sintesi atleta", generate_athlete_summary_examples, 45),
        ("Report giornalieri", generate_daily_report_examples, 65),
        ("Sintesi squadra", generate_team_summary_examples, 35),
        ("Alert wellness", generate_wellness_alert_examples, 35),
        ("Q&A tecnici KB", generate_kb_qa_examples, 50),
        ("Note operative staff", generate_staff_note_examples, 30),
        ("Rifiuti strutturati", generate_refusal_examples, 25),
    ]

    for name, gen_fn, count in generators:
        console.print(f"   {name}...")
        items = gen_fn(count)
        all_examples.extend(items)
        console.print(f"   → {len(items)} esempi")
    
    console.print(f"\n   [bold]Totale: {len(all_examples)} esempi[/bold]")
    
    # Shuffle e split train/eval (80/20)
    random.shuffle(all_examples)
    split_idx = int(len(all_examples) * 0.8)
    train_examples = all_examples[:split_idx]
    eval_examples = all_examples[split_idx:]
    
    # Salva
    console.print("\n[bold]💾 Salvataggio dataset...[/bold]")
    settings.sft_dir.mkdir(parents=True, exist_ok=True)
    
    train_path = settings.sft_dir / "train.jsonl"
    eval_path = settings.sft_dir / "eval.jsonl"
    
    with open(train_path, "w", encoding="utf-8") as f:
        for example in train_examples:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")
    
    with open(eval_path, "w", encoding="utf-8") as f:
        for example in eval_examples:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")
    
    console.print(Panel.fit(
        f"[green]✅ Dataset SFT generato![/green]\n\n"
        f"Training: {len(train_examples)} esempi → {train_path}\n"
        f"Eval: {len(eval_examples)} esempi → {eval_path}\n\n"
        f"[yellow]⚠️  NOTA: Questi sono esempi sintetici.[/yellow]\n"
        f"Per la produzione, revisionare manualmente e aggiungere\n"
        f"esempi reali dal preparatore fisico.",
        title="Risultato"
    ))
    
    console.print("\n[dim]Prossimo step: python scripts/05_train_lora.py[/dim]")


if __name__ == "__main__":
    main()
