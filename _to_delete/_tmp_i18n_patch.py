# -*- coding: utf-8 -*-
"""Aggiunge le chiavi ft* della nuova pagina field-training ai 6 file messages."""
import io
import json
import os

KEYS = {
    'it': [
        ('ftBackToCalendar', 'Torna al calendario'),
        ('ftAvailableAthletes', 'Atleti disponibili'),
        ('ftOfInRoster', 'su {count} in rosa'),
        ('ftExercises', 'Esercizi'),
        ('ftAddExercise', 'Aggiungi esercizio'),
        ('ftNoExercises', 'Nessun esercizio. Aggiungine uno per iniziare.'),
        ('ftExerciseName', 'Nome esercizio'),
        ('ftExerciseDefaultName', 'Esercizio {n}'),
        ('ftRemoveExercise', 'Elimina esercizio'),
        ('ftActivity', 'Attività'),
        ('ftPlayersUsed', 'Giocatori impiegati'),
        ('ftCourts', 'Campi'),
        ('ftActivityTime', 'Tempi attività'),
        ('ftPauses', 'Pause'),
        ('ftNet', 'Netto'),
        ('ftEffective', 'Effettivo'),
        ('ftMetabolicIntensity', 'Intensità metabolica'),
        ('ftBreak', 'Break'),
        ('ftStopBreak', 'Ferma break'),
        ('ftWarmup', 'Warm up'),
        ('ftWarmupHint', "Escluso dal tempo totale giocato"),
        ('ftPause', 'Pausa'),
        ('ftStop', 'Stop'),
        ('ftTotals', 'Totali'),
        ('ftTotalTime', 'Tempo totale'),
        ('ftTotalPlayed', 'Tempo totale giocato'),
        ('ftTotalPauses', 'Pause totali'),
        ('ftTotalNet', 'Netto totale'),
        ('ftEffectivePerPlayer', 'Effettivo per giocatore'),
        ('ftDensity', 'Densità'),
    ],
    'en': [
        ('ftBackToCalendar', 'Back to calendar'),
        ('ftAvailableAthletes', 'Available athletes'),
        ('ftOfInRoster', 'of {count} in roster'),
        ('ftExercises', 'Exercises'),
        ('ftAddExercise', 'Add exercise'),
        ('ftNoExercises', 'No exercises yet. Add one to start.'),
        ('ftExerciseName', 'Exercise name'),
        ('ftExerciseDefaultName', 'Exercise {n}'),
        ('ftRemoveExercise', 'Delete exercise'),
        ('ftActivity', 'Activity'),
        ('ftPlayersUsed', 'Players used'),
        ('ftCourts', 'Courts'),
        ('ftActivityTime', 'Activity time'),
        ('ftPauses', 'Pauses'),
        ('ftNet', 'Net'),
        ('ftEffective', 'Effective'),
        ('ftMetabolicIntensity', 'Metabolic intensity'),
        ('ftBreak', 'Break'),
        ('ftStopBreak', 'Stop break'),
        ('ftWarmup', 'Warm up'),
        ('ftWarmupHint', 'Excluded from total played time'),
        ('ftPause', 'Pause'),
        ('ftStop', 'Stop'),
        ('ftTotals', 'Totals'),
        ('ftTotalTime', 'Total time'),
        ('ftTotalPlayed', 'Total played time'),
        ('ftTotalPauses', 'Total pauses'),
        ('ftTotalNet', 'Total net'),
        ('ftEffectivePerPlayer', 'Effective per player'),
        ('ftDensity', 'Density'),
    ],
    'es': [
        ('ftBackToCalendar', 'Volver al calendario'),
        ('ftAvailableAthletes', 'Atletas disponibles'),
        ('ftOfInRoster', 'de {count} en plantilla'),
        ('ftExercises', 'Ejercicios'),
        ('ftAddExercise', 'Añadir ejercicio'),
        ('ftNoExercises', 'Ningún ejercicio. Añade uno para empezar.'),
        ('ftExerciseName', 'Nombre del ejercicio'),
        ('ftExerciseDefaultName', 'Ejercicio {n}'),
        ('ftRemoveExercise', 'Eliminar ejercicio'),
        ('ftActivity', 'Actividad'),
        ('ftPlayersUsed', 'Jugadores implicados'),
        ('ftCourts', 'Campos'),
        ('ftActivityTime', 'Tiempo de actividad'),
        ('ftPauses', 'Pausas'),
        ('ftNet', 'Neto'),
        ('ftEffective', 'Efectivo'),
        ('ftMetabolicIntensity', 'Intensidad metabólica'),
        ('ftBreak', 'Break'),
        ('ftStopBreak', 'Parar break'),
        ('ftWarmup', 'Warm up'),
        ('ftWarmupHint', 'Excluido del tiempo total jugado'),
        ('ftPause', 'Pausa'),
        ('ftStop', 'Stop'),
        ('ftTotals', 'Totales'),
        ('ftTotalTime', 'Tiempo total'),
        ('ftTotalPlayed', 'Tiempo total jugado'),
        ('ftTotalPauses', 'Pausas totales'),
        ('ftTotalNet', 'Neto total'),
        ('ftEffectivePerPlayer', 'Efectivo por jugador'),
        ('ftDensity', 'Densidad'),
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
        data = json.loads(src)
        cal = data.get('calendar')
        if cal is None:
            print('SKIP (no calendar ns)', path)
            continue

        # anchor: insert right after the last existing ft* key line
        anchor = None
        for line in src.split(nl):
            if '"ftSessionCompletedMsg"' in line:
                anchor = line
                break
        if anchor is None:
            print('SKIP (no anchor)', path)
            continue

        added = []
        for k, v in pairs:
            if k in cal:
                continue
            added.append('    %s: %s,' % (json.dumps(k, ensure_ascii=False),
                                          json.dumps(v, ensure_ascii=False)))
        if not added:
            print('OK (already patched)', path)
            continue

        block = anchor + nl + nl.join(added)
        out = src.replace(anchor, block, 1)
        json.loads(out)  # validate
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('patched %-2s %s (+%d)' % (loc, path, len(added)))
