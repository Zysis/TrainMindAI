# -*- coding: utf-8 -*-
"""Chiavi analytics per i filtri condivisi della scheda Analisi."""
import io
import json
import os

KEYS = {
    'it': [
        ('filterTeam', 'Squadra'),
        ('allTeams', 'Tutte le squadre'),
        ('dateFrom', 'Dal'),
        ('dateTo', 'Al'),
        ('resetFilters', 'Azzera filtri'),
        ('notApplicable', 'non applicabile qui'),
        ('teamTabNote', 'La scheda Squadra è una fotografia dello stato attuale: usa sempre gli ultimi 7 giorni di wellness e gli ultimi 21 di carichi, perché è così che si calcola l’ACWR. Filtro atleta e intervallo di date valgono sulle altre schede.'),
    ],
    'en': [
        ('filterTeam', 'Team'),
        ('allTeams', 'All teams'),
        ('dateFrom', 'From'),
        ('dateTo', 'To'),
        ('resetFilters', 'Reset filters'),
        ('notApplicable', 'not applicable here'),
        ('teamTabNote', 'The Team tab is a snapshot of the current state: it always uses the last 7 days of wellness and the last 21 days of load, because that is how ACWR is computed. The athlete filter and date range apply to the other tabs.'),
    ],
    'es': [
        ('filterTeam', 'Equipo'),
        ('allTeams', 'Todos los equipos'),
        ('dateFrom', 'Desde'),
        ('dateTo', 'Hasta'),
        ('resetFilters', 'Restablecer filtros'),
        ('notApplicable', 'no aplicable aquí'),
        ('teamTabNote', 'La pestaña Equipo es una foto del estado actual: usa siempre los últimos 7 días de wellness y los últimos 21 de carga, porque así se calcula el ACWR. El filtro de atleta y el rango de fechas se aplican a las demás pestañas.'),
    ],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        data = json.loads(src)
        ns = data.get('analytics')
        if ns is None:
            print('SKIP (no analytics ns)', path)
            continue

        # àncora: la riga di "tabTeam" dentro il namespace analytics
        anchor = None
        for line in src.split(nl):
            if '"tabTeam"' in line:
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
        json.loads(out)
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('patched %-2s %s (+%d)' % (loc, path, len(added)))
