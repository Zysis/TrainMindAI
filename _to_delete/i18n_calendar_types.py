# -*- coding: utf-8 -*-
"""Etichette dei nuovi tipi evento e testi del blocco Rehab."""
import io
import json
import os

KEYS = {
    'it': [
        ('typeGym', 'Allenamento in sala pesi'),
        ('typeBasket', 'Allenamenti Basket'),
        ('typeIndividual', 'Allenamento Individuale'),
        ('typeShooting', 'Sessione di tiro'),
        ('typeMatch', 'Partita'),
        ('typeRehab', 'Rehab'),
        ('typeMeeting', 'Riunione'),
        ('typeMedical', 'Medico'),
        ('typeOther', 'Altro'),
        ('typeSession', 'Sessione pianificata'),
        ('exercisesShort', 'Esercizi'),
        ('fieldSession', 'Presenze ed esercizi'),
        ('injuredAthlete', 'Atleta in riabilitazione'),
        ('noAthlete', 'Nessun atleta'),
        ('noActiveRtp', 'Nessun protocollo Return To Play attivo'),
        ('rtpProtocol', 'Protocollo Return To Play'),
        ('rtpCleared', 'Percorso completato'),
        ('openInjuryCard', 'Apri la scheda infortuni'),
    ],
    'en': [
        ('typeGym', 'Weight room session'),
        ('typeBasket', 'Basketball practice'),
        ('typeIndividual', 'Individual session'),
        ('typeShooting', 'Shooting session'),
        ('typeMatch', 'Game'),
        ('typeRehab', 'Rehab'),
        ('typeMeeting', 'Meeting'),
        ('typeMedical', 'Medical'),
        ('typeOther', 'Other'),
        ('typeSession', 'Planned session'),
        ('exercisesShort', 'Drills'),
        ('fieldSession', 'Attendance and drills'),
        ('injuredAthlete', 'Athlete in rehab'),
        ('noAthlete', 'No athlete'),
        ('noActiveRtp', 'No active Return To Play protocol'),
        ('rtpProtocol', 'Return To Play protocol'),
        ('rtpCleared', 'Protocol completed'),
        ('openInjuryCard', 'Open injury record'),
    ],
    'es': [
        ('typeGym', 'Entrenamiento en sala de pesas'),
        ('typeBasket', 'Entrenamiento de baloncesto'),
        ('typeIndividual', 'Entrenamiento individual'),
        ('typeShooting', 'Sesión de tiro'),
        ('typeMatch', 'Partido'),
        ('typeRehab', 'Rehab'),
        ('typeMeeting', 'Reunión'),
        ('typeMedical', 'Médico'),
        ('typeOther', 'Otro'),
        ('typeSession', 'Sesión planificada'),
        ('exercisesShort', 'Ejercicios'),
        ('fieldSession', 'Asistencia y ejercicios'),
        ('injuredAthlete', 'Atleta en rehabilitación'),
        ('noAthlete', 'Ningún atleta'),
        ('noActiveRtp', 'Ningún protocolo Return To Play activo'),
        ('rtpProtocol', 'Protocolo Return To Play'),
        ('rtpCleared', 'Protocolo completado'),
        ('openInjuryCard', 'Abrir la ficha de lesiones'),
    ],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('calendar')
        if ns is None:
            print('SKIP (no calendar ns)', path)
            continue

        anchor = None
        for line in src.split(nl):
            if '"fieldTraining"' in line:
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
