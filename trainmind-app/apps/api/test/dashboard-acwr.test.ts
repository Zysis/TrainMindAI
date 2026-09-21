/**
 * ACWR e box rischio — la formula che il prodotto usa davvero.
 *
 * Perché questo file esiste
 * -------------------------
 * Dal 2/9/2026 la formula è una sola, in `computeAcwr` (@trainmind/utils), e
 * ha i suoi test unitari lì. Questo file verifica l'altra metà: che la rotta
 * la usi davvero e la restituisca bene attraverso `GET /dashboard/overview` —
 * cioè che il numero che il preparatore vede a schermo sia quello.
 *
 * Prima erano quattro implementazioni divergenti (analytics, daily-report,
 * dashboard, game-report) più una quinta morta in packages/utils, e solo
 * dashboard aveva la guardia dei 14 giorni: sulla stessa giornata la
 * dashboard diceva "nessun atleta valutabile" mentre il report giornaliero
 * mostrava 2,44 in rosso.
 *
 * Le due regole messe sotto test
 * ------------------------------
 * 1. sRPE = RPE × durata; acuto = ultimi 7 giorni; cronico = totale su 21
 *    giorni ÷ 3. Con 13 giorni a 360 e 7 giorni a 900 il rapporto è 1,72.
 * 2. Sotto i 14 giorni di storico l'atleta NON è valutabile e resta fuori
 *    dalla lista: normalizzare sulle settimane davvero coperte darebbe circa
 *    1,0 ("va tutto bene") a un atleta di cui non si sa niente.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
let dbAvailable = true;

const stamp = Date.now();
const email = `acwr-${stamp}@trainmind.test`;
let token = '';
let orgId = '';
let spikeAthleteId = '';
let shortHistoryAthleteId = '';

// Due ore di margine, e non e' un dettaglio. La finestra acuta la calcola la
// rotta al momento della richiesta, qualche secondo DOPO che il fixture ha
// scritto le sedute: una seduta datata esattamente `now - 7 giorni` cade
// appena fuori da `acuteStart` e il carico acuto perde 900 punti su 6300.
// Il primo giro di questo test e' fallito esattamente cosi' (5400 invece di
// 6300). Le date di fixture non vanno mai messe sul confine di una finestra.
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000 + 2 * 3600000);

async function inject<T = any>(opts: Parameters<FastifyInstance['inject']>[0]) {
  const res = await app.inject(opts);
  let body: T;
  try { body = res.json() as T; } catch { body = res.body as unknown as T; }
  return { status: res.statusCode, body };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    dbAvailable = false;
    console.warn('[acwr] Saltato: DATABASE_URL non impostata');
    return;
  }
  try {
    app = await buildApp();
    await app.ready();
  } catch (err) {
    dbAvailable = false;
    console.warn('[acwr] Saltato: buildApp fallita', err);
    return;
  }

  const reg = await inject<{
    data: { user: { id: string; organizationId: string }; tokens: { accessToken: string } };
  }>({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email, password: 'TestPassword123!', firstName: 'ACWR', lastName: 'Tester',
      organizationName: `ACWR Org ${stamp}`,
      // Obbligatori dalla registrazione: data di nascita (gate dei 14 anni)
      // e i due consensi, che lo schema accetta solo a `true`.
      dateOfBirth: '1990-05-15',
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  if (reg.status !== 201) {
    throw new Error(`Registrazione fallita (${reg.status}): ${JSON.stringify(reg.body)}`);
  }
  token = reg.body.data.tokens.accessToken;
  orgId = reg.body.data.user.organizationId;

  const p = app.prisma;

  // ── Atleta 1: scalino di carico, storico abbondante ──
  const spike = await p.athlete.create({
    data: {
      identity: { create: { firstName: 'Picco', lastName: 'DiCarico', dateOfBirth: new Date('2002-01-20') } },
      birthYear: 2002,
      position: 'CENTER', organizationId: orgId,
    },
  });
  spikeAthleteId = spike.id;

  // Giorni 8..20 indietro: 13 sedute da 360 (rpe 6 x 60 min) → cronico "di base"
  // Giorni 1..7 indietro:  7 sedute da 900 (rpe 9 x 100 min) → la settimana acuta
  const spikeSessions = [
    ...Array.from({ length: 13 }, (_, i) => ({ day: i + 8, rpe: 6, duration: 60 })),
    ...Array.from({ length: 7 }, (_, i) => ({ day: i + 1, rpe: 9, duration: 100 })),
  ];
  for (const s of spikeSessions) {
    await p.trainingSession.create({
      data: {
        title: `Seduta -${s.day}`, duration: s.duration, rpe: s.rpe, status: 'COMPLETED',
        date: daysAgo(s.day), athleteId: spike.id, organizationId: orgId,
      },
    });
  }

  // ── Atleta 2: carico c'è, ma lo storico è di 5 giorni ──
  const short = await p.athlete.create({
    data: {
      identity: { create: { firstName: 'Storico', lastName: 'Corto', dateOfBirth: new Date('2005-06-11') } },
      birthYear: 2005,
      position: 'GUARD', organizationId: orgId,
    },
  });
  shortHistoryAthleteId = short.id;
  for (let day = 1; day <= 5; day++) {
    await p.trainingSession.create({
      data: {
        title: `Seduta -${day}`, duration: 90, rpe: 9, status: 'COMPLETED',
        date: daysAgo(day), athleteId: short.id, organizationId: orgId,
      },
    });
  }
}, 60_000);

afterAll(async () => {
  if (!app) return;
  // Senza organizzazione non c'e' niente da ripulire: senza questa guardia,
  // quando il beforeAll fallisce, Prisma stampa un errore di cancellazione
  // che non c'entra niente col problema vero e confonde chi legge l'output.
  if (!orgId) { await app.close(); return; }
  const p = app.prisma;
  try {
    await p.trainingSession.deleteMany({ where: { organizationId: orgId } });
    await p.athlete.deleteMany({ where: { organizationId: orgId } });
    await p.user.deleteMany({ where: { organizationId: orgId } });
    // I 108 esercizi di default vengono creati alla registrazione: senza
    // toglierli, la delete dell'organizzazione viola la foreign key e stampa
    // un errore Prisma a ogni esecuzione. Gli altri test lo facevano gia'.
    await p.exercise.deleteMany({ where: { organizationId: orgId } });
    await p.organization.delete({ where: { id: orgId } });
  } catch { /* pulizia best-effort */ }
  await app.close();
}, 60_000);

describe.sequential('ACWR del box rischio', () => {
  it('calcola 1,72 su uno scalino di carico e lo classifica come critico', async () => {
    if (!dbAvailable) return;
    const { status, body } = await inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(status).toBe(200);

    const rows = (body as any).data.risk.athletes as Array<Record<string, any>>;
    const row = rows.find((r) => r.athleteId === spikeAthleteId);
    expect(row, 'l\'atleta con lo scalino deve comparire nel box rischio').toBeTruthy();

    // acuto   = 7 x 900            = 6300
    // cronico = 13 x 360 + 6300    = 10980, diviso 3 settimane = 3660
    // ACWR    = 6300 / 3660        = 1,72
    expect(row!.acuteLoad).toBe(6300);
    expect(row!.chronicLoad).toBe(3660);
    expect(row!.acwr).toBe(1.72);
    expect(row!.acwrZone).toBe('danger');
    expect(row!.reasons).toContain('ACWR_SPIKE');
    expect(row!.level).toBe('danger');
  });

  it('tiene fuori dalla lista chi ha meno di 14 giorni di storico', async () => {
    if (!dbAvailable) return;
    const { body } = await inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${token}` },
    });

    const risk = (body as any).data.risk;
    const rows = risk.athletes as Array<Record<string, any>>;

    // Cinque giorni di carico altissimo darebbero un ACWR gonfiato: la
    // risposta onesta è "non valutabile", non un falso allarme.
    expect(rows.find((r) => r.athleteId === shortHistoryAthleteId)).toBeUndefined();
    expect(risk.insufficientHistory).toBeGreaterThanOrEqual(1);
    expect(risk.notAssessable).toBeGreaterThanOrEqual(1);
  });
});
