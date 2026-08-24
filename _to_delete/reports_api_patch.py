# -*- coding: utf-8 -*-
"""Report per singolo atleta + robustezza del renderer PDF."""
import io

# ─────────────────────────────────────────────────────────────
# 1. ReportMetadata: nome atleta (entrambe le copie del pacchetto types)
# ─────────────────────────────────────────────────────────────
for p in ['trainmind-app/packages/types/src/index.ts',
          'trainmind-mobile/packages/types/src/index.ts']:
    s = io.open(p, encoding='utf-8').read()
    old = "  teamName?: string;        // When report is filtered by team\n}"
    new = ("  teamName?: string;        // When report is filtered by team\n"
           "  athleteName?: string;     // When report is filtered by a single athlete\n}")
    if 'athleteName?: string' in s:
        print('OK (already patched)', p)
    else:
        assert s.count(old) == 1, 'ReportMetadata %s' % p
        io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
        print('patched', p)

# ─────────────────────────────────────────────────────────────
# 2. reports.ts
# ─────────────────────────────────────────────────────────────
p = 'trainmind-app/apps/api/src/routes/reports.ts'
s = io.open(p, encoding='utf-8').read()


def sub(old, new, label):
    global s
    assert s.count(old) == 1, 'ancora non trovata: %s' % label
    s = s.replace(old, new)


# 2a. schema di richiesta
sub("""  includeAISummary: z.boolean().optional().default(true),
  teamId: z.string().optional(),
});""",
    """  includeAISummary: z.boolean().optional().default(true),
  teamId: z.string().optional(),
  athleteId: z.string().optional(),
});""",
    'generateReportSchema')

# 2b. route: destrutturazione + passaggio
sub("      const { audience, periodFrom, periodTo, format, includeAISummary, teamId } = parsed.data;",
    "      const { audience, periodFrom, periodTo, format, includeAISummary, teamId, athleteId } = parsed.data;",
    'route destructuring')

sub("""          includeAISummary,
          teamId,
        });""",
    """          includeAISummary,
          teamId,
          athleteId,
        });""",
    'route generateReport call')

# 2c. input del generatore
sub("""  includeAISummary: boolean;
  teamId?: string;""",
    """  includeAISummary: boolean;
  teamId?: string;
  /** Report del singolo atleta: restringe ogni aggregazione a lui solo */
  athleteId?: string;""",
    'GenerateReportInput')

# 2d. generateReport: destrutturazione, lookup atleta, metadata, chiamate
sub("  const { app, organizationId, userId, audience, periodFrom, periodTo, format, includeAISummary, teamId } = input;",
    "  const { app, organizationId, userId, audience, periodFrom, periodTo, format, includeAISummary, teamId, athleteId } = input;",
    'generateReport destructuring')

sub("""  const [org, user, team] = await Promise.all([
    app.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    app.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
    teamId ? app.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }) : null,
  ]);""",
    """  const [org, user, team, athlete] = await Promise.all([
    app.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    app.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
    teamId ? app.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }) : null,
    athleteId
      ? app.prisma.athlete.findFirst({
          where: { id: athleteId, organizationId },
          select: { firstName: true, lastName: true },
        })
      : null,
  ]);

  if (athleteId && !athlete) {
    throw new Error('Atleta non trovato in questa organizzazione');
  }""",
    'generateReport lookups')

sub("""    teamName: team?.name,
  };""",
    """    teamName: team?.name,
    athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : undefined,
  };""",
    'metadata')

sub("""  if (audience === 'STAFF') {
    report = await aggregateStaff(app, organizationId, from, to, metadata, teamId);
  } else if (audience === 'MEDICAL') {
    report = await aggregateMedical(app, organizationId, from, to, metadata, teamId);
  } else {
    report = await aggregateTrainer(app, organizationId, from, to, metadata, teamId);
  }""",
    """  if (audience === 'STAFF') {
    report = await aggregateStaff(app, organizationId, from, to, metadata, teamId, athleteId);
  } else if (audience === 'MEDICAL') {
    report = await aggregateMedical(app, organizationId, from, to, metadata, teamId, athleteId);
  } else {
    report = await aggregateTrainer(app, organizationId, from, to, metadata, teamId, athleteId);
  }""",
    'aggregator calls')

# 2e. nome del file
sub("""  const teamSlug = team?.name ? `-${team.name.toLowerCase().replace(/\\s+/g, '_')}` : '';
  const baseFilename = `report-${audience.toLowerCase()}${teamSlug}-${periodFrom}_${periodTo}`;""",
    """  const teamSlug = team?.name ? `-${team.name.toLowerCase().replace(/\\s+/g, '_')}` : '';
  const athleteSlug = athlete
    ? `-${`${athlete.lastName}_${athlete.firstName}`.toLowerCase().replace(/\\s+/g, '_')}`
    : '';
  const baseFilename = `report-${audience.toLowerCase()}${teamSlug}${athleteSlug}-${periodFrom}_${periodTo}`;""",
    'baseFilename')

# 2f. firme degli aggregatori
for fn, ret in [('aggregateStaff', 'StaffReportData'),
                ('aggregateMedical', 'MedicalReportData'),
                ('aggregateTrainer', 'TrainerReportData')]:
    sub("""  metadata: ReportMetadata,
  teamId?: string,
): Promise<%s> {""" % ret,
        """  metadata: ReportMetadata,
  teamId?: string,
  athleteId?: string,
): Promise<%s> {""" % ret,
        'firma %s' % fn)

# 2g. STAFF e TRAINER: insieme atleti ristretto al singolo
staff_trainer_old = """  let athletes;
  if (teamId) {
    const teamAthletes = await prisma.athleteTeam.findMany({
      where: { teamId },
      select: { athlete: { select: { id: true, firstName: true, lastName: true } } },
    });
    athletes = teamAthletes.map((ta) => ta.athlete);
  } else {
    athletes = await prisma.athlete.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
  }
  const athleteIds = athletes.map((a) => a.id);"""

staff_trainer_new = """  let athletes;
  if (athleteId) {
    // Report del singolo atleta: ogni aggregazione parte da lui solo
    athletes = await prisma.athlete.findMany({
      where: { id: athleteId, organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
  } else if (teamId) {
    const teamAthletes = await prisma.athleteTeam.findMany({
      where: { teamId },
      select: { athlete: { select: { id: true, firstName: true, lastName: true } } },
    });
    athletes = teamAthletes.map((ta) => ta.athlete);
  } else {
    athletes = await prisma.athlete.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
  }
  const athleteIds = athletes.map((a) => a.id);"""

assert s.count(staff_trainer_old) == 2, 'blocco athletes: trovate %d occorrenze' % s.count(staff_trainer_old)
s = s.replace(staff_trainer_old, staff_trainer_new)

# 2h. mappa squadra→atleti: le sessioni di squadra vanno attribuite al solo atleta
sub("""        return map;
      })();

  const sessionLogs:""",
    """        return map;
      })();

  // Le sessioni di squadra (athleteId null) vengono attribuite a tutta la rosa:
  // sul report del singolo va tenuto solo lui.
  if (athleteId) {
    for (const key of Object.keys(teamAthletesMap)) {
      teamAthletesMap[key] = teamAthletesMap[key].filter((id: string) => id === athleteId);
    }
  }

  const sessionLogs:""",
    'teamAthletesMap staff')

# 2i. MEDICAL: teamAthleteIds
sub("""  let teamAthleteIds: string[] | undefined;
  if (teamId) {
    const ta = await prisma.athleteTeam.findMany({
      where: { teamId },
      select: { athleteId: true },
    });
    teamAthleteIds = ta.map((t) => t.athleteId);
  }""",
    """  let teamAthleteIds: string[] | undefined;
  if (athleteId) {
    // Report del singolo atleta
    teamAthleteIds = [athleteId];
  } else if (teamId) {
    const ta = await prisma.athleteTeam.findMany({
      where: { teamId },
      select: { athleteId: true },
    });
    teamAthleteIds = ta.map((t) => t.athleteId);
  }""",
    'teamAthleteIds medical')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched', p)
