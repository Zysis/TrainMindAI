# -*- coding: utf-8 -*-
"""Chiavi ft* per la lista giocatori col semaforo."""
import io
import json
import os

KEYS = {
    'it': [
        ('ftPlayers', 'Giocatori'),
        ('ftAddPlayer', 'Aggiungi giocatore'),
        ('ftNoPlayers', 'Nessun giocatore in questa sessione'),
        ('ftGuest', 'Ospite'),
        ('ftGuestName', 'Nome giocatore'),
        ('ftRemovePlayer', 'Rimuovi giocatore'),
        ('ftPresent', 'Presente'),
        ('ftUnavailable', 'Indisponibile'),
        ('ftAbsent', 'Assente'),
        ('ftNotePlaceholder', 'Motivo (facoltativo)'),
    ],
    'en': [
        ('ftPlayers', 'Players'),
        ('ftAddPlayer', 'Add player'),
        ('ftNoPlayers', 'No players in this session'),
        ('ftGuest', 'Guest'),
        ('ftGuestName', 'Player name'),
        ('ftRemovePlayer', 'Remove player'),
        ('ftPresent', 'Present'),
        ('ftUnavailable', 'Unavailable'),
        ('ftAbsent', 'Absent'),
        ('ftNotePlaceholder', 'Reason (optional)'),
    ],
    'es': [
        ('ftPlayers', 'Jugadores'),
        ('ftAddPlayer', 'Añadir jugador'),
        ('ftNoPlayers', 'Ningún jugador en esta sesión'),
        ('ftGuest', 'Invitado'),
        ('ftGuestName', 'Nombre del jugador'),
        ('ftRemovePlayer', 'Quitar jugador'),
        ('ftPresent', 'Presente'),
        ('ftUnavailable', 'No disponible'),
        ('ftAbsent', 'Ausente'),
        ('ftNotePlaceholder', 'Motivo (opcional)'),
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
        cal = json.loads(src).get('calendar')
        if cal is None:
            print('SKIP (no calendar ns)', path)
            continue

        anchor = None
        for line in src.split(nl):
            if '"ftSessionCompletedMsg"' in line:
                anchor = line
                break
        if anchor is None:
            print('SKIP (no anchor)', path)
            continue

        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in cal]
        if not added:
            print('OK (already patched)', path)
            continue

        out = src.replace(anchor, anchor + nl + nl.join(added), 1)
        json.loads(out)  # validate
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('patched %-2s %s (+%d)' % (loc, path, len(added)))
