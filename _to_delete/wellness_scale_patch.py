# -*- coding: utf-8 -*-
"""Scala wellness: 5 è sempre il valore migliore, su tutte e cinque le voci.

Prima Fatica/Dolore/Stress andavano da 1 (nessuno) a 5 (estremo): il punteggio
composito li ribaltava con (6 - x) e i badge coloravano l'alto di rosso.
Ora l'atleta risponde su una scala dove 5 è sempre la condizione migliore.
"""
import io
import json
import os


def edit(path, pairs, label=None):
    raw = io.open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw
    for old, new in pairs:
        assert s.count(old) == 1, '%s: ancora non unica → %s' % (path, (label or old)[:70])
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched', path)


API = 'trainmind-app/apps/api/src/'

# ── 1. punteggio composito: somma diretta, niente più (6 - x) ────────────
SCORE_FILES = {
    'routes/adaptations.ts': [
        ("((log.sleepQuality + log.mood + (6 - log.fatigue) + (6 - log.soreness) + (6 - log.stress)) / 25) * 100",
         "((log.sleepQuality + log.mood + log.fatigue + log.soreness + log.stress) / 25) * 100")],
    'routes/reports.ts': [
        ("log.sleepQuality + log.mood + (6 - log.fatigue) + (6 - log.soreness) + (6 - log.stress);",
         "log.sleepQuality + log.mood + log.fatigue + log.soreness + log.stress;")],
    'routes/notifications.ts': [
        ("((latest.sleepQuality + latest.mood + (6 - latest.fatigue) + (6 - latest.soreness) + (6 - latest.stress)) / 25) * 100",
         "((latest.sleepQuality + latest.mood + latest.fatigue + latest.soreness + latest.stress) / 25) * 100")],
}
for rel, pairs in SCORE_FILES.items():
    edit(API + rel, pairs, 'punteggio composito')

# analytics.ts ne ha due, su righe diverse
p = API + 'routes/analytics.ts'
s = io.open(p, encoding='utf-8').read()
a1 = "((log.sleepQuality + log.mood + (6 - log.fatigue) + (6 - log.soreness) + (6 - log.stress)) / 25) * 100"
a2 = "((w.sleepQuality + w.mood + (6 - w.fatigue) + (6 - w.soreness) + (6 - w.stress)) / 25) * 100"
assert s.count(a1) == 1 and s.count(a2) == 1, 'formule analytics'
s = s.replace(a1, "((log.sleepQuality + log.mood + log.fatigue + log.soreness + log.stress) / 25) * 100")
s = s.replace(a2, "((w.sleepQuality + w.mood + w.fatigue + w.soreness + w.stress) / 25) * 100")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  patched', p)

# ── 2. atleti a rischio: ora il rischio sta in BASSO ─────────────────────
edit(API + 'routes/dashboard.ts', [
    ("""    // Athletes at risk: high fatigue or soreness in latest log""",
     """    // Atleti a rischio: su tutte le voci 5 è il valore migliore,
    // quindi il campanello d'allarme è un valore BASSO."""),
    ("      (w) => w.fatigue >= 4 || w.soreness >= 4 || w.mood <= 2",
     "      (w) => w.fatigue <= 2 || w.soreness <= 2 || w.mood <= 2"),
], 'soglia atleti a rischio')

# ── 3. prompt AI: campo inesistente, scala sbagliata, senso non spiegato ─
edit(API + 'routes/ai.ts', [
    ("return `${name} (${(log.date as Date).toISOString().slice(0, 10)}): Sonno=${log.sleep}/10, Fatica=${log.fatigue}/10, Dolore=${log.soreness}/10, Stress=${log.stress}/10, Umore=${log.mood}/10`;",
     "return `${name} (${(log.date as Date).toISOString().slice(0, 10)}): Sonno=${log.sleepQuality}/5, Fatica=${log.fatigue}/5, Dolore=${log.soreness}/5, Stress=${log.stress}/5, Umore=${log.mood}/5`;"),
], 'riepilogo per il coach AI')

# la scala va spiegata all'AI, altrimenti interpreta 1 come "poca fatica"
edit(API + 'routes/ai.ts', [
    ("""      const question = athlete_id
        ? `Analizza i dati wellness di questo atleta degli ultimi ${days} giorni e fornisci raccomandazioni:\\n\\n${summary}`
        : `Analizza i dati wellness del team degli ultimi ${days} giorni. Identifica atleti a rischio e fornisci raccomandazioni:\\n\\n${summary}`;""",
     """      // Su tutte e cinque le voci 5 è la condizione migliore e 1 la peggiore:
      // senza dirlo, il modello legge "Fatica=1" come poca fatica.
      const scaleNote =
        'Scala 1-5 su tutte le voci, dove 5 è sempre la condizione migliore e 1 la peggiore ' +
        '(Fatica 1 = molto affaticato, 5 = per niente affaticato; stessa logica per Dolore e Stress).';
      const question = athlete_id
        ? `Analizza i dati wellness di questo atleta degli ultimi ${days} giorni e fornisci raccomandazioni. ${scaleNote}\\n\\n${summary}`
        : `Analizza i dati wellness del team degli ultimi ${days} giorni. Identifica atleti a rischio e fornisci raccomandazioni. ${scaleNote}\\n\\n${summary}`;"""),
], 'nota di scala per l AI')

# ── 4. badge nella dashboard web (entrambe le app) ──────────────────────
for base in ['trainmind-app/apps/web/src', 'trainmind-mobile/web/src']:
    edit(os.path.join(base, 'app/dashboard/page.tsx'), [
        ("{a.fatigue >= 4 && <Badge variant=\"danger\">{t('fatShort')}: {a.fatigue}</Badge>}",
         "{a.fatigue <= 2 && <Badge variant=\"danger\">{t('fatShort')}: {a.fatigue}</Badge>}"),
        ("{a.soreness >= 4 && <Badge variant=\"danger\">{t('sorShort')}: {a.soreness}</Badge>}",
         "{a.soreness <= 2 && <Badge variant=\"danger\">{t('sorShort')}: {a.soreness}</Badge>}"),
        ("<Badge variant={w.fatigue >= 4 ? 'danger' : w.fatigue >= 3 ? 'warning' : 'success'}>{w.fatigue}/5</Badge>",
         "<Badge variant={w.fatigue <= 2 ? 'danger' : w.fatigue <= 3 ? 'warning' : 'success'}>{w.fatigue}/5</Badge>"),
        ("<Badge variant={w.soreness >= 4 ? 'danger' : w.soreness >= 3 ? 'warning' : 'success'}>{w.soreness}/5</Badge>",
         "<Badge variant={w.soreness <= 2 ? 'danger' : w.soreness <= 3 ? 'warning' : 'success'}>{w.soreness}/5</Badge>"),
    ], 'badge dashboard')

# ── 5. app atleta: estremi della scala invertiti ────────────────────────
p = 'trainmind-athlete/src/app/(app)/wellness/page.tsx'
raw = io.open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n') if crlf else raw
for old, new in [
    ("{ key: 'fatigue', label: 'Fatica', icon: Activity, low: 'Riposato', high: 'Esausto' },",
     "{ key: 'fatigue', label: 'Fatica', icon: Activity, low: 'Esausto', high: 'Riposato' },"),
    ("{ key: 'soreness', label: 'Dolori muscolari', icon: Frown, low: 'Nessuno', high: 'Molto forte' },",
     "{ key: 'soreness', label: 'Dolori muscolari', icon: Frown, low: 'Molto forte', high: 'Nessuno' },"),
    ("{ key: 'stress', label: 'Stress', icon: Brain, low: 'Rilassato', high: 'Molto stressato' },",
     "{ key: 'stress', label: 'Stress', icon: Brain, low: 'Molto stressato', high: 'Rilassato' },"),
]:
    assert s.count(old) == 1, 'app atleta: %s' % old[:50]
    s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('  patched', p)

# ── 6. etichette: i tre array vanno letti al contrario ─────────────────
NEW_DESC = {
    'it': {'fatigueDesc': 'Quanto ti senti fresco: 1 = molto affaticato, 5 = per niente',
           'sorenessDesc': 'DOMS o dolore muscolare: 1 = molto forte, 5 = assente',
           'stressDesc': 'Livello di stress: 1 = molto alto, 5 = assente'},
    'en': {'fatigueDesc': 'How fresh you feel: 1 = very tired, 5 = not at all',
           'sorenessDesc': 'DOMS or muscle pain: 1 = very strong, 5 = none',
           'stressDesc': 'Stress level: 1 = very high, 5 = none'},
    'es': {'fatigueDesc': 'Lo fresco que te sientes: 1 = muy cansado, 5 = nada',
           'sorenessDesc': 'DOMS o dolor muscular: 1 = muy fuerte, 5 = ninguno',
           'stressDesc': 'Nivel de estrés: 1 = muy alto, 5 = ninguno'},
}
NEW_LEGEND = {
    'it': 'Su tutte le voci 5 è il valore migliore: rosso significa condizione critica, verde condizione buona. Passa il mouse sul nome di una colonna per vedere la sua scala.',
    'en': 'On every item 5 is the best value: red means a critical condition, green a good one. Hover a column name to see its scale.',
    'es': 'En todas las voces 5 es el mejor valor: rojo indica una condición crítica, verde una buena. Pasa el ratón por el nombre de una columna para ver su escala.',
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc in ['it', 'en', 'es']:
        path = os.path.join(d, loc + '.json')
        data = json.load(io.open(path, encoding='utf-8'))
        w = data['wellness']
        changed = []
        for key in ['fatigueLabels', 'sorenessLabels', 'stressLabels']:
            if isinstance(w.get(key), list) and len(w[key]) == 5:
                w[key] = list(reversed(w[key]))
                changed.append(key)
        for k, v in NEW_DESC[loc].items():
            if k in w:
                w[k] = v
                changed.append(k)
        if 'legendNote' in w:
            w['legendNote'] = NEW_LEGEND[loc]
            changed.append('legendNote')
        io.open(path, 'w', encoding='utf-8', newline='').write(
            json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print('  patched %-2s %s (%s)' % (loc, path, ', '.join(changed)))

print('fatto')
