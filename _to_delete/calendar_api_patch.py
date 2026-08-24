# -*- coding: utf-8 -*-
"""API calendario: nuovi tipi, tipo dedicato per le sessioni dei piani, atleta negli eventi."""
import io
import os

p = 'trainmind-app/apps/api/src/routes/notifications.ts'
s = io.open(p, encoding='utf-8').read()


def sub(old, new, label):
    global s
    assert s.count(old) == 1, 'ancora "%s" non trovata (o non unica)' % label
    s = s.replace(old, new)


# 1. enum dei tipi in creazione
sub("      type: z.enum(['training', 'field_training', 'match', 'medical', 'meeting', 'other']).default('other'),",
    "      type: z.enum(['gym', 'basket', 'individual', 'shooting', 'match', 'rehab', 'meeting', 'medical', 'other']).default('other'),",
    'enum tipi')

# 2. le sessioni dei piani hanno un tipo proprio, non più 'training'
sub("""      allDay: false,
      type: 'training',
      color: s.status === 'COMPLETED' ? '#22c55e' : s.status === 'IN_PROGRESS' ? '#0d9488' : '#3b82f6',""",
    """      allDay: false,
      // Tipo dedicato: le sessioni dei piani non sono eventi creati a mano e
      // non devono ereditare l'etichetta di una delle categorie scelte dall'utente.
      type: 'session',
      color: s.status === 'COMPLETED' ? '#22c55e' : s.status === 'IN_PROGRESS' ? '#0d9488' : '#3b82f6',""",
    'tipo sessioni')

# 3. l'evento restituisce anche l'atleta collegato (serve al tipo Rehab)
sub("""    const rawEvents = await app.prisma.calendarEvent.findMany({
      where: calendarWhere,
      orderBy: { startTime: 'asc' },
      include: { team: { select: { id: true, name: true, color: true } } },
    });

    const events = rawEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.startTime,
      endTime: e.endTime,
      allDay: e.allDay,
      type: e.type,
      color: e.color,
      teamId: e.team?.id ?? null,
      teamName: e.team?.name ?? null,
      teamColor: e.team?.color ?? null,
    }));""",
    """    const rawEvents = await app.prisma.calendarEvent.findMany({
      where: calendarWhere,
      orderBy: { startTime: 'asc' },
      include: { team: { select: { id: true, name: true, color: true } } },
    });

    // `athleteId` non ha una relazione Prisma su CalendarEvent: i nomi si
    // risolvono con una query a parte, senza toccare lo schema.
    const eventAthleteIds = [...new Set(rawEvents.map((e) => e.athleteId).filter((x): x is string => Boolean(x)))];
    const athleteNameById = new Map<string, string>();
    if (eventAthleteIds.length > 0) {
      const eventAthletes = await app.prisma.athlete.findMany({
        where: { id: { in: eventAthleteIds }, organizationId: request.user.organizationId },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const a of eventAthletes) athleteNameById.set(a.id, `${a.lastName} ${a.firstName}`);
    }

    const events = rawEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.startTime,
      endTime: e.endTime,
      allDay: e.allDay,
      type: e.type,
      color: e.color,
      teamId: e.team?.id ?? null,
      teamName: e.team?.name ?? null,
      teamColor: e.team?.color ?? null,
      athleteId: e.athleteId ?? null,
      athleteName: e.athleteId ? athleteNameById.get(e.athleteId) ?? null : null,
    }));""",
    'atleta negli eventi')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched', p)

# ── Seed: allinea i tipi usati negli script di popolamento ──────────
for path, pairs in [
    ('trainmind-app/packages/db/prisma/seed.ts',
     [("type: 'training', daysFromNow: 1", "type: 'basket', daysFromNow: 1"),
      ("type: 'training', daysFromNow: 4", "type: 'gym', daysFromNow: 4"),
      ("{ title: 'Allenamento individuale Luca', type: 'training'",
       "{ title: 'Allenamento individuale Luca', type: 'individual'")]),
    ('trainmind-app/packages/db/prisma/setup-accounts.ts',
     [("title: 'Allenamento squadra', type: 'training'", "title: 'Allenamento squadra', type: 'basket'"),
      ("title: 'Recovery session', type: 'training'", "title: 'Recovery session', type: 'gym'")]),
]:
    if not os.path.exists(path):
        print('SKIP', path)
        continue
    src = io.open(path, encoding='utf-8').read()
    changed = 0
    for old, new in pairs:
        if old in src:
            src = src.replace(old, new)
            changed += 1
    if changed:
        io.open(path, 'w', encoding='utf-8', newline='').write(src)
    print('patched %s (%d sostituzioni)' % (path, changed))
