# -*- coding: utf-8 -*-
"""Il flag detailedByAttendance va SELEZIONATO, altrimenti la guardia non scatta."""
import io

TARGETS = [
    ('trainmind-app/apps/api/src/routes/analytics.ts', [
        ("""        date: true,
        duration: true,
        rpe: true,
        athleteId: true,
        athlete: { select: { id: true, firstName: true, lastName: true } },""",
         """        date: true,
        duration: true,
        rpe: true,
        detailedByAttendance: true,
        athleteId: true,
        athlete: { select: { id: true, firstName: true, lastName: true } },"""),
        ("""        date: true,
        duration: true,
        rpe: true,
        week: {
          select: {""",
         """        date: true,
        duration: true,
        rpe: true,
        detailedByAttendance: true,
        week: {
          select: {"""),
    ]),
    ('trainmind-app/apps/api/src/routes/reports.ts', [
        ("""      rpe: true,
      duration: true,
      week: { select: { trainingPlan: { select: { teamId: true } } } },
    },
  });""",
         """      rpe: true,
      duration: true,
      detailedByAttendance: true,
      week: { select: { trainingPlan: { select: { teamId: true } } } },
    },
  });"""),
        ("select: { status: true, athleteId: true, duration: true, rpe: true, week: { select: { trainingPlan: { select: { teamId: true } } } } },",
         "select: { status: true, athleteId: true, duration: true, rpe: true, detailedByAttendance: true, week: { select: { trainingPlan: { select: { teamId: true } } } } },"),
    ]),
]

for path, pairs in TARGETS:
    s = io.open(path, encoding='utf-8').read()
    n = 0
    for old, new in pairs:
        c = s.count(old)
        assert c <= 1, '%s: ancora ambigua (%d occorrenze)' % (path, c)
        if c == 1:
            s = s.replace(old, new)
            n += 1
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('  patched %s (%d select)' % (path, n))

# controllo finale: ogni guardia deve avere il campo nella sua select
for path, _ in TARGETS:
    s = io.open(path, encoding='utf-8').read()
    print('  %s → guardie: %d, select: %d' % (
        path.rsplit('/', 1)[-1],
        s.count('!s.detailedByAttendance'),
        s.count('detailedByAttendance: true')))
