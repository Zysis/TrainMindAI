/**
 * Piani, prova gratuita ed estensioni (9/10/2026) — le regole pure, senza
 * database. Il listino e' in marketing/Strategia_commerciale_basket_v3.docx.
 *
 * Cosa e' sotto test:
 * - il listino scritto nel codice coincide con quello del documento;
 * - lo stato del piano (storico, prova, scaduta, attivo) e quando i limiti
 *   mordono davvero (interruttore PLAN_ENFORCEMENT + account non storico);
 * - prova: capienza dello Starter ma funzioni avanzate, niente AI;
 * - estensioni: contano solo su Ultra e Club;
 * - la sola lettura riguarda solo la prova scaduta, solo le scritture, e
 *   lascia sempre aperti accesso, abbonamento e GDPR.
 */

import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import {
  EXTENSIONS,
  TRIAL_DAILY_REPORTS,
  assertTrialDailyReport,
  LEGACY_SEATS_BY_TIER,
  MAX_REACTIVATIONS_PER_MONTH,
  PLAN_SPECS,
  TRIAL_DAYS,
  TRIAL_SPEC,
  assertFeature,
  isPlanEnforcementEnabled,
  monthStart,
  normalizeTier,
  readOnlyViolation,
  resolvePlan,
  teamCapacity,
  trialEndDate,
  PlanLimitError,
  type OrgPlanRow,
} from '../src/lib/plans.js';

const NOW = new Date('2026-10-09T10:00:00Z');
const DAY = 86_400_000;

function org(over: Partial<OrgPlanRow> = {}): OrgPlanRow {
  return { tier: 'STARTER', planLegacy: false, trialEndsAt: null, extraTeams: 0, extraSeats: 0, ...over };
}

describe('listino', () => {
  it('coincide con la strategia commerciale v3', () => {
    expect(PLAN_SPECS.STARTER).toMatchObject({ teams: 1, athletesPerTeam: 12, seats: 1, aiCredits: 0, price: { monthly: 15, yearly: 150 } });
    expect(PLAN_SPECS.PROFESSIONAL).toMatchObject({ teams: 2, athletesPerTeam: 14, seats: 1, aiCredits: 200, price: { monthly: 30, yearly: 300 } });
    expect(PLAN_SPECS.ULTRA).toMatchObject({ teams: 4, athletesPerTeam: 20, seats: 2, aiCredits: 500, price: { monthly: 35, yearly: 350 } });
    expect(PLAN_SPECS.CLUB).toMatchObject({ teams: 6, athletesPerTeam: 20, seats: 4, aiCredits: 750, price: { monthly: 50, yearly: 500 } });
    expect(EXTENSIONS).toEqual({
      team: { monthly: 8, yearly: 80, aiCredits: 100 },
      athletePack: { size: 5, monthly: 2, yearly: 20 },
      seat: { monthly: 10, yearly: 100 },
    });
    expect(MAX_REACTIVATIONS_PER_MONTH).toBe(10);
    expect(TRIAL_DAYS).toBe(15);
  });

  it("l'annuale vale sempre dieci mensilita'", () => {
    for (const spec of Object.values(PLAN_SPECS)) {
      expect(spec.price!.yearly).toBe(spec.price!.monthly * 10);
    }
  });

  it('lo Starter non ha AI, Analytics, report giornaliero e post-partita', () => {
    expect(PLAN_SPECS.STARTER.features).toEqual({
      ai: false, analytics: false, dailyReport: false, gameReport: false, reports: true, adaptations: true,
    });
    expect(PLAN_SPECS.PROFESSIONAL.features.ai).toBe(true);
  });

  it('la prova ha la capienza dello Starter, le funzioni avanzate e niente AI', () => {
    expect(TRIAL_SPEC).toMatchObject({ teams: 1, athletesPerTeam: 12, seats: 1, aiCredits: 0, extensions: false });
    expect(TRIAL_SPEC.features).toEqual({
      ai: false, analytics: true, dailyReport: true, gameReport: false, reports: false, adaptations: false,
    });
  });

  it('le estensioni esistono solo su Ultra e Club', () => {
    expect(PLAN_SPECS.STARTER.extensions).toBe(false);
    expect(PLAN_SPECS.PROFESSIONAL.extensions).toBe(false);
    expect(PLAN_SPECS.ULTRA.extensions).toBe(true);
    expect(PLAN_SPECS.CLUB.extensions).toBe(true);
  });
});

describe('interruttore', () => {
  it('spento di default, acceso solo con "true"', () => {
    expect(isPlanEnforcementEnabled({})).toBe(false);
    expect(isPlanEnforcementEnabled({ PLAN_ENFORCEMENT: '1' })).toBe(false);
    expect(isPlanEnforcementEnabled({ PLAN_ENFORCEMENT: 'true' })).toBe(true);
  });
});

describe('resolvePlan', () => {
  it('account storico: mai applicato, anche a interruttore acceso', () => {
    const p = resolvePlan(org({ planLegacy: true, tier: 'ULTRA' }), NOW, true);
    expect(p.mode).toBe('legacy');
    expect(p.enforced).toBe(false);
    expect(p.readOnly).toBe(false);
  });

  it('interruttore spento: nessun limite applicato, ma lo stato si calcola', () => {
    const p = resolvePlan(org({ trialEndsAt: new Date(NOW.getTime() - DAY) }), NOW, false);
    expect(p.mode).toBe('expired');
    expect(p.enforced).toBe(false);
    expect(p.readOnly).toBe(false);
  });

  it('prova in corso: limiti della prova e giorni rimasti', () => {
    const p = resolvePlan(org({ tier: 'STARTER', trialEndsAt: new Date(NOW.getTime() + 3.2 * DAY) }), NOW, true);
    expect(p.mode).toBe('trial');
    expect(p.trialDaysLeft).toBe(4);
    expect(p.limits).toEqual({ teams: 1, athletesPerTeam: 12, seats: 1, aiCredits: 0 });
    expect(p.features.analytics).toBe(true);
    expect(p.features.ai).toBe(false);
    expect(p.features.reports).toBe(false);
    expect(p.features.adaptations).toBe(false);
    expect(() => assertFeature(p, 'reports')).toThrow(PlanLimitError);
    expect(() => assertFeature(p, 'adaptations')).toThrow(PlanLimitError);
    expect(p.readOnly).toBe(false);
  });

  it('prova scaduta: sola lettura', () => {
    const p = resolvePlan(org({ trialEndsAt: new Date(NOW.getTime() - 1000) }), NOW, true);
    expect(p.mode).toBe('expired');
    expect(p.readOnly).toBe(true);
    expect(p.trialDaysLeft).toBe(0);
  });

  it('piano attivo: limiti del tier', () => {
    const p = resolvePlan(org({ tier: 'PROFESSIONAL' }), NOW, true);
    expect(p.mode).toBe('active');
    expect(p.limits).toEqual({ teams: 2, athletesPerTeam: 14, seats: 1, aiCredits: 200 });
  });

  it('squadre aggiuntive: contano su Ultra e Club, con 100 crediti AI ciascuna', () => {
    const ultra = resolvePlan(org({ tier: 'ULTRA', extraTeams: 2 }), NOW, true);
    expect(ultra.limits.teams).toBe(6);
    expect(ultra.limits.aiCredits).toBe(700);
    const club = resolvePlan(org({ tier: 'CLUB', extraTeams: 1 }), NOW, true);
    expect(club.limits.teams).toBe(7);
    expect(club.limits.aiCredits).toBe(850);
  });

  it("estensioni su un piano che non le prevede: non si contano", () => {
    const p = resolvePlan(org({ tier: 'PROFESSIONAL', extraTeams: 3 }), NOW, true);
    expect(p.limits.teams).toBe(2);
    expect(p.limits.aiCredits).toBe(200);
  });

  it('tier sconosciuto: il minimo', () => {
    expect(normalizeTier('enterprise')).toBe('STARTER');
    expect(normalizeTier('club')).toBe('CLUB');
    expect(resolvePlan(org({ tier: 'boh' }), NOW, true).limits.teams).toBe(1);
  });
});

describe('capienza delle squadre', () => {
  it('pacchetti da 5 atleti solo dove esistono le estensioni', () => {
    const club = resolvePlan(org({ tier: 'CLUB' }), NOW, true);
    expect(teamCapacity(club, 0)).toBe(20);
    expect(teamCapacity(club, 2)).toBe(30);
    const pro = resolvePlan(org({ tier: 'PROFESSIONAL' }), NOW, true);
    expect(teamCapacity(pro, 2)).toBe(14);
  });
});

describe('funzioni', () => {
  it('assertFeature blocca solo se il piano e\' applicato', () => {
    const starter = resolvePlan(org({ tier: 'STARTER' }), NOW, true);
    expect(() => assertFeature(starter, 'analytics')).toThrow(PlanLimitError);
    const off = resolvePlan(org({ tier: 'STARTER' }), NOW, false);
    expect(() => assertFeature(off, 'analytics')).not.toThrow();
    const legacy = resolvePlan(org({ tier: 'STARTER', planLegacy: true }), NOW, true);
    expect(() => assertFeature(legacy, 'ai')).not.toThrow();
  });

  it("l'errore porta il codice che l'interfaccia traduce", () => {
    const starter = resolvePlan(org({ tier: 'STARTER' }), NOW, true);
    try {
      assertFeature(starter, 'dailyReport');
    } catch (err) {
      expect((err as PlanLimitError).code).toBe('PLAN_FEATURE_UNAVAILABLE');
      expect((err as PlanLimitError).details).toEqual({ feature: 'dailyReport' });
    }
  });
});

describe('date', () => {
  it('il mese dei crediti parte dal primo giorno, in UTC', () => {
    expect(monthStart(NOW).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
  it('la prova dura 15 giorni', () => {
    expect(trialEndDate(NOW).getTime() - NOW.getTime()).toBe(15 * DAY);
  });
});

describe('posti storici', () => {
  it("restano quelli di prima, con il Club a 4", () => {
    expect(LEGACY_SEATS_BY_TIER).toEqual({ STARTER: 1, PROFESSIONAL: 2, ULTRA: 4, CLUB: 4 });
  });
});

describe('sola lettura', () => {
  // Nessuna di queste richieste deve arrivare al database: o l'interruttore
  // e' spento, o il metodo/la rotta sono esenti. Un client finto che esplode
  // se interrogato lo dimostra.
  const prismaThatMustNotBeCalled = new Proxy({}, {
    get() {
      throw new Error('database interrogato senza motivo');
    },
  }) as never;

  function req(method: string, url: string): FastifyRequest {
    return { method, url, routeOptions: { url }, user: { organizationId: 'o1' } } as unknown as FastifyRequest;
  }

  it('interruttore spento: mai', async () => {
    const before = process.env.PLAN_ENFORCEMENT;
    delete process.env.PLAN_ENFORCEMENT;
    await expect(readOnlyViolation(prismaThatMustNotBeCalled, req('POST', '/api/v1/teams'))).resolves.toBeNull();
    if (before !== undefined) process.env.PLAN_ENFORCEMENT = before;
  });

  it('letture ed esenzioni: mai, anche a interruttore acceso', async () => {
    const before = process.env.PLAN_ENFORCEMENT;
    process.env.PLAN_ENFORCEMENT = 'true';
    try {
      await expect(readOnlyViolation(prismaThatMustNotBeCalled, req('GET', '/api/v1/teams'))).resolves.toBeNull();
      await expect(readOnlyViolation(prismaThatMustNotBeCalled, req('POST', '/api/v1/billing/activate'))).resolves.toBeNull();
      await expect(readOnlyViolation(prismaThatMustNotBeCalled, req('POST', '/api/v1/auth/logout'))).resolves.toBeNull();
      await expect(readOnlyViolation(prismaThatMustNotBeCalled, req('POST', '/api/v1/gdpr/export'))).resolves.toBeNull();
    } finally {
      if (before === undefined) delete process.env.PLAN_ENFORCEMENT;
      else process.env.PLAN_ENFORCEMENT = before;
    }
  });

  it('prova scaduta e interruttore acceso: le scritture sono bloccate', async () => {
    const before = process.env.PLAN_ENFORCEMENT;
    process.env.PLAN_ENFORCEMENT = 'true';
    const fakePrisma = {
      organization: {
        findUnique: async () => ({ tier: 'STARTER', planLegacy: false, trialEndsAt: new Date(Date.now() - DAY), extraTeams: 0, extraSeats: 0 }),
      },
    } as never;
    try {
      const v = await readOnlyViolation(fakePrisma, req('POST', '/api/v1/teams'));
      expect(v?.code).toBe('PLAN_READ_ONLY');
    } finally {
      if (before === undefined) delete process.env.PLAN_ENFORCEMENT;
      else process.env.PLAN_ENFORCEMENT = before;
    }
  });
});

describe('prova gratuita: un solo report giornaliero', () => {
  type Rows = Array<{ teamId: string; date: Date }>;
  const fake = (orgRow: OrgPlanRow, rows: Rows) =>
    ({
      organization: { findUnique: async () => orgRow },
      dailyReport: { findMany: async () => rows },
    }) as unknown as Parameters<typeof assertTrialDailyReport>[0];
  const trial = org({ trialEndsAt: new Date(Date.now() + 5 * DAY) });
  const one: Rows = [{ teamId: 't1', date: new Date('2026-10-09T00:00:00.000Z') }];

  async function enforced(fn: () => Promise<void>) {
    const before = process.env.PLAN_ENFORCEMENT;
    process.env.PLAN_ENFORCEMENT = 'true';
    try {
      await fn();
    } finally {
      if (before === undefined) delete process.env.PLAN_ENFORCEMENT;
      else process.env.PLAN_ENFORCEMENT = before;
    }
  }

  it('il primo si compone, poi si riapre solo quello', () =>
    enforced(async () => {
      expect(TRIAL_DAILY_REPORTS).toBe(1);
      await expect(assertTrialDailyReport(fake(trial, []), 'o', 't1', '2026-10-09')).resolves.toBeUndefined();
      await expect(assertTrialDailyReport(fake(trial, one), 'o', 't1', '2026-10-09')).resolves.toBeUndefined();
      await expect(assertTrialDailyReport(fake(trial, one), 'o', 't1', '2026-10-10')).rejects.toMatchObject({
        code: 'PLAN_TRIAL_REPORT_LIMIT',
        details: { limit: 1, teamId: 't1', date: '2026-10-09' },
      });
      await expect(assertTrialDailyReport(fake(trial, one), 'o', 't2', '2026-10-09')).rejects.toMatchObject({
        code: 'PLAN_TRIAL_REPORT_LIMIT',
      });
    }));

  it("l'export vuole il report gia' salvato", () =>
    enforced(async () => {
      await expect(
        assertTrialDailyReport(fake(trial, []), 'o', 't1', '2026-10-09', { requireSaved: true }),
      ).rejects.toMatchObject({ code: 'PLAN_TRIAL_REPORT_SAVE_FIRST' });
      await expect(
        assertTrialDailyReport(fake(trial, one), 'o', 't1', '2026-10-09', { requireSaved: true }),
      ).resolves.toBeUndefined();
    }));

  it('vale anche a prova scaduta, non nei piani a pagamento ne\' a interruttore spento', async () => {
    const expired = org({ trialEndsAt: new Date(Date.now() - DAY) });
    await enforced(async () => {
      await expect(assertTrialDailyReport(fake(expired, one), 'o', 't1', '2026-10-10')).rejects.toMatchObject({
        code: 'PLAN_TRIAL_REPORT_LIMIT',
      });
      await expect(
        assertTrialDailyReport(fake(org({ tier: 'PROFESSIONAL' }), one), 'o', 't1', '2026-10-10'),
      ).resolves.toBeUndefined();
    });
    const before = process.env.PLAN_ENFORCEMENT;
    delete process.env.PLAN_ENFORCEMENT;
    try {
      await expect(assertTrialDailyReport(fake(trial, one), 'o', 't1', '2026-10-10')).resolves.toBeUndefined();
    } finally {
      if (before !== undefined) process.env.PLAN_ENFORCEMENT = before;
    }
  });
});
