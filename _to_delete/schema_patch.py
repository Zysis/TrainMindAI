# -*- coding: utf-8 -*-
"""Presenze (semaforo) su field_training_entries + ospiti sulla sessione."""
import io
import os

p = 'trainmind-app/packages/db/prisma/schema.prisma'
s = io.open(p, encoding='utf-8').read()

old_session = '''  availableAthletes Int?    // atleti disponibili dichiarati dal preparatore
  exercises       Json      @default("[]") // Array of { id, name, isWarmup, players, courts, activityMs, pauseMs, breakMs, state, breakRunning }
'''
new_session = '''  availableAthletes Int?    // giocatori col semaforo verde al momento del salvataggio
  exercises       Json      @default("[]") // Array of { id, name, isWarmup, players, courts, activityMs, pauseMs, breakMs, state, breakRunning }
  guests          Json      @default("[]") // Giocatori ospiti, solo per questa sessione: { id, name, status, note }
'''
assert s.count(old_session) == 1, 'ancora sessione non trovata'
s = s.replace(old_session, new_session)

old_entry = '''  totalActiveMs          Int    @default(0)
  laps                   Json   @default("[]") // Array of { startMs, endMs, durationMs }
'''
new_entry = '''  totalActiveMs          Int    @default(0)
  laps                   Json   @default("[]") // Array of { startMs, endMs, durationMs }
  status                 String @default("PRESENT") // PRESENT, UNAVAILABLE, ABSENT
  note                   String? // motivo facoltativo per indisponibile/assente
'''
assert s.count(old_entry) == 1, 'ancora entry non trovata'
s = s.replace(old_entry, new_entry)

old_idx = '''  @@unique([fieldTrainingSessionId, athleteId])
  @@index([athleteId])
  @@map("field_training_entries")'''
new_idx = '''  @@unique([fieldTrainingSessionId, athleteId])
  @@index([athleteId])
  @@index([status])
  @@map("field_training_entries")'''
assert s.count(old_idx) == 1, 'ancora indici non trovata'
s = s.replace(old_idx, new_idx)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('schema ok')

d = 'trainmind-app/packages/db/prisma/migrations/20260820090000_field_training_roster'
os.makedirs(d, exist_ok=True)
io.open(os.path.join(d, 'migration.sql'), 'w', encoding='utf-8', newline='\n').write(
    '''-- Field training: semaforo presenze per atleta + giocatori ospiti di sessione
ALTER TABLE "field_training_entries" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PRESENT';
ALTER TABLE "field_training_entries" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "field_training_sessions" ADD COLUMN IF NOT EXISTS "guests" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "field_training_entries_status_idx" ON "field_training_entries"("status");
''')
print('migration ok:', d)
