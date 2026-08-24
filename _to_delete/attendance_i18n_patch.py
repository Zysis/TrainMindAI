# -*- coding: utf-8 -*-
"""Chiavi i18n del foglio presenze (RPE, carico) e della scheda Presenze."""
import io, json, os, collections

FILES = [
    'trainmind-app/apps/web/src/messages/%s.json',
    'trainmind-mobile/web/src/messages/%s.json',
]

CALENDAR = {
    'it': {
        'ftAttendance': 'Foglio presenze',
        'ftAttendanceSheet': 'Foglio presenze',
        'attendanceShort': 'Presenze',
        'attendanceSheet': 'Foglio presenze',
        'ftDurationMinutes': 'Durata effettiva (min)',
        'ftSessionRpe': 'RPE di sessione (1-10)',
        'ftLoadFormula': 'Carico = RPE x durata effettiva. L’RPE di sessione vale per i giocatori che non hanno un RPE proprio.',
        'ftRpe': 'RPE',
        'ftLoad': 'Carico',
        'ftTotalLoad': 'Carico totale',
        'ftAvgLoad': 'Carico medio',
        'ftAvgRpe': 'RPE medio',
        'ftPresentCount': 'Presenti',
        'ftSkippedNoRpe': '{count} giocatori senza RPE o senza durata: presenza registrata, carico non calcolato.',
    },
    'en': {
        'ftAttendance': 'Attendance sheet',
        'ftAttendanceSheet': 'Attendance sheet',
        'attendanceShort': 'Attendance',
        'attendanceSheet': 'Attendance sheet',
        'ftDurationMinutes': 'Actual duration (min)',
        'ftSessionRpe': 'Session RPE (1-10)',
        'ftLoadFormula': 'Load = RPE x actual duration. The session RPE applies to players without their own RPE.',
        'ftRpe': 'RPE',
        'ftLoad': 'Load',
        'ftTotalLoad': 'Total load',
        'ftAvgLoad': 'Average load',
        'ftAvgRpe': 'Average RPE',
        'ftPresentCount': 'Present',
        'ftSkippedNoRpe': '{count} players without RPE or duration: attendance saved, load not computed.',
    },
    'es': {
        'ftAttendance': 'Hoja de asistencia',
        'ftAttendanceSheet': 'Hoja de asistencia',
        'attendanceShort': 'Asistencia',
        'attendanceSheet': 'Hoja de asistencia',
        'ftDurationMinutes': 'Duración real (min)',
        'ftSessionRpe': 'RPE de sesión (1-10)',
        'ftLoadFormula': 'Carga = RPE x duración real. El RPE de sesión se aplica a los jugadores sin RPE propio.',
        'ftRpe': 'RPE',
        'ftLoad': 'Carga',
        'ftTotalLoad': 'Carga total',
        'ftAvgLoad': 'Carga media',
        'ftAvgRpe': 'RPE medio',
        'ftPresentCount': 'Presentes',
        'ftSkippedNoRpe': '{count} jugadores sin RPE o sin duración: asistencia guardada, carga no calculada.',
    },
}

ANALYTICS = {
    'it': {
        'tabAttendance': 'Presenze',
        'attTitle': 'Presenze per atleta',
        'attSubtitle': 'Percentuale di allenamenti a cui l’atleta ha partecipato, con RPE medio e carico accumulato.',
        'attAthlete': 'Atleta',
        'attTrainings': 'Allenamenti',
        'attPresent': 'Presenti',
        'attUnavailable': 'Indisponibile',
        'attAbsent': 'Assente',
        'attRate': '% presenze',
        'attAvgRpe': 'RPE medio',
        'attTotalLoad': 'Carico totale',
        'attByType': 'Per tipologia di allenamento',
        'attNoData': 'Nessun foglio presenze nel periodo selezionato.',
        'attHint': 'Il totale considera solo gli allenamenti in cui l’atleta risultava in rosa.',
        'attTypeGym': 'Sala pesi',
        'attTypeBasket': 'Basket',
        'attTypeIndividual': 'Individuale',
        'attTypeShooting': 'Tiro',
        'attTypeRehab': 'Rehab',
        'attTypeSession': 'Programmazione',
        'attTypeOther': 'Altro',
    },
    'en': {
        'tabAttendance': 'Attendance',
        'attTitle': 'Attendance by athlete',
        'attSubtitle': 'Share of trainings the athlete took part in, with average RPE and accumulated load.',
        'attAthlete': 'Athlete',
        'attTrainings': 'Trainings',
        'attPresent': 'Present',
        'attUnavailable': 'Unavailable',
        'attAbsent': 'Absent',
        'attRate': 'Attendance %',
        'attAvgRpe': 'Average RPE',
        'attTotalLoad': 'Total load',
        'attByType': 'By training type',
        'attNoData': 'No attendance sheet in the selected period.',
        'attHint': 'The total only counts trainings where the athlete was on the roster.',
        'attTypeGym': 'Gym',
        'attTypeBasket': 'Basketball',
        'attTypeIndividual': 'Individual',
        'attTypeShooting': 'Shooting',
        'attTypeRehab': 'Rehab',
        'attTypeSession': 'Plan',
        'attTypeOther': 'Other',
    },
    'es': {
        'tabAttendance': 'Asistencia',
        'attTitle': 'Asistencia por atleta',
        'attSubtitle': 'Porcentaje de entrenamientos en los que participó el atleta, con RPE medio y carga acumulada.',
        'attAthlete': 'Atleta',
        'attTrainings': 'Entrenamientos',
        'attPresent': 'Presente',
        'attUnavailable': 'No disponible',
        'attAbsent': 'Ausente',
        'attRate': '% asistencia',
        'attAvgRpe': 'RPE medio',
        'attTotalLoad': 'Carga total',
        'attByType': 'Por tipo de entrenamiento',
        'attNoData': 'Ninguna hoja de asistencia en el periodo seleccionado.',
        'attHint': 'El total solo cuenta los entrenamientos en los que el atleta estaba en plantilla.',
        'attTypeGym': 'Gimnasio',
        'attTypeBasket': 'Baloncesto',
        'attTypeIndividual': 'Individual',
        'attTypeShooting': 'Tiro',
        'attTypeRehab': 'Rehab',
        'attTypeSession': 'Planificación',
        'attTypeOther': 'Otro',
    },
}


def apply(path, lang):
    d = json.load(io.open(path, encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
    added = 0
    for ns, table in (('calendar', CALENDAR), ('analytics', ANALYTICS)):
        if ns not in d:
            d[ns] = collections.OrderedDict()
        for k, v in table[lang].items():
            if k not in d[ns]:
                d[ns][k] = v
                added += 1
    io.open(path, 'w', encoding='utf-8', newline='').write(
        json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print('  %s: +%d chiavi' % (path, added))


for tpl in FILES:
    for lang in ('it', 'en', 'es'):
        p = tpl % lang
        if os.path.exists(p):
            apply(p, lang)
        else:
            print('  skip (assente)', p)
