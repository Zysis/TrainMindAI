# -*- coding: utf-8 -*-
"""Chiavi wellness per filtri e legenda colori di Log recenti."""
import io
import json
import os

KEYS = {
    'it': [
        ('selectionAverage', 'Media selezione'),
        ('logsCount', '{count} log'),
        ('filterTeam', 'Squadra'),
        ('filterAthlete', 'Atleta'),
        ('allTeams', 'Tutte le squadre'),
        ('allAthletes', 'Tutti gli atleti'),
        ('dateFrom', 'Dal'),
        ('dateTo', 'Al'),
        ('resetFilters', 'Azzera filtri'),
        ('legendTitle', 'Legenda'),
        ('legendLow', 'valore basso'),
        ('legendMid', 'valore medio'),
        ('legendHigh', 'valore alto'),
        ('legendNote', 'Il colore segue il numero, non il suo significato: su Fatica, Dolore e Stress un 5 indica il livello massimo.'),
    ],
    'en': [
        ('selectionAverage', 'Selection average'),
        ('logsCount', '{count} logs'),
        ('filterTeam', 'Team'),
        ('filterAthlete', 'Athlete'),
        ('allTeams', 'All teams'),
        ('allAthletes', 'All athletes'),
        ('dateFrom', 'From'),
        ('dateTo', 'To'),
        ('resetFilters', 'Reset filters'),
        ('legendTitle', 'Legend'),
        ('legendLow', 'low value'),
        ('legendMid', 'medium value'),
        ('legendHigh', 'high value'),
        ('legendNote', 'Colours follow the number, not its meaning: for Fatigue, Soreness and Stress a 5 means the highest level.'),
    ],
    'es': [
        ('selectionAverage', 'Media de la selección'),
        ('logsCount', '{count} registros'),
        ('filterTeam', 'Equipo'),
        ('filterAthlete', 'Atleta'),
        ('allTeams', 'Todos los equipos'),
        ('allAthletes', 'Todos los atletas'),
        ('dateFrom', 'Desde'),
        ('dateTo', 'Hasta'),
        ('resetFilters', 'Restablecer filtros'),
        ('legendTitle', 'Leyenda'),
        ('legendLow', 'valor bajo'),
        ('legendMid', 'valor medio'),
        ('legendHigh', 'valor alto'),
        ('legendNote', 'El color sigue el número, no su significado: en Fatiga, Dolor y Estrés un 5 indica el nivel máximo.'),
    ],
}

DIRS = [
    'trainmind-app/apps/web/src/messages',
    'trainmind-mobile/web/src/messages',
]

for d in DIRS:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        if not os.path.exists(path):
            print('SKIP (missing)', path)
            continue
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('wellness')
        if ns is None:
            print('SKIP (no wellness ns)', path)
            continue

        anchor = None
        for line in src.split(nl):
            if '"recentLogs"' in line:
                anchor = line
                break
        if anchor is None:
            print('SKIP (no anchor)', path)
            continue

        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in ns]
        if not added:
            print('OK (already patched)', path)
            continue

        out = src.replace(anchor, anchor + nl + nl.join(added), 1)
        json.loads(out)  # validate
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('patched %-2s %s (+%d)' % (loc, path, len(added)))
