/**
 * Revisione del 16/9/2026 — regressioni dei difetti corretti.
 *
 * Ogni blocco copre un difetto trovato leggendo il codice, con il caso che lo
 * dimostrava e il caso legittimo che deve continuare a funzionare:
 *
 *  1. GDPR: la cancellazione rispondeva 500 (scriveva `refreshToken`, colonna
 *     eliminata dalla migrazione del 10/9).
 *  2. GDPR: un ATHLETE esportava i dati sanitari di tutta l'organizzazione.
 *  3. App atleti: dettaglio sessione e registro RPE non controllavano a chi
 *     appartenesse la sessione.
 *  4. Chiusura del foglio presenze non idempotente: il carico raddoppiava.
 *  5. Billing: un VIEWER apriva il portale Stripe; il webhook non poteva
 *     verificare nessuna firma.
 *  6. Notifiche atleta: un corpo malformato rispondeva 500.
 *
 * Come gli altri test col database, si autoesclude senza DATABASE_URL: una
 * suite saltata non e' una suite verde, va detto quando si riporta l'esito.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
let dbAvailable = true;

const stamp = Date.now();
const PASSWORD = 'TestPassword123!';
const mail = (who: string) => `sec-${who}-${stamp}@trainmind.test`;

const org = { A: { id: '', adminId: '', adminToken: '' }, B: { id: '', adminId: '' } };

const f = {
  teamId: '',
  meAthleteId: '',
  mateAthleteId: '',
  erasedAthleteId: '',
  meUserId: '',
  erasedUserId: '',
  trainerUserId: '',
  meToken: '',
  viewerToken: '',
  trainerToken: '',
  mySessionId: '',
  mateSessionId: '',
  bSessionId: '',
  sheetId: '',
};

// ─── Helper ─────────────────────────────────────────────

async function inject<T = any>(opts: InjectOptions) {
  const res = await app.inject(opts);
  let body: T;
  try { body = res.json() as T; } catch { body = res.body as unknown as T; }
  return { status: res.statusCode, body };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function registerOrg(who: 'A' | 'B') {
  const { status, body } = await inject<any>({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: mail(`admin-${who}`),
      password: PASSWORD,
      firstName: 'Admin',
      lastName: `Societa${who}`,
      organizationName: `Sec ${who} ${stamp}`,
      dateOfBirth: '1990-05-15',
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  if (status !== 201) throw new Error(`Registrazione ${who} fallita (${status}): ${JSON.stringify(body)}`);
  return {
    id: body.data.user.organizationId as string,
    adminId: body.data.user.id as string,
    adminToken: body.data.tokens.accessToken as string,
  };
}

/** Crea un utente con Prisma e ne fa il login dall'API, come farebbe l'app. */
async function createUserAndLogin(data: {
  who: string;
  role: 'ATHLETE' | 'VIEWER' | 'TRAINER';
  organizationId: string;
  athleteId?: string;
}) {
  const user = await app.prisma.user.create({
    data: {
      email: mail(data.who),
      // Costo basso: il test verifica i permessi, non bcrypt.
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      firstName: 'Utente',
      lastName: data.who,
      role: data.role,
      organizationId: data.organizationId,
      athleteId: data.athleteId,
    },
  });
  const { status, body } = await inject<any>({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: user.email, password: PASSWORD },
  });
  if (status !== 200) throw new Error(`Login ${data.who} fallito (${status}): ${JSON.stringify(body)}`);
  return { userId: user.id, token: body.data.tokens.accessToken as string };
}

// ─── Setup ──────────────────────────────────────────────

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    dbAvailable = false;
    console.warn('[security-review] Saltato: DATABASE_URL non impostata');
    return;
  }
  try {
    app = await buildApp();
    await app.ready();
  } catch (err) {
    dbAvailable = false;
    console.warn('[security-review] Saltato: buildApp fallita', err);
    return;
  }

  org.A = await registerOrg('A');
  const b = await registerOrg('B');
  org.B = { id: b.id, adminId: b.adminId };

  const p = app.prisma;
  const A = org.A.id;

  const team = await p.team.create({ data: { name: 'Squadra Sec', organizationId: A } });
  f.teamId = team.id;

  const mkAthlete = (lastName: string) =>
    p.athlete.create({
      data: { firstName: 'Atleta', lastName, dateOfBirth: new Date('2004-03-01'), position: 'PG', organizationId: A },
    });
  const me = await mkAthlete('Io');
  const mate = await mkAthlete('Compagno');
  const erased = await mkAthlete('DaCancellare');
  f.meAthleteId = me.id;
  f.mateAthleteId = mate.id;
  f.erasedAthleteId = erased.id;
  for (const a of [me, mate]) {
    await p.athleteTeam.create({ data: { athleteId: a.id, teamId: team.id } });
  }

  const day = new Date(Date.now() - 86400000);
  for (const a of [me, mate]) {
    await p.wellnessLog.create({
      data: {
        athleteId: a.id, date: day, sleepHours: 7, sleepQuality: 4,
        fatigue: 4, soreness: 4, stress: 4, mood: 4, notes: `wellness-${a.lastName}`,
      },
    });
  }
  await p.injury.create({
    data: {
      athleteId: mate.id, type: 'muscular', location: 'knee_r', severity: 3,
      dateOccurred: day, notes: 'infortunio-del-compagno',
    },
  });

  const meLogin = await createUserAndLogin({ who: 'atleta', role: 'ATHLETE', organizationId: A, athleteId: me.id });
  f.meUserId = meLogin.userId;
  f.meToken = meLogin.token;

  const viewer = await createUserAndLogin({ who: 'viewer', role: 'VIEWER', organizationId: A });
  f.viewerToken = viewer.token;

  const trainer = await createUserAndLogin({ who: 'trainer', role: 'TRAINER', organizationId: A });
  f.trainerUserId = trainer.userId;
  f.trainerToken = trainer.token;

  // Account atleta da cancellare, con una sessione di rinnovo aperta.
  const erasedUser = await p.user.create({
    data: {
      email: mail('erased'), passwordHash: '!', firstName: 'X', lastName: 'Y',
      role: 'ATHLETE', organizationId: A, athleteId: erased.id,
    },
  });
  f.erasedUserId = erasedUser.id;
  await p.refreshToken.create({
    data: {
      tokenHash: crypto.randomBytes(32).toString('hex'),
      userId: erasedUser.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });

  const mySession = await p.trainingSession.create({
    data: { title: 'Sessione mia', duration: 60, organizationId: A, athleteId: me.id, date: new Date() },
  });
  const mateSession = await p.trainingSession.create({
    data: { title: 'Sessione del compagno', duration: 60, organizationId: A, athleteId: mate.id, date: new Date() },
  });
  const bSession = await p.trainingSession.create({
    data: { title: 'Sessione di B', duration: 60, organizationId: org.B.id, date: new Date() },
  });
  f.mySessionId = mySession.id;
  f.mateSessionId = mateSession.id;
  f.bSessionId = bSession.id;

  const event = await p.calendarEvent.create({
    data: {
      title: 'Allenamento Sec', type: 'basket', userId: org.A.adminId, organizationId: A, teamId: team.id,
      startTime: new Date(Date.now() - 7200000), endTime: new Date(Date.now() - 3600000),
    },
  });
  const sheet = await p.fieldTrainingSession.create({
    data: {
      calendarEventId: event.id, organizationId: A, teamId: team.id,
      durationMinutes: 60, sessionRpe: 6,
      entries: { create: [{ athleteId: me.id, status: 'PRESENT' }, { athleteId: mate.id, status: 'PRESENT', rpe: 8 }] },
    },
  });
  f.sheetId = sheet.id;
}, 60_000);

afterAll(async () => {
  if (!app) return;
  const p = app.prisma;
  for (const orgId of [org.A.id, org.B.id].filter(Boolean)) {
    try {
      await p.sessionLog.deleteMany({ where: { trainingSession: { organizationId: orgId } } });
      await p.fieldTrainingSession.deleteMany({ where: { organizationId: orgId } });
      await p.trainingSession.deleteMany({ where: { organizationId: orgId } });
      await p.wellnessLog.deleteMany({ where: { athlete: { organizationId: orgId } } });
      await p.injury.deleteMany({ where: { athlete: { organizationId: orgId } } });
      await p.athleteTeam.deleteMany({ where: { athlete: { organizationId: orgId } } });
      await p.calendarEvent.deleteMany({ where: { organizationId: orgId } });
      await p.consentRecord.deleteMany({ where: { user: { organizationId: orgId } } });
      await p.auditLog.deleteMany({ where: { user: { organizationId: orgId } } });
      await p.user.deleteMany({ where: { organizationId: orgId } });
      await p.athlete.deleteMany({ where: { organizationId: orgId } });
      await p.team.deleteMany({ where: { organizationId: orgId } });
      await p.exercise.deleteMany({ where: { organizationId: orgId } });
      await p.organization.delete({ where: { id: orgId } });
    } catch { /* pulizia best-effort */ }
  }
  await app.close();
}, 60_000);

// ─── 1-2. GDPR ──────────────────────────────────────────

describe.sequential('GDPR', () => {
  it("l'export di un ATHLETE contiene solo i suoi dati", async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<any>({
      method: 'GET', url: '/api/v1/gdpr/export', headers: bearer(f.meToken),
    });
    expect(status).toBe(200);
    expect(body.athletes.map((a: { id: string }) => a.id)).toEqual([f.meAthleteId]);
    expect(body.wellnessLogs.every((w: { athleteId: string }) => w.athleteId === f.meAthleteId)).toBe(true);
    expect(body.injuries).toEqual([]);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('wellness-Compagno');
    expect(raw).not.toContain('infortunio-del-compagno');
    expect(raw).not.toContain('Sessione del compagno');
  });

  it("l'export dello staff resta quello dell'organizzazione", async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<any>({
      method: 'GET', url: '/api/v1/gdpr/export', headers: bearer(org.A.adminToken),
    });
    expect(status).toBe(200);
    const ids = body.athletes.map((a: { id: string }) => a.id);
    expect(ids).toEqual(expect.arrayContaining([f.meAthleteId, f.mateAthleteId]));
    expect(JSON.stringify(body)).toContain('infortunio-del-compagno');
  });

  it('la cancellazione GDPR di un atleta riesce e chiude le sue sessioni', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST',
      url: `/api/v1/gdpr/erase-athlete/${f.erasedAthleteId}`,
      headers: bearer(org.A.adminToken),
      payload: { reason: 'test' },
    });
    expect(status).toBe(200);
    const user = await app.prisma.user.findUnique({ where: { id: f.erasedUserId } });
    expect(user?.isActive).toBe(false);
    expect(user?.email).toContain('@removed.local');
    expect(await app.prisma.refreshToken.count({ where: { userId: f.erasedUserId } })).toBe(0);
  });

  it("l'ultimo amministratore con colleghi attivi non puo' cancellarsi", async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<any>({
      method: 'DELETE',
      url: '/api/v1/gdpr/delete-account',
      headers: bearer(org.A.adminToken),
      payload: { confirmation: 'DELETE_MY_ACCOUNT', password: PASSWORD },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe('LAST_ADMIN');
  });

  it('un preparatore cancella il proprio account', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'DELETE',
      url: '/api/v1/gdpr/delete-account',
      headers: bearer(f.trainerToken),
      payload: { confirmation: 'DELETE_MY_ACCOUNT', password: PASSWORD },
    });
    expect(status).toBe(200);
    const user = await app.prisma.user.findUnique({ where: { id: f.trainerUserId } });
    expect(user?.isActive).toBe(false);
    expect(user?.deletedAt).not.toBeNull();
  });
});

// ─── 3. App atleti: perimetro delle sessioni ────────────

describe.sequential('app atleti — sessioni', () => {
  it("il dettaglio della sessione di un compagno risponde 404 e non lascia tracce", async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'GET', url: `/api/v1/athlete/sessions/${f.mateSessionId}`, headers: bearer(f.meToken),
    });
    expect(status).toBe(404);
    expect(JSON.stringify(body)).not.toContain('Sessione del compagno');
    expect(await app.prisma.sessionLog.count({ where: { trainingSessionId: f.mateSessionId } })).toBe(0);
  });

  it("il dettaglio di una sessione di un'altra organizzazione risponde 404", async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'GET', url: `/api/v1/athlete/sessions/${f.bSessionId}`, headers: bearer(f.meToken),
    });
    expect(status).toBe(404);
  });

  it('il dettaglio della propria sessione funziona e segna la visualizzazione', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<any>({
      method: 'GET', url: `/api/v1/athlete/sessions/${f.mySessionId}`, headers: bearer(f.meToken),
    });
    expect(status).toBe(200);
    expect(body.data.title).toBe('Sessione mia');
    expect(body.data.myLog?.viewedAt).toBeTruthy();
  });

  it("il registro RPE rifiuta la sessione di un'altra organizzazione", async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST',
      url: '/api/v1/athlete/session-log',
      headers: bearer(f.meToken),
      payload: { trainingSessionId: f.bSessionId, actualRpe: 9, notes: 'intruso' },
    });
    expect(status).toBe(404);
    expect(await app.prisma.sessionLog.count({ where: { trainingSessionId: f.bSessionId } })).toBe(0);
  });

  it('il registro RPE sulla propria sessione funziona', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<any>({
      method: 'POST',
      url: '/api/v1/athlete/session-log',
      headers: bearer(f.meToken),
      payload: { trainingSessionId: f.mySessionId, actualRpe: 7 },
    });
    expect(status).toBe(201);
    expect(body.data.actualRpe).toBe(7);
  });

  it("l'elenco contiene la propria sessione e non quella del compagno", async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject<any>({
      method: 'GET', url: '/api/v1/athlete/sessions', headers: bearer(f.meToken),
    });
    expect(status).toBe(200);
    const ids = body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(f.mySessionId);
    expect(ids).not.toContain(f.mateSessionId);
  });

  it('una data illeggibile risponde 400, non 500', async () => {
    if (!dbAvailable) return;
    const list = await inject({
      method: 'GET', url: '/api/v1/athlete/sessions?from=ieri', headers: bearer(f.meToken),
    });
    expect(list.status).toBe(400);
    const wellness = await inject({
      method: 'POST',
      url: '/api/v1/athlete/wellness',
      headers: bearer(f.meToken),
      payload: { date: 'ieri', sleepHours: 7, sleepQuality: 4, fatigue: 4, soreness: 4, stress: 4, mood: 4 },
    });
    expect(wellness.status).toBe(400);
  });

  it('un link javascript: fra gli allegati del wellness viene rifiutato', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST',
      url: '/api/v1/athlete/wellness',
      headers: bearer(f.meToken),
      payload: {
        date: new Date().toISOString().slice(0, 10),
        sleepHours: 7, sleepQuality: 4, fatigue: 4, soreness: 4, stress: 4, mood: 4,
        mediaUrls: ['javascript:alert(1)'],
      },
    });
    expect(status).toBe(400);
  });
});

// ─── 4. Chiusura del foglio presenze ────────────────────

describe.sequential('foglio presenze — chiusura idempotente', () => {
  it('la prima chiusura crea le righe di carico, la seconda risponde 409 senza duplicarle', async () => {
    if (!dbAvailable) return;
    const countLoad = () =>
      app.prisma.trainingSession.count({
        where: { organizationId: org.A.id, athleteId: { in: [f.meAthleteId, f.mateAthleteId] }, status: 'COMPLETED' },
      });
    const before = await countLoad();

    const first = await inject<any>({
      method: 'PUT', url: `/api/v1/field-training/${f.sheetId}/complete`,
      headers: bearer(org.A.adminToken), payload: {},
    });
    expect(first.status).toBe(200);
    expect(first.body.data.trainingSessions).toBe(2);
    expect(await countLoad()).toBe(before + 2);

    const second = await inject<any>({
      method: 'PUT', url: `/api/v1/field-training/${f.sheetId}/complete`,
      headers: bearer(org.A.adminToken), payload: {},
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('SESSION_ALREADY_COMPLETED');
    expect(await countLoad()).toBe(before + 2);
  });
});

// ─── 5. Billing ─────────────────────────────────────────

describe.sequential('billing', () => {
  it('un VIEWER non apre il portale ne\' avvia un checkout', async () => {
    if (!dbAvailable) return;
    const portal = await inject({ method: 'POST', url: '/api/v1/billing/portal', headers: bearer(f.viewerToken) });
    expect(portal.status).toBe(403);
    const checkout = await inject({
      method: 'POST', url: '/api/v1/billing/checkout', headers: bearer(f.viewerToken),
      payload: { tier: 'ultra' },
    });
    expect(checkout.status).toBe(403);
  });

  it('il webhook verifica la firma sul corpo originale', async () => {
    if (!dbAvailable) return;
    const saved = {
      key: process.env.STRIPE_SECRET_KEY,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    };
    const secret = 'whsec_test_' + crypto.randomBytes(16).toString('hex');
    // Chiave finta ma "configurata": il webhook non chiama Stripe, verifica
    // solo la firma in locale.
    process.env.STRIPE_SECRET_KEY = 'sk_test_review_' + 'a'.repeat(32);
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    try {
      // Spazi e ordine delle chiavi voluti: riserializzare l'oggetto non
      // restituirebbe questi byte, e la firma non tornerebbe.
      const payload = '{ "id": "evt_test_review",  "object": "event", "type": "test.review_20260916", "data": { "object": {} } }';
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });

      const ok = await inject({
        method: 'POST', url: '/api/v1/billing/webhook',
        headers: { 'content-type': 'application/json', 'stripe-signature': header },
        payload,
      });
      expect(ok.status).toBe(200);

      const forged = await inject({
        method: 'POST', url: '/api/v1/billing/webhook',
        headers: { 'content-type': 'application/json', 'stripe-signature': header },
        payload: payload.replace('test.review_20260916', 'checkout.session.completed'),
      });
      expect(forged.status).toBe(400);
    } finally {
      if (saved.key === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = saved.key;
      if (saved.secret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = saved.secret;
    }
  });
});

// ─── 6. Notifiche atleta ────────────────────────────────

describe.sequential('app atleti — notifiche', () => {
  it('un corpo senza ids risponde 400, non 500', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST', url: '/api/v1/athlete/notifications/read',
      headers: bearer(f.meToken), payload: { ids: 'tutte' },
    });
    expect(status).toBe(400);
  });

  it('con ids validi risponde 200', async () => {
    if (!dbAvailable) return;
    const { status } = await inject({
      method: 'POST', url: '/api/v1/athlete/notifications/read',
      headers: bearer(f.meToken), payload: { ids: ['non-esiste'] },
    });
    expect(status).toBe(200);
  });
});
