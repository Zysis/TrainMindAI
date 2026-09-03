/**
 * Guardie di organizzazione — il confine fra due società.
 *
 * Perché questo file esiste
 * -------------------------
 * Una regressione su una guardia di organizzazione NON si vede a schermo:
 * l'interfaccia funziona benissimo, mostra solo i dati di qualcun altro. È
 * esattamente il tipo di difetto che un test deve prendere, perché nessun
 * collaudo manuale lo prenderà mai.
 *
 * Come funziona
 * -------------
 * Si registrano DUE organizzazioni: A (chi attacca) e B (la vittima). I dati
 * di B si creano con Prisma, non con l'API — così il fixture è deterministico
 * e non dipende dalla forma dei payload. Gli attacchi invece passano dall'API
 * come utente di A, perché è lì che vive la guardia da verificare.
 *
 * Ogni buco chiuso ha due test: quello che dimostra che l'attacco fallisce, e
 * quello che dimostra che l'operazione legittima funziona ancora. Il secondo
 * conta quanto il primo — una guardia che blocca tutti non è una correzione.
 *
 * Come ogni test che tocca il database, si autoesclude se DATABASE_URL non c'è.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
let dbAvailable = true;

const stamp = Date.now();
const PASSWORD = 'TestPassword123!';

interface Org {
  email: string;
  token: string;
  userId: string;
  orgId: string;
}

const A: Org = { email: `guard-a-${stamp}@trainmind.test`, token: '', userId: '', orgId: '' };
const B: Org = { email: `guard-b-${stamp}@trainmind.test`, token: '', userId: '', orgId: '' };

// ─── Fixture ────────────────────────────────────────────
const f = {
  // B, la vittima
  bTeamId: '', bAthleteId: '', bSessionId: '', bExerciseRowId: '',
  bEventGameId: '', bEventFieldId: '', bPlanId: '', bMesocycleId: '',
  // A, chi attacca
  aEventId: '', aAthleteId: '', aSessionId: '', aExercise1: '', aExercise2: '',
  aPlanId: '', aMeso1: '', aMeso2: '', aAdaptationId: '',
};

// ─── Helper ─────────────────────────────────────────────

async function inject<T = any>(opts: Parameters<FastifyInstance['inject']>[0]) {
  const res = await app.inject(opts);
  let body: T;
  try { body = res.json() as T; } catch { body = res.body as unknown as T; }
  return { status: res.statusCode, body };
}

function auth(o: Org) {
  return { authorization: `Bearer ${o.token}` };
}

async function register(o: Org, orgName: string) {
  const { status, body } = await inject<{
    data: { user: { id: string; organizationId: string }; tokens: { accessToken: string } };
  }>({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: o.email,
      password: PASSWORD,
      firstName: 'Guard',
      // Almeno due caratteri: 'A' e 'B' da soli non passano la validazione.
      lastName: `Societa${orgName}`,
      organizationName: `Guard ${orgName} ${stamp}`,
      // Obbligatori dalla registrazione: data di nascita (con gate dei 14
      // anni) e i due consensi, che lo schema accetta solo a `true`.
      dateOfBirth: '1990-05-15',
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  if (status !== 201) {
    throw new Error(
      `Registrazione di ${orgName} fallita (${status}): ${JSON.stringify(body)}. ` +
      `Se il codice è REGISTRATION_DISABLED, togli DISABLE_REGISTRATION dal .env di test.`,
    );
  }
  o.userId = body.data.user.id;
  o.orgId = body.data.user.organizationId;
  o.token = body.data.tokens.accessToken;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

// ─── Setup ──────────────────────────────────────────────

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    dbAvailable = false;
    console.warn('[org-guards] Saltato: DATABASE_URL non impostata');
    return;
  }
  try {
    app = await buildApp();
    await app.ready();
  } catch (err) {
    dbAvailable = false;
    console.warn('[org-guards] Saltato: buildApp fallita', err);
    return;
  }

  await register(A, 'A');
  await register(B, 'B');

  const p = app.prisma;

  // ── I dati di B, la società che non deve essere toccata ──
  const bTeam = await p.team.create({ data: { name: 'Squadra B', organizationId: B.orgId } });
  f.bTeamId = bTeam.id;

  const bAthlete = await p.athlete.create({
    data: {
      firstName: 'Atleta', lastName: 'DiB', dateOfBirth: new Date('2004-03-01'),
      position: 'GUARD', organizationId: B.orgId,
    },
  });
  f.bAthleteId = bAthlete.id;
  await p.athleteTeam.create({ data: { athleteId: bAthlete.id, teamId: bTeam.id } });

  const bExercise = await p.exercise.create({
    data: { name: 'Panca B', category: 'STRENGTH', organizationId: B.orgId },
  });
  const bSession = await p.trainingSession.create({
    data: { title: 'Sessione di B', duration: 60, organizationId: B.orgId, date: new Date() },
  });
  f.bSessionId = bSession.id;
  const bRow = await p.sessionExercise.create({
    data: { trainingSessionId: bSession.id, exerciseId: bExercise.id, orderIndex: 0, sets: 3, weight: 60 },
  });
  f.bExerciseRowId = bRow.id;

  const bEventGame = await p.calendarEvent.create({
    data: {
      title: 'Partita di B', type: 'match', userId: B.userId, organizationId: B.orgId, teamId: bTeam.id,
      startTime: new Date(), endTime: new Date(Date.now() + 7200000),
    },
  });
  f.bEventGameId = bEventGame.id;
  await p.gameSession.create({
    data: { calendarEventId: bEventGame.id, organizationId: B.orgId, teamId: bTeam.id },
  });

  const bEventField = await p.calendarEvent.create({
    data: {
      title: 'Allenamento di B', type: 'basket', userId: B.userId, organizationId: B.orgId, teamId: bTeam.id,
      startTime: new Date(), endTime: new Date(Date.now() + 5400000),
    },
  });
  f.bEventFieldId = bEventField.id;
  await p.fieldTrainingSession.create({
    data: { calendarEventId: bEventField.id, organizationId: B.orgId, teamId: bTeam.id },
  });

  const bPlan = await p.periodizationPlan.create({
    data: {
      name: 'Piano di B', startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000),
      totalWeeks: 4, organizationId: B.orgId, createdById: B.userId,
    },
  });
  f.bPlanId = bPlan.id;
  const bMeso = await p.mesocycle.create({
    data: {
      periodizationPlanId: bPlan.id, orderIndex: 0, name: 'Meso B',
      phase: 'PREPARATION', durationWeeks: 4, targetLoadPercent: 70,
    },
  });
  f.bMesocycleId = bMeso.id;

  // ── I dati di A, chi prova a passare il confine ──
  const aEvent = await p.calendarEvent.create({
    data: {
      title: 'Partita di A', type: 'match', userId: A.userId, organizationId: A.orgId,
      startTime: new Date(), endTime: new Date(Date.now() + 7200000),
    },
  });
  f.aEventId = aEvent.id;

  const aAthlete = await p.athlete.create({
    data: {
      firstName: 'Atleta', lastName: 'DiA', dateOfBirth: new Date('2003-09-10'),
      position: 'FORWARD', organizationId: A.orgId,
    },
  });
  f.aAthleteId = aAthlete.id;

  const aExercise = await p.exercise.create({
    data: { name: 'Squat A', category: 'STRENGTH', organizationId: A.orgId },
  });
  const aSession = await p.trainingSession.create({
    data: { title: 'Sessione di A', duration: 75, organizationId: A.orgId, date: new Date() },
  });
  f.aSessionId = aSession.id;
  const aRow1 = await p.sessionExercise.create({
    data: { trainingSessionId: aSession.id, exerciseId: aExercise.id, orderIndex: 0, sets: 3, weight: 80 },
  });
  const aRow2 = await p.sessionExercise.create({
    data: { trainingSessionId: aSession.id, exerciseId: aExercise.id, orderIndex: 1, sets: 4, weight: 90 },
  });
  f.aExercise1 = aRow1.id;
  f.aExercise2 = aRow2.id;

  const aPlan = await p.periodizationPlan.create({
    data: {
      name: 'Piano di A', startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000),
      totalWeeks: 4, organizationId: A.orgId, createdById: A.userId,
    },
  });
  f.aPlanId = aPlan.id;
  const aM1 = await p.mesocycle.create({
    data: {
      periodizationPlanId: aPlan.id, orderIndex: 0, name: 'Meso A1',
      phase: 'PREPARATION', durationWeeks: 2, targetLoadPercent: 70,
    },
  });
  const aM2 = await p.mesocycle.create({
    data: {
      periodizationPlanId: aPlan.id, orderIndex: 1, name: 'Meso A2',
      phase: 'COMPETITION', durationWeeks: 2, targetLoadPercent: 85,
    },
  });
  f.aMeso1 = aM1.id;
  f.aMeso2 = aM2.id;

  const aAdaptation = await p.planAdaptation.create({
    data: {
      trainingSessionId: aSession.id,
      athleteId: aAthlete.id,
      organizationId: A.orgId,
      proposedById: A.userId,
      status: 'PENDING',
      reason: 'Test guardie',
      metrics: {},
      originalPlan: [{ sessionExerciseId: aRow1.id, sets: 3 }],
      proposedPlan: [{ sessionExerciseId: aRow1.id, proposedSets: 5 }],
      changes: [],
    },
  });
  f.aAdaptationId = aAdaptation.id;
}, 60_000);

afterAll(async () => {
  if (!app) return;
  const p = app.prisma;
  // In ordine, perché non tutte le relazioni hanno onDelete: Cascade.
  for (const orgId of [A.orgId, B.orgId].filter(Boolean)) {
    try {
      await p.planAdaptation.deleteMany({ where: { organizationId: orgId } });
      await p.gameSession.deleteMany({ where: { organizationId: orgId } });
      await p.fieldTrainingSession.deleteMany({ where: { organizationId: orgId } });
      await p.sessionExercise.deleteMany({ where: { trainingSession: { organizationId: orgId } } });
      await p.trainingSession.deleteMany({ where: { organizationId: orgId } });
      await p.mesocycle.deleteMany({ where: { periodizationPlan: { organizationId: orgId } } });
      await p.periodizationPlan.deleteMany({ where: { organizationId: orgId } });
      await p.exercise.deleteMany({ where: { organizationId: orgId } });
      await p.athleteTeam.deleteMany({ where: { athlete: { organizationId: orgId } } });
      await p.athlete.deleteMany({ where: { organizationId: orgId } });
      await p.team.deleteMany({ where: { organizationId: orgId } });
      // Gli eventi di calendario PRIMA degli utenti: `calendar_events.userId`
      // e' una foreign key senza cascade, quindi cancellare l'utente per
      // primo la viola — ed e' anche inutile, perche' dopo non si trovano
      // piu' (li si cerca proprio passando dall'utente).
      await p.calendarEvent.deleteMany({ where: { organizationId: orgId } });
      await p.user.deleteMany({ where: { organizationId: orgId } });
      await p.organization.delete({ where: { id: orgId } });
    } catch { /* la pulizia è best-effort: un residuo non deve far fallire la suite */ }
  }
  await app.close();
}, 60_000);

// ─── Punto 4 — avvio partita e allenamento in campo ─────

describe.sequential('confine fra società — avvio sessioni', () => {
  it('A non riceve la sessione partita di B passandone il calendarEventId', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'POST',
      url: '/api/v1/game/start',
      headers: auth(A),
      payload: { calendarEventId: f.bEventGameId },
    });
    // L'evento non è di A: la scorciatoia "esiste già" non deve restituirlo.
    expect(status).toBe(404);
    expect(JSON.stringify(body)).not.toContain('DiB');
  });

  it('A non popola una sessione con la rosa di B passandone il teamId', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'POST',
      url: '/api/v1/game/start',
      headers: auth(A),
      payload: { calendarEventId: f.aEventId, teamId: f.bTeamId },
    });
    expect(status).toBe(404);
    expect((body as any).error?.code).toBe('NOT_FOUND');

    // E soprattutto: nessuna entry deve essere stata scritta con l'atleta di B.
    const leaked = await app.prisma.gamePlayerEntry.count({
      where: { athleteId: f.bAthleteId, gameSession: { organizationId: A.orgId } },
    });
    expect(leaked).toBe(0);
  });

  it('A non riceve il foglio di campo di B passandone il calendarEventId', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'POST',
      url: '/api/v1/field-training/start',
      headers: auth(A),
      payload: { calendarEventId: f.bEventFieldId },
    });
    expect(status).toBe(404);
    expect(JSON.stringify(body)).not.toContain('DiB');
  });

  it('A avvia normalmente una partita su un proprio evento', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'POST',
      url: '/api/v1/game/start',
      headers: auth(A),
      payload: { calendarEventId: f.aEventId },
    });
    expect([200, 201]).toContain(status);
    expect((body as any).data?.session?.id).toBeTruthy();
  });
});

// ─── Punto 5 — riordini ─────────────────────────────────

describe.sequential('confine fra società — riordini', () => {
  it('A non riordina un esercizio di B dentro una propria sessione', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'PUT',
      url: `/api/v1/training/sessions/${f.aSessionId}/exercises/reorder`,
      headers: auth(A),
      payload: { exercises: [{ id: f.bExerciseRowId, orderIndex: 0 }] },
    });
    expect(status).toBe(400);
    expect((body as any).error?.code).toBe('EXERCISE_NOT_IN_SESSION');

    const untouched = await app.prisma.sessionExercise.findUnique({ where: { id: f.bExerciseRowId } });
    expect(untouched?.orderIndex).toBe(0);
    expect(untouched?.trainingSessionId).toBe(f.bSessionId);
  });

  it('A riordina normalmente gli esercizi di una propria sessione', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'PUT',
      url: `/api/v1/training/sessions/${f.aSessionId}/exercises/reorder`,
      headers: auth(A),
      payload: {
        exercises: [
          { id: f.aExercise1, orderIndex: 1 },
          { id: f.aExercise2, orderIndex: 0 },
        ],
      },
    });
    expect(status).toBe(200);
    const first = await app.prisma.sessionExercise.findUnique({ where: { id: f.aExercise2 } });
    expect(first?.orderIndex).toBe(0);
  });

  it('A non riordina un mesociclo di B dentro un proprio piano', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'PATCH',
      url: `/api/v1/periodization/plans/${f.aPlanId}/mesocycles/reorder`,
      headers: auth(A),
      payload: [{ id: f.bMesocycleId, orderIndex: 0 }],
    });
    expect(status).toBe(400);
    expect((body as any).error?.code).toBe('MESOCYCLE_NOT_IN_PLAN');

    const untouched = await app.prisma.mesocycle.findUnique({ where: { id: f.bMesocycleId } });
    expect(untouched?.orderIndex).toBe(0);
    expect(untouched?.periodizationPlanId).toBe(f.bPlanId);
  });

  // ATTENZIONE — questo test risponde a una domanda aperta, non protegge una
  // correzione. `mesocycles` ha @@unique([periodizationPlanId, orderIndex]) e
  // il riordino manda gli indici rinumerati come update sequenziali: lo stato
  // intermedio della transazione viola il vincolo. Se qui vedi un 500 con
  // P2002, il riordino dei mesocicli era GIÀ rotto prima delle correzioni e
  // serve una rinumerazione in due fasi (prima a offset negativi, poi ai
  // valori finali). Non è una regressione: è la conferma del sospetto.
  it('A scambia due propri mesocicli (verifica il vincolo di unicità)', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'PATCH',
      url: `/api/v1/periodization/plans/${f.aPlanId}/mesocycles/reorder`,
      headers: auth(A),
      payload: [
        { id: f.aMeso1, orderIndex: 1 },
        { id: f.aMeso2, orderIndex: 0 },
      ],
    });
    if (status !== 200) {
      console.warn('[org-guards] riordino mesocicli fallito:', status, JSON.stringify(body));
    }
    expect(status).toBe(200);
  });
});

// ─── Punto 3 — revisione degli adattamenti ──────────────

describe.sequential('confine fra società — revisione adattamenti', () => {
  it('A non riscrive i carichi di B con un modifiedPlan che punta a un esercizio di B', async () => {
    if (!dbAvailable) return;
    const before = await app.prisma.sessionExercise.findUnique({ where: { id: f.bExerciseRowId } });

    const { status, body } = await inject({
      method: 'POST',
      url: `/api/v1/ai/adaptations/${f.aAdaptationId}/review`,
      headers: auth(A),
      payload: {
        status: 'MODIFIED',
        modifiedPlan: [{ sessionExerciseId: f.bExerciseRowId, proposedSets: 99, proposedWeight: 999 }],
      },
    });
    expect(status).toBe(400);
    expect((body as any).error?.code).toBe('EXERCISE_NOT_FOUND');

    const after = await app.prisma.sessionExercise.findUnique({ where: { id: f.bExerciseRowId } });
    expect(after?.sets).toBe(before?.sets);
    expect(after?.weight).toBe(before?.weight);
  });

  it('un modifiedPlan malformato risponde 400, non 500', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST',
      url: `/api/v1/ai/adaptations/${f.aAdaptationId}/review`,
      headers: auth(A),
      payload: {
        status: 'MODIFIED',
        modifiedPlan: [{ sessionExerciseId: f.aExercise1, proposedWeight: 'centoventi' }],
      },
    });
    expect(status).toBe(400);
  });

  it('A applica normalmente un adattamento sui propri esercizi', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST',
      url: `/api/v1/ai/adaptations/${f.aAdaptationId}/review`,
      headers: auth(A),
      payload: {
        status: 'MODIFIED',
        reviewNotes: 'Applicato dal test delle guardie',
        modifiedPlan: [{ sessionExerciseId: f.aExercise1, proposedSets: 5, proposedWeight: 85 }],
      },
    });
    expect(status).toBe(200);

    const applied = await app.prisma.sessionExercise.findUnique({ where: { id: f.aExercise1 } });
    expect(applied?.sets).toBe(5);
    expect(applied?.weight).toBe(85);
  });
});
