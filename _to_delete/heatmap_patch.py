# -*- coding: utf-8 -*-
"""Heatmap wellness: il filtro atleta veniva sovrascritto da quello squadra,
e il punteggio non era spiegato da nessuna parte."""
import io
import json
import os

# ── 1. API: teamId non deve annullare athleteId ─────────────────────────
p = 'trainmind-app/apps/api/src/routes/analytics.ts'
s = io.open(p, encoding='utf-8').read()
old = """    if (query.athleteId) where.athleteId = query.athleteId;
    if (query.teamId) {
      // Resolve team athlete IDs for reliable filtering
      const teamAthletes = await app.prisma.athleteTeam.findMany({
        where: { teamId: query.teamId },
        select: { athleteId: true },
      });
      where.athleteId = { in: teamAthletes.map((ta) => ta.athleteId) };
    }"""
new = """    // L'atleta è più specifico della squadra: se c'è, vince lui. Con due `if`
    // separati il filtro squadra sovrascriveva quello atleta e la heatmap
    // mostrava tutta la rosa anche selezionando un singolo giocatore.
    if (query.athleteId) {
      where.athleteId = query.athleteId;
    } else if (query.teamId) {
      // Resolve team athlete IDs for reliable filtering
      const teamAthletes = await app.prisma.athleteTeam.findMany({
        where: { teamId: query.teamId },
        select: { athleteId: true },
      });
      where.athleteId = { in: teamAthletes.map((ta) => ta.athleteId) };
    }"""
assert s.count(old) == 1, 'filtro heatmap'
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('  patched', p)

# ── 2. componente: spiegazione del calcolo ──────────────────────────────
for base in ['trainmind-app/apps/web/src', 'trainmind-mobile/web/src']:
    p = os.path.join(base, 'components/analytics/wellness-heatmap.tsx')
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw

    def sub(old, new, label):
        global s
        assert s.count(old) == 1, '%s: %s (%d occorrenze)' % (p, label, s.count(old))
        s = s.replace(old, new)

    sub("""      <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('heatmapTitle')}</h3>""",
        """      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('heatmapTitle')}</h3>
      <p className="mb-4 mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('heatmapFormula')}</p>""",
        'sottotitolo formula')

    # il tooltip mostra anche il conto, non solo il risultato
    sub("""                    title={`${athleteName} - ${formatDate(date)}\\n${tWellness('score')}: ${entry.wellnessScore}%\\n${tWellness('sleepLabel')}: ${entry.sleepQuality}/5\\n${tWellness('fatigueLabel')}: ${entry.fatigue}/5\\n${tWellness('sorenessLabel')}: ${entry.soreness}/5\\n${tWellness('stressLabel')}: ${entry.stress}/5\\n${tWellness('moodLabel')}: ${entry.mood}/5`}""",
        """                    title={`${athleteName} - ${formatDate(date)}\\n${tWellness('sleepLabel')}: ${entry.sleepQuality}/5\\n${tWellness('fatigueLabel')}: ${entry.fatigue}/5\\n${tWellness('sorenessLabel')}: ${entry.soreness}/5\\n${tWellness('stressLabel')}: ${entry.stress}/5\\n${tWellness('moodLabel')}: ${entry.mood}/5\\n———\\n${tWellness('score')}: (${entry.sleepQuality}+${entry.fatigue}+${entry.soreness}+${entry.stress}+${entry.mood}) / 25 × 100 = ${entry.wellnessScore}%`}""",
        'tooltip col calcolo')

    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched', p)

# ── 3. testo della spiegazione ──────────────────────────────────────────
KEYS = {
    'it': [('heatmapFormula',
            'Punteggio = somma delle cinque voci del wellness (sonno, fatica, dolore, stress, umore), '
            'ognuna da 1 a 5 dove 5 è la condizione migliore, divisa per 25 e moltiplicata per 100. '
            'Va quindi da 20% (tutte le voci a 1) a 100% (tutte a 5). Passa il mouse su una cella per vedere il conto.')],
    'en': [('heatmapFormula',
            'Score = the five wellness items (sleep, fatigue, soreness, stress, mood) added up, each from 1 to 5 '
            'where 5 is the best condition, divided by 25 and multiplied by 100. '
            'It therefore ranges from 20% (all items at 1) to 100% (all at 5). Hover a cell to see the arithmetic.')],
    'es': [('heatmapFormula',
            'Puntuación = suma de las cinco voces del wellness (sueño, fatiga, dolor, estrés, ánimo), '
            'cada una de 1 a 5 donde 5 es la mejor condición, dividida por 25 y multiplicada por 100. '
            'Va por tanto del 20% (todas a 1) al 100% (todas a 5). Pasa el ratón por una celda para ver el cálculo.')],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('analyticsExt')
        anchor = next((l for l in src.split(nl) if '"heatmapTitle"' in l), None)
        if ns is None or anchor is None:
            print('  SKIP (namespace o ancora assenti)', path)
            continue
        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in ns]
        if not added:
            print('  OK (already patched)', path)
            continue
        out = src.replace(anchor, anchor + nl + nl.join(added), 1)
        json.loads(out)
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('  patched %-2s %s (+%d)' % (loc, path, len(added)))

print('fatto')
