import type { FastifyInstance } from 'fastify';
import { ACWR_CHRONIC_DAYS, type AcwrLoadPoint } from '@trainmind/utils';

type Db = FastifyInstance['prisma'];

/**
 * Punti di carico (sRPE = RPE x durata) per atleta, nella finestra cronica che
 * precede `asOf`. È la materia prima di `computeAcwr`.
 *
 * Perché sta qui e non dentro le singole rotte: le sedute di SQUADRA hanno
 * `athleteId` nullo e valgono per tutta la rosa del piano. Chi si allena solo
 * in gruppo — cioè quasi tutti — senza questa attribuzione risulta senza
 * carico, e quindi con ACWR non calcolabile: è il motivo per cui il report
 * giornaliero mostrava "—" su ogni giocatore mentre la dashboard mostrava
 * numeri veri. Una sola funzione, una sola regola.
 *
 * `detailedByAttendance` esclude le sedute di squadra già dettagliate dal
 * foglio presenze: lì le righe per singolo atleta esistono già e il carico
 * verrebbe contato due volte.
 */
export async function acwrLoadPoints(
  prisma: Db,
  athleteIds: string[],
  asOf: Date,
): Promise<Map<string, AcwrLoadPoint[]>> {
  const byAthlete = new Map<string, AcwrLoadPoint[]>();
  if (athleteIds.length === 0) return byAthlete;

  const from = new Date(asOf.getTime() - ACWR_CHRONIC_DAYS * 86400000);

  const memberships = await prisma.athleteTeam.findMany({
    where: { athleteId: { in: athleteIds } },
    select: { teamId: true, athleteId: true },
  });
  const athletesByTeam = new Map<string, string[]>();
  for (const m of memberships) {
    const list = athletesByTeam.get(m.teamId) ?? [];
    list.push(m.athleteId);
    athletesByTeam.set(m.teamId, list);
  }
  const teamIds = [...athletesByTeam.keys()];

  const sessions = await prisma.trainingSession.findMany({
    where: {
      status: 'COMPLETED',
      rpe: { not: null },
      isTemplate: false,
      date: { gte: from, lte: asOf },
      OR: [
        { athleteId: { in: athleteIds } },
        ...(teamIds.length > 0
          ? [
              {
                athleteId: null,
                detailedByAttendance: false,
                week: { trainingPlan: { teamId: { in: teamIds } } },
              },
            ]
          : []),
      ],
    },
    select: {
      athleteId: true,
      date: true,
      duration: true,
      rpe: true,
      week: { select: { trainingPlan: { select: { teamId: true } } } },
    },
  });

  const wanted = new Set(athleteIds);
  const push = (athleteId: string, date: Date, load: number) => {
    if (!wanted.has(athleteId)) return;
    const list = byAthlete.get(athleteId) ?? [];
    list.push({ date, load });
    byAthlete.set(athleteId, list);
  };

  for (const ts of sessions) {
    if (!ts.date || !ts.rpe) continue;
    const load = ts.rpe * (ts.duration ?? 0);
    if (ts.athleteId) {
      push(ts.athleteId, ts.date, load);
      continue;
    }
    const teamId = ts.week?.trainingPlan?.teamId;
    if (!teamId) continue;
    for (const id of athletesByTeam.get(teamId) ?? []) push(id, ts.date, load);
  }

  return byAthlete;
}
