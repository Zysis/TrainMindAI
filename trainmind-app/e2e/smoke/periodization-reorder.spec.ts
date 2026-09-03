import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Riordino dei mesocicli — contro lo stack davvero in esecuzione.
 *
 * Perché passa dall'API e non dal drag-and-drop: trascinare in Playwright è
 * fragile e, quando fallisce, non dice se il problema è il gesto o il server.
 * Qui si manda esattamente il payload che manda la pagina (indici rinumerati
 * 0..n-1 dopo lo spostamento) e si guarda cosa risponde il backend.
 *
 * Due cose sotto esame:
 *  1. Uno scambio legittimo deve rispondere 200. `mesocycles` ha
 *     @@unique([periodizationPlanId, orderIndex]) e gli update sono
 *     sequenziali: se qui vedi un 500, lo stato intermedio della transazione
 *     sta violando il vincolo e serve una rinumerazione in due fasi.
 *  2. Un mesociclo che non appartiene al piano deve essere respinto con 400,
 *     non riordinato: è la guardia aggiunta il 2/9/2026.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const authFile = path.join(__dirname, '../../.auth/user.json');

function accessToken(): string {
  if (!fs.existsSync(authFile)) {
    throw new Error('Manca .auth/user.json: il progetto "setup" di Playwright non è stato eseguito.');
  }
  return JSON.parse(fs.readFileSync(authFile, 'utf-8')).accessToken;
}

const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

test.describe('Periodizzazione — riordino mesocicli', () => {
  let api: Awaited<ReturnType<typeof playwrightRequest.newContext>>;
  let planId = '';
  let firstId = '';
  let secondId = '';

  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: {
        authorization: `Bearer ${accessToken()}`,
        'content-type': 'application/json',
      },
    });

    // Il piano nasce già con i due mesocicli: createPlanSchema li accetta
    // in linea, e le date vogliono il formato YYYY-MM-DD.
    const created = await api.post('/api/v1/periodization/plans', {
      data: {
        name: `Piano riordino ${Date.now()}`,
        type: 'BLOCK',
        startDate: isoDay(0),
        endDate: isoDay(28),
        totalWeeks: 4,
        mesocycles: [
          { orderIndex: 0, name: 'Primo', phase: 'PREPARATION', durationWeeks: 2, targetLoadPercent: 70, microcycles: [] },
          { orderIndex: 1, name: 'Secondo', phase: 'COMPETITION', durationWeeks: 2, targetLoadPercent: 85, microcycles: [] },
        ],
      },
    });
    expect(created.status(), `creazione piano: ${await created.text()}`).toBe(201);

    const plan = (await created.json()).data.plan as {
      id: string;
      mesocycles: Array<{ id: string; orderIndex: number }>;
    };
    planId = plan.id;
    const sorted = [...plan.mesocycles].sort((a, b) => a.orderIndex - b.orderIndex);
    expect(sorted.length).toBe(2);
    firstId = sorted[0].id;
    secondId = sorted[1].id;
  });

  test.afterAll(async () => {
    if (planId) {
      await api.delete(`/api/v1/periodization/plans/${planId}`).catch(() => {});
    }
    await api.dispose();
  });

  test('scambiare due mesocicli dello stesso piano risponde 200', async () => {
    const res = await api.patch(`/api/v1/periodization/plans/${planId}/mesocycles/reorder`, {
      data: [
        { id: secondId, orderIndex: 0 },
        { id: firstId, orderIndex: 1 },
      ],
    });

    expect(
      res.status(),
      'Se qui vedi 500 con P2002, il vincolo di unicità (periodizationPlanId, orderIndex) ' +
      'viene violato dallo stato intermedio della transazione: serve rinumerare in due fasi. ' +
      `Risposta: ${await res.text()}`,
    ).toBe(200);

    const detail = await api.get(`/api/v1/periodization/plans/${planId}`);
    const mesocycles = (await detail.json()).data.plan.mesocycles as Array<{ id: string; orderIndex: number }>;
    expect(mesocycles.find((m) => m.id === secondId)?.orderIndex).toBe(0);
    expect(mesocycles.find((m) => m.id === firstId)?.orderIndex).toBe(1);
  });

  test('un mesociclo estraneo al piano viene respinto', async () => {
    const res = await api.patch(`/api/v1/periodization/plans/${planId}/mesocycles/reorder`, {
      data: [{ id: 'mesociclo-inesistente-o-di-un-altro-piano', orderIndex: 0 }],
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('MESOCYCLE_NOT_IN_PLAN');
  });
});
