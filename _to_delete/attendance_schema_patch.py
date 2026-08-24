# -*- coding: utf-8 -*-
"""Foglio presenze generalizzato: RPE per atleta, carico, sessioni della programmazione."""
import io

p = 'trainmind-app/packages/db/prisma/schema.prisma'
s = io.open(p, encoding='utf-8').read()


def sub(old, new, label):
    global s
    assert s.count(old) == 1, 'ancora "%s" non trovata o non unica' % label
    s = s.replace(old, new)


# ── 1. la sessione può appartenere a un evento OPPURE a una sessione di piano ──
sub("""model FieldTrainingSession {
  id              String    @id @default(cuid())
  calendarEventId String    @unique
  teamId          String?""",
    """model FieldTrainingSession {
  id              String    @id @default(cuid())
  // Il foglio presenze si aggancia a un evento di calendario OPPURE a una
  // sessione della programmazione: uno dei due, mai entrambi.
  calendarEventId String?   @unique
  trainingSessionId String? @unique
  teamId          String?""",
    'chiavi FieldTrainingSession')

sub("""  availableAthletes Int?    // giocatori col semaforo verde al momento del salvataggio
  exercises       Json      @default("[]") // Array of { id, name, isWarmup, players, courts, activityMs, pauseMs, breakMs, state, breakRunning }""",
    """  availableAthletes Int?    // giocatori col semaforo verde al momento del salvataggio
  durationMinutes Int?      // durata effettiva usata per il carico (RPE × durata)
  sessionRpe      Int?      // RPE di sessione: vale per gli atleti senza RPE proprio
  exercises       Json      @default("[]") // Array of { id, name, isWarmup, players, courts, activityMs, pauseMs, breakMs, state, breakRunning }""",
    'durata e RPE di sessione')

sub("""  calendarEvent CalendarEvent        @relation(fields: [calendarEventId], references: [id], onDelete: Cascade)
  team          Team?                @relation(fields: [teamId], references: [id])""",
    """  calendarEvent   CalendarEvent?     @relation(fields: [calendarEventId], references: [id], onDelete: Cascade)
  trainingSession TrainingSession?   @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
  team          Team?                @relation(fields: [teamId], references: [id])""",
    'relazioni FieldTrainingSession')

# ── 2. RPE per atleta sulla riga presenza ─────────────────────────────────
sub("""  status                 String @default("PRESENT") // PRESENT, UNAVAILABLE, ABSENT
  note                   String? // motivo facoltativo per indisponibile/assente""",
    """  status                 String @default("PRESENT") // PRESENT, UNAVAILABLE, ABSENT
  note                   String? // motivo facoltativo per indisponibile/assente
  rpe                    Int? // 1-10 percepito dal singolo atleta; se assente vale sessionRpe""",
    'rpe per atleta')

# ── 3. la sessione di squadra "dettagliata" non va più attribuita a tutti ──
sub("""  isTemplate     Boolean       @default(false)
  aiModified     Boolean       @default(false) // true when AI adaptation has been applied""",
    """  isTemplate     Boolean       @default(false)
  aiModified     Boolean       @default(false) // true when AI adaptation has been applied
  // true quando il foglio presenze ha generato le righe per singolo atleta:
  // da quel momento gli analytics NON attribuiscono più questa riga di squadra
  // a tutta la rosa, altrimenti il carico verrebbe contato due volte.
  detailedByAttendance Boolean  @default(false)""",
    'flag detailedByAttendance')

sub("""  week             Week?             @relation(fields: [weekId], references: [id], onDelete: Cascade)
  athlete          Athlete?          @relation(fields: [athleteId], references: [id])
  organization     Organization      @relation(fields: [organizationId], references: [id])
  sessionExercises SessionExercise[]
  sessionLogs      SessionLog[]""",
    """  week             Week?             @relation(fields: [weekId], references: [id], onDelete: Cascade)
  athlete          Athlete?          @relation(fields: [athleteId], references: [id])
  organization     Organization      @relation(fields: [organizationId], references: [id])
  sessionExercises SessionExercise[]
  sessionLogs      SessionLog[]
  attendanceSheet  FieldTrainingSession?""",
    'relazione inversa attendanceSheet')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  patched', p)
