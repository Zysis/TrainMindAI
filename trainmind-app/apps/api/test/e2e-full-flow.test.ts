/**
 * End-to-end integration test for the complete TrainMind flow:
 *
 *   1. Register user + organization
 *   2. Login (verify token refresh path)
 *   3. Create athlete profile
 *   4. Create training session manually (AI plan generation is mocked upstream)
 *   5. Log wellness data
 *   6. Record session log (RPE + duration)
 *   7. Fetch analytics (ACWR should compute)
 *   8. Fetch alerts/notifications
 *   9. Generate adaptation proposal
 *   10. Review adaptation (approve)
 *
 * This test hits the real database. It gracefully skips if DATABASE_URL is
 * not set or unreachable, so CI can run it conditionally.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// ─── Shared state ───────────────────────────────────────

let app: FastifyInstance;
let accessToken: string;
let userId: string;
let organizationId: string;
let athleteId: string;
let sessionId: string;
let adaptationId: string;
let dbAvailable = true;

const testEmail = `e2e-${Date.now()}@trainmind.test`;
const testPassword = 'TestPassword123!';

// ─── Helpers ────────────────────────────────────────────

function authHeaders() {
  return { authorization: `Bearer ${accessToken}` };
}

async function inject<T = unknown>(opts: Parameters<FastifyInstance['inject']>[0]): Promise<{
  status: number;
  body: T;
}> {
  const res = await app.inject(opts);
  let body: T;
  try {
    body = res.json() as T;
  } catch {
    body = res.body as unknown as T;
  }
  return { status: res.statusCode, body };
}

// ─── Setup ──────────────────────────────────────────────

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    dbAvailable = false;
    console.warn('[e2e] Skipping: DATABASE_URL not set');
    return;
  }
  try {
    app = await buildApp();
    await app.ready();
  } catch (err) {
    dbAvailable = false;
    console.warn('[e2e] Skipping: failed to build app', err);
  }
});

afterAll(async () => {
  if (app) {
    // La pulizia non passa da nessun cascade: `users.organizationId` e
    // `calendar_events.userId` sono foreign key senza `onDelete: Cascade`,
    // quindi cancellare l'organizzazione per prima le viola e l'organizzazione
    // di prova resta nel database a ogni giro.
    try {
      if (organizationId) {
        await app.prisma.calendarEvent.deleteMany({ where: { organizationId } });
        await app.prisma.wellnessLog.deleteMany({ where: { athlete: { organizationId } } });
        await app.prisma.planAdaptation.deleteMany({ where: { organizationId } });
        await app.prisma.trainingSession.deleteMany({ where: { organizationId } });
        await app.prisma.week.deleteMany({ where: { trainingPlan: { organizationId } } });
        await app.prisma.trainingPlan.deleteMany({ where: { organizationId } });
        await app.prisma.athlete.deleteMany({ where: { organizationId } });
        await app.prisma.exercise.deleteMany({ where: { organizationId } });
        await app.prisma.user.deleteMany({ where: { organizationId } });
        await app.prisma.organization.delete({ where: { id: organizationId } });
      }
    } catch { /* la pulizia e' best-effort: un residuo non deve far fallire la suite */ }
    await app.close();
  }
});

// ─── Tests ──────────────────────────────────────────────

describe.sequential('E2E full flow', () => {
  it('[1] registers a new user + organization', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<{
      success: boolean;
      data: {
        user: { id: string; organizationId: string };
        tokens: { accessToken: string };
      };
    }>({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        password: testPassword,
        firstName: 'E2E',
        lastName: 'Tester',
        organizationName: 'E2E Test Org',
        // Aggiunti il 2/9/2026: la registrazione li richiede da quando esiste
        // il gate dei 14 anni e la raccolta dei consensi, e questo test era
        // rimasto indietro — falliva con 400 e a cascata tutti i successivi.
        dateOfBirth: '1990-05-15',
        acceptTerms: true,
        acceptPrivacy: true,
      },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.user.id).toBeTruthy();
    userId = body.data.user.id;
    organizationId = body.data.user.organizationId;
    accessToken = body.data.tokens.accessToken;
  });

  it('[2] logs in with credentials', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<{
      success: boolean;
      data: { tokens: { accessToken: string } };
    }>({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: testPassword },
    });
    expect(status).toBe(200);
    expect(body.data.tokens.accessToken).toBeTruthy();
    accessToken = body.data.tokens.accessToken;
  });

  it('[3] creates an athlete', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<{
      success: boolean;
      data: { id: string };
    }>({
      method: 'POST',
      url: '/api/v1/athletes',
      headers: authHeaders(),
      payload: {
        firstName: 'Test',
        lastName: 'Athlete',
        // Il campo si chiama `dateOfBirth`, non `birthDate`: con il nome
        // sbagliato mancava un campo obbligatorio e la rotta rispondeva 400.
        dateOfBirth: '2005-05-15',
        // I ruoli validi sono le sigle PG/SG/SF/PF/C (o il nome per esteso,
        // tipo 'point guard'). 'GUARD' non e' fra questi.
        position: 'PG',
        height: 185,
        weight: 78,
      },
    });
    // Accept 201 or 200 depending on route convention
    expect([200, 201]).toContain(status);
    expect(body.data?.id).toBeTruthy();
    athleteId = body.data.id;
  });

  it('[4] logs a wellness entry', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST',
      url: '/api/v1/wellness',
      headers: authHeaders(),
      payload: {
        athleteId,
        date: new Date().toISOString().slice(0, 10),
        // Obbligatorio nello schema, e mancava.
        sleepHours: 7.5,
        sleepQuality: 3,
        fatigue: 4,
        soreness: 3,
        mood: 3,
        stress: 4,
      },
    });
    expect([200, 201]).toContain(status);
  });

  // Una sessione non si crea da sola: sta dentro una settimana, che sta dentro
  // un piano. La rotta `POST /training/sessions` che questo passo chiamava non
  // esiste — rispondeva 404, e il test passava lo stesso perche' si limitava a
  // chiedere `status < 500`. Cioe' non verificava niente.
  it('[5] creates a training plan, then a session inside its first week', async () => {
    if (!dbAvailable || !athleteId) return;
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

    const plan = await inject<{
      success: boolean;
      data: { id: string; weeks: Array<{ id: string; weekNumber: number }> };
    }>({
      method: 'POST',
      url: '/api/v1/training/plans',
      headers: authHeaders(),
      payload: {
        name: 'E2E Test Plan',
        startDate: day(0),
        endDate: day(28),
        weeks: 1,
        athleteId,
      },
    });
    expect(plan.status, JSON.stringify(plan.body)).toBe(201);
    const weekId = plan.body.data.weeks[0]?.id;
    expect(weekId, 'il piano deve nascere con la sua prima settimana').toBeTruthy();

    const { status, body } = await inject<{ success: boolean; data: { id: string } }>({
      method: 'POST',
      url: `/api/v1/training/weeks/${weekId}/sessions`,
      headers: authHeaders(),
      payload: {
        title: 'Test Session',
        date: day(0),
        duration: 60,
        athleteId,
      },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.data.id).toBeTruthy();
    sessionId = body.data.id;

    // E rileggiamola dall'API: che la scrittura sia arrivata davvero al
    // database, e non solo che la rotta abbia risposto 201.
    const reread = await inject<{ data: { id: string; title: string; status: string } }>({
      method: 'GET',
      url: `/api/v1/training/sessions/${sessionId}`,
      headers: authHeaders(),
    });
    expect(reread.status).toBe(200);
    expect(reread.body.data.title).toBe('Test Session');
    expect(reread.body.data.status).toBe('PLANNED');
  });

  it('[6] fetches analytics (ACWR should not 500)', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'GET',
      url: `/api/v1/analytics/acwr?athleteId=${athleteId}`,
      headers: authHeaders(),
    });
    expect(status).toBeLessThan(500);
  });

  it('[7] fetches notifications list', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<{ success: boolean; data: unknown[] }>({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: authHeaders(),
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('[8] generates an adaptation proposal (dryRun)', async () => {
    if (!dbAvailable || !athleteId) return;
    const { status, body } = await inject<{
      success: boolean;
      data: { adaptationId?: string };
    }>({
      method: 'POST',
      url: '/api/v1/ai/adapt',
      headers: authHeaders(),
      payload: { athleteId, dryRun: true },
    });
    // May 404 if no target session exists — acceptable path
    expect([200, 201, 404, 400]).toContain(status);
    if (status < 300 && body.data?.adaptationId) {
      adaptationId = body.data.adaptationId;
    }
  });

  it('[9] lists adaptations', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<{ success: boolean; data: unknown[] }>({
      method: 'GET',
      url: '/api/v1/ai/adaptations',
      headers: authHeaders(),
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('[10] reviews an adaptation (if one exists)', async () => {
    if (!dbAvailable || !adaptationId) return;
    const { status } = await inject({
      method: 'POST',
      url: `/api/v1/ai/adaptations/${adaptationId}/review`,
      headers: authHeaders(),
      payload: { status: 'APPROVED', reviewNotes: 'E2E auto-approved' },
    });
    expect(status).toBeLessThan(500);
  });
});
