/**
 * TrainMind AI — Seed "Prima Squadra" per account preparatori (MM, VDB)
 *
 * Per ogni organizzazione target crea:
 * - 1 squadra "Prima Squadra" con 14 giocatori senior (roster diversi per org)
 * - Test fisici completi (10 tipi) x 6 date di valutazione (15/08/2025 → 30/06/2026)
 * - 4 piani di periodizzazione (Pre-Season, Campionato, Playoff, Off-Season)
 * - Piani di allenamento con settimane, sessioni ed esercizi collegati
 * - Wellness log giornalieri per tutta la stagione (fino a oggi)
 * - 3 infortuni realistici per squadra con protocolli RTP e criteri di clearance
 *
 * Run: pnpm --filter @trainmind/db exec tsx prisma/seed-team14.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_ORGS = ['MM', 'VDB', 'AG', 'RP'];

const SEASON_START = new Date('2025-08-15');
const SEASON_END = new Date('2026-08-14');

// ─── Helpers ──────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── Roster (14 giocatori senior per org) ─────────────────

interface PlayerDef { first: string; last: string; pos: string; dob: string; h: number; w: number; jersey: number }

const ROSTERS: Record<string, PlayerDef[]> = {
  MM: [
    { first: 'Alessandro', last: 'Baldini', pos: 'PG', dob: '1999-03-12', h: 183, w: 80, jersey: 0 },
    { first: 'Marco', last: 'Sartori', pos: 'PG', dob: '2002-07-04', h: 180, w: 76, jersey: 5 },
    { first: 'Luca', last: 'Ferraro', pos: 'SG', dob: '1998-11-21', h: 191, w: 88, jersey: 7 },
    { first: 'Davide', last: 'Callegari', pos: 'SG', dob: '2001-02-14', h: 188, w: 85, jersey: 9 },
    { first: 'Matteo', last: 'Righi', pos: 'SG', dob: '2003-05-30', h: 186, w: 82, jersey: 11 },
    { first: 'Andrea', last: 'Trevisan', pos: 'SF', dob: '1997-09-08', h: 198, w: 95, jersey: 8 },
    { first: 'Simone', last: 'Battaglia', pos: 'SF', dob: '2000-12-17', h: 196, w: 93, jersey: 13 },
    { first: 'Giulio', last: 'Piras', pos: 'SF', dob: '2004-01-26', h: 194, w: 89, jersey: 21 },
    { first: 'Federico', last: 'Zanetti', pos: 'PF', dob: '1996-06-03', h: 203, w: 104, jersey: 15 },
    { first: 'Riccardo', last: 'Donati', pos: 'PF', dob: '1999-10-11', h: 201, w: 101, jersey: 18 },
    { first: 'Tommaso', last: 'Cavalli', pos: 'PF', dob: '2002-04-22', h: 200, w: 98, jersey: 24 },
    { first: 'Stefano', last: 'Marchesi', pos: 'C', dob: '1995-08-19', h: 208, w: 112, jersey: 14 },
    { first: 'Nicola', last: 'Bortolotti', pos: 'C', dob: '2000-03-07', h: 206, w: 108, jersey: 33 },
    { first: 'Gabriele', last: 'Fanti', pos: 'C', dob: '2003-11-02', h: 205, w: 105, jersey: 44 },
  ],
  VDB: [
    { first: 'Pietro', last: 'Guarnieri', pos: 'PG', dob: '1998-05-16', h: 184, w: 81, jersey: 1 },
    { first: 'Emanuele', last: 'Costantini', pos: 'PG', dob: '2001-09-27', h: 181, w: 77, jersey: 6 },
    { first: 'Filippo', last: 'Bellini', pos: 'SG', dob: '1997-12-05', h: 190, w: 87, jersey: 10 },
    { first: 'Giacomo', last: 'Serafini', pos: 'SG', dob: '2000-04-18', h: 189, w: 86, jersey: 12 },
    { first: 'Lorenzo', last: 'Pagani', pos: 'SG', dob: '2003-08-09', h: 187, w: 83, jersey: 20 },
    { first: 'Christian', last: 'Vidal', pos: 'SF', dob: '1996-02-23', h: 197, w: 94, jersey: 17 },
    { first: 'Daniele', last: 'Orsini', pos: 'SF', dob: '1999-07-31', h: 195, w: 92, jersey: 23 },
    { first: 'Antonio', last: 'Farina', pos: 'SF', dob: '2002-10-13', h: 193, w: 90, jersey: 25 },
    { first: 'Michele', last: 'Cattaneo', pos: 'PF', dob: '1995-11-28', h: 204, w: 106, jersey: 16 },
    { first: 'Enrico', last: 'Spadoni', pos: 'PF', dob: '1998-01-15', h: 202, w: 103, jersey: 19 },
    { first: 'Samuele', last: 'Grimaldi', pos: 'PF', dob: '2001-06-06', h: 199, w: 97, jersey: 22 },
    { first: 'Roberto', last: 'Milani', pos: 'C', dob: '1994-04-09', h: 209, w: 114, jersey: 34 },
    { first: 'Fabio', last: 'Nardini', pos: 'C', dob: '1999-12-24', h: 207, w: 110, jersey: 35 },
    { first: 'Edoardo', last: 'Vaccaro', pos: 'C', dob: '2002-02-11', h: 205, w: 106, jersey: 55 },
  ],
  AG: [
    { first: 'Vincenzo', last: 'Rizzo', pos: 'PG', dob: '1999-01-20', h: 182, w: 79, jersey: 3 },
    { first: 'Alessio', last: 'Fiorentini', pos: 'PG', dob: '2002-06-11', h: 179, w: 75, jersey: 8 },
    { first: 'Marco', last: 'Cortesi', pos: 'SG', dob: '1997-04-03', h: 192, w: 88, jersey: 14 },
    { first: 'Nicolò', last: 'Bertani', pos: 'SG', dob: '2000-08-25', h: 190, w: 85, jersey: 16 },
    { first: 'Federico', last: 'Rossetti', pos: 'SG', dob: '2003-02-07', h: 188, w: 84, jersey: 22 },
    { first: 'Luca', last: 'Mazzoni', pos: 'SF', dob: '1996-10-29', h: 198, w: 96, jersey: 27 },
    { first: 'Giacomo', last: 'Innocenti', pos: 'SF', dob: '1999-05-14', h: 196, w: 92, jersey: 29 },
    { first: 'Manuel', last: 'De Santis', pos: 'SF', dob: '2002-11-08', h: 194, w: 90, jersey: 31 },
    { first: 'Davide', last: 'Perri', pos: 'PF', dob: '1995-03-17', h: 203, w: 105, jersey: 33 },
    { first: 'Simone', last: 'Rocca', pos: 'PF', dob: '1998-08-21', h: 201, w: 100, jersey: 36 },
    { first: 'Andrea', last: 'Marconi', pos: 'PF', dob: '2001-12-02', h: 200, w: 98, jersey: 41 },
    { first: 'Paolo', last: 'Longo', pos: 'C', dob: '1995-07-04', h: 210, w: 115, jersey: 45 },
    { first: 'Cristiano', last: 'Ferretti', pos: 'C', dob: '2000-01-29', h: 208, w: 111, jersey: 50 },
    { first: 'Gianluca', last: 'Baldassarre', pos: 'C', dob: '2003-09-18', h: 206, w: 107, jersey: 54 },
  ],
  RP: [
    { first: 'Salvatore', last: 'Esposito', pos: 'PG', dob: '1998-07-13', h: 183, w: 80, jersey: 4 },
    { first: 'Giuseppe', last: 'Aiello', pos: 'PG', dob: '2001-04-26', h: 180, w: 76, jersey: 9 },
    { first: 'Vito', last: 'Palumbo', pos: 'SG', dob: '1997-08-19', h: 191, w: 87, jersey: 13 },
    { first: 'Rosario', last: 'Grasso', pos: 'SG', dob: '2000-11-05', h: 189, w: 85, jersey: 15 },
    { first: 'Antonio', last: 'De Rosa', pos: 'SG', dob: '2003-03-30', h: 187, w: 82, jersey: 19 },
    { first: 'Gaetano', last: 'Coppola', pos: 'SF', dob: '1996-05-12', h: 197, w: 94, jersey: 26 },
    { first: 'Ciro', last: 'Cirillo', pos: 'SF', dob: '1999-09-24', h: 195, w: 91, jersey: 28 },
    { first: 'Emilio', last: 'Ruggiero', pos: 'SF', dob: '2002-06-17', h: 193, w: 89, jersey: 32 },
    { first: 'Antonello', last: 'Iovine', pos: 'PF', dob: '1994-12-08', h: 205, w: 107, jersey: 37 },
    { first: 'Franco', last: 'Migliore', pos: 'PF', dob: '1998-02-15', h: 203, w: 102, jersey: 40 },
    { first: 'Aldo', last: 'Napolitano', pos: 'PF', dob: '2001-10-27', h: 200, w: 99, jersey: 42 },
    { first: 'Massimiliano', last: 'D\'Amico', pos: 'C', dob: '1994-06-21', h: 211, w: 116, jersey: 48 },
    { first: 'Renato', last: 'Barbato', pos: 'C', dob: '1999-11-11', h: 208, w: 112, jersey: 52 },
    { first: 'Umberto', last: 'Santagata', pos: 'C', dob: '2002-04-04', h: 206, w: 108, jersey: 56 },
  ],
};

// ─── Test fisici (10 tipi) — range senior ─────────────────

const METRIC_TYPES = [
  { type: 'vertical_jump', unit: 'cm', guardRange: [48, 65], bigRange: [40, 58] },
  { type: 'sprint_20m', unit: 's', guardRange: [2.75, 3.05], bigRange: [2.95, 3.35] },
  { type: 'agility_t_test', unit: 's', guardRange: [8.6, 9.8], bigRange: [9.2, 10.5] },
  { type: 'body_fat', unit: '%', guardRange: [7, 12], bigRange: [9, 15] },
  { type: 'vo2max', unit: 'ml/kg/min', guardRange: [52, 62], bigRange: [46, 56] },
  { type: 'bench_press_1rm', unit: 'kg', guardRange: [80, 115], bigRange: [95, 140] },
  { type: 'squat_1rm', unit: 'kg', guardRange: [120, 165], bigRange: [140, 200] },
  { type: 'standing_reach', unit: 'cm', guardRange: [235, 252], bigRange: [255, 280] },
  { type: 'wingspan', unit: 'cm', guardRange: [185, 200], bigRange: [200, 222] },
  { type: 'hand_span', unit: 'cm', guardRange: [21, 24], bigRange: [23, 27] },
];

// 6 date di valutazione lungo la stagione
const MEASURE_DATES = [
  new Date('2025-08-18'), // Test d'ingresso pre-season
  new Date('2025-10-13'), // Fine preparazione
  new Date('2025-12-15'), // Metà andata
  new Date('2026-02-16'), // Metà ritorno
  new Date('2026-04-20'), // Pre-playoff
  new Date('2026-06-22'), // Chiusura stagione
];
// NB: niente test in date future rispetto a oggi — sarebbero poco credibili.

// ─── Periodizzazione (3 piani, 15/08/2025 → ~30/06/2026) ──

const PHASES_CONFIG: Record<string, { color: string }> = {
  PREPARATION: { color: '#14b8a6' },
  SPECIFIC: { color: '#f59e0b' },
  COMPETITION: { color: '#ef4444' },
  TRANSITION: { color: '#8b5cf6' },
  TAPER: { color: '#3b82f6' },
  RECOVERY: { color: '#22c55e' },
};

function intensityFromLoad(load: number): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' {
  if (load < 40) return 'VERY_LOW';
  if (load < 60) return 'LOW';
  if (load < 75) return 'MODERATE';
  if (load < 90) return 'HIGH';
  return 'VERY_HIGH';
}

interface MesoCfg { name: string; phase: 'PREPARATION' | 'SPECIFIC' | 'COMPETITION' | 'TRANSITION' | 'TAPER' | 'RECOVERY'; weeks: number; load: number }
interface PeriCfg { name: string; type: 'BLOCK' | 'UNDULATING' | 'LINEAR'; start: string; weeks: number; mesocycles: MesoCfg[] }

const PERI_CONFIGS: PeriCfg[] = [
  {
    name: 'Pre-Season 2025/26',
    type: 'BLOCK',
    start: '2025-08-15',
    weeks: 9,
    mesocycles: [
      { name: 'Preparazione Generale', phase: 'PREPARATION', weeks: 3, load: 70 },
      { name: 'Forza & Potenza', phase: 'SPECIFIC', weeks: 4, load: 85 },
      { name: 'Pre-Campionato', phase: 'TAPER', weeks: 2, load: 60 },
    ],
  },
  {
    name: 'Campionato 2025/26',
    type: 'UNDULATING',
    start: '2025-10-17',
    weeks: 26,
    mesocycles: [
      { name: 'Andata Fase 1', phase: 'COMPETITION', weeks: 6, load: 85 },
      { name: 'Recupero Natale', phase: 'RECOVERY', weeks: 2, load: 45 },
      { name: 'Andata Fase 2', phase: 'COMPETITION', weeks: 5, load: 88 },
      { name: 'Scarico Febbraio', phase: 'TAPER', weeks: 1, load: 55 },
      { name: 'Ritorno Fase 1', phase: 'COMPETITION', weeks: 6, load: 90 },
      { name: 'Ritorno Fase 2', phase: 'COMPETITION', weeks: 5, load: 92 },
      { name: 'Scarico Pre-Playoff', phase: 'TAPER', weeks: 1, load: 50 },
    ],
  },
  {
    name: 'Playoff & Transizione 2026',
    type: 'LINEAR',
    start: '2026-04-17',
    weeks: 10,
    mesocycles: [
      { name: 'Playoff', phase: 'SPECIFIC', weeks: 4, load: 92 },
      { name: 'Scarico Post-Playoff', phase: 'TAPER', weeks: 1, load: 45 },
      { name: 'Transizione Attiva', phase: 'TRANSITION', weeks: 3, load: 40 },
      { name: 'Recupero Estivo', phase: 'RECOVERY', weeks: 2, load: 30 },
    ],
  },
  {
    name: 'Off-Season Estate 2026',
    type: 'LINEAR',
    start: '2026-06-26',
    weeks: 7,
    mesocycles: [
      { name: 'Ricostruzione Base', phase: 'PREPARATION', weeks: 3, load: 55 },
      { name: 'Sviluppo Forza Estivo', phase: 'SPECIFIC', weeks: 3, load: 70 },
      { name: 'Rientro Graduale', phase: 'RECOVERY', weeks: 1, load: 40 },
    ],
  },
];

const SESSION_TYPES = [
  'Forza & Condizionamento',
  'Tecnica individuale',
  'Tattica di squadra',
  'Tiro e finalizzazione',
  'Agilità e velocità',
  'Pliometria',
  'Recupero attivo',
  'Scrimmage',
  'Video analisi + campo',
];

// ─── Seed per singola organizzazione ──────────────────────

async function seedOrg(orgName: string) {
  console.log(`\n══════════ ORG: ${orgName} ══════════`);

  const org = await prisma.organization.findFirst({ where: { name: orgName } });
  if (!org) {
    console.error(`❌ Organizzazione "${orgName}" non trovata — salto.`);
    return;
  }
  const admin = await prisma.user.findFirst({ where: { organizationId: org.id, role: 'ADMIN' } });
  if (!admin) {
    console.error(`❌ Nessun ADMIN per "${orgName}" — salto.`);
    return;
  }
  const orgId = org.id;
  console.log(`✅ ${org.name} — admin: ${admin.email}`);

  // Cleanup scoped (per poter rilanciare lo script senza duplicati).
  // NB: NON tocca la libreria esercizi di default creata alla registrazione.
  console.log('🧹 Pulizia dati precedenti...');
  await prisma.sessionExercise.deleteMany({ where: { trainingSession: { organizationId: orgId } } });
  await prisma.sessionLog.deleteMany({ where: { trainingSession: { organizationId: orgId } } });
  await prisma.trainingSession.deleteMany({ where: { organizationId: orgId } });
  await prisma.week.deleteMany({ where: { trainingPlan: { organizationId: orgId } } });
  await prisma.trainingPlan.deleteMany({ where: { organizationId: orgId } });
  await prisma.simulation.deleteMany({ where: { periodizationPlan: { organizationId: orgId } } });
  await prisma.microcycle.deleteMany({ where: { mesocycle: { periodizationPlan: { organizationId: orgId } } } });
  await prisma.mesocycle.deleteMany({ where: { periodizationPlan: { organizationId: orgId } } });
  await prisma.periodizationPlan.deleteMany({ where: { organizationId: orgId } });
  await prisma.wellnessLog.deleteMany({ where: { athlete: { organizationId: orgId } } });
  await prisma.metric.deleteMany({ where: { athlete: { organizationId: orgId } } });
  await prisma.clearanceCriteria.deleteMany({ where: { rtpProtocol: { athlete: { organizationId: orgId } } } });
  await prisma.rTPPhaseLog.deleteMany({ where: { rtpProtocol: { athlete: { organizationId: orgId } } } });
  await prisma.rTPProtocol.deleteMany({ where: { athlete: { organizationId: orgId } } });
  await prisma.injury.deleteMany({ where: { athlete: { organizationId: orgId } } });
  await prisma.athleteTeam.deleteMany({ where: { team: { organizationId: orgId } } });
  await prisma.athleteInvite.deleteMany({ where: { organizationId: orgId } });
  await prisma.athlete.deleteMany({ where: { organizationId: orgId } });
  await prisma.team.deleteMany({ where: { organizationId: orgId } });

  // 1. Squadra
  const team = await prisma.team.create({
    data: {
      name: 'Prima Squadra',
      description: 'Prima squadra senior — stagione 2025/26',
      color: '#ef4444',
      organizationId: orgId,
    },
  });
  console.log(`👥 Squadra: ${team.name}`);

  // 2. Giocatori
  const roster = ROSTERS[orgName];
  const athletes: Array<{ id: string; pos: string }> = [];
  for (const p of roster) {
    const a = await prisma.athlete.create({
      data: {
        firstName: p.first,
        lastName: p.last,
        position: p.pos,
        dateOfBirth: new Date(p.dob),
        height: p.h,
        weight: p.w,
        jerseyNumber: p.jersey,
        organizationId: orgId,
      },
    });
    await prisma.athleteTeam.create({ data: { athleteId: a.id, teamId: team.id } });
    athletes.push({ id: a.id, pos: p.pos });
  }
  console.log(`🏃 Atleti: ${athletes.length}`);

  // 3. Test fisici (tutti i tipi x 6 date, con progressione stagionale)
  const metricBatch: Array<{ athleteId: string; date: Date; type: string; value: number; unit: string }> = [];
  for (const athlete of athletes) {
    const isGuard = ['PG', 'SG'].includes(athlete.pos);
    for (let mIdx = 0; mIdx < MEASURE_DATES.length; mIdx++) {
      const progressFactor = 1 + mIdx * 0.015; // lieve miglioramento nel corso della stagione
      for (const mt of METRIC_TYPES) {
        const range = isGuard ? mt.guardRange : mt.bigRange;
        const isTimeBased = mt.unit === 's';
        let value = rand(range[0], range[1]);
        if (isTimeBased) value /= progressFactor; // tempi più bassi = meglio
        else if (!['standing_reach', 'wingspan', 'hand_span'].includes(mt.type)) value *= progressFactor;
        metricBatch.push({
          athleteId: athlete.id,
          date: MEASURE_DATES[mIdx],
          type: mt.type,
          value: Math.round(value * 100) / 100,
          unit: mt.unit,
        });
      }
    }
  }
  await prisma.metric.createMany({ data: metricBatch });
  console.log(`📏 Test: ${metricBatch.length} (${athletes.length} atleti × ${MEASURE_DATES.length} date × ${METRIC_TYPES.length} tipi)`);

  // 4. Libreria esercizi dell'org (creata alla registrazione), raggruppata per categoria
  const orgExercises = await prisma.exercise.findMany({ where: { organizationId: orgId } });
  const exercisesByCategory: Record<string, Array<{ id: string; category: string }>> = {};
  for (const ex of orgExercises) {
    const cat = ex.category || 'ALTRO';
    if (!exercisesByCategory[cat]) exercisesByCategory[cat] = [];
    exercisesByCategory[cat].push({ id: ex.id, category: cat });
  }
  const allCategories = Object.keys(exercisesByCategory);
  console.log(`📋 Esercizi disponibili: ${orgExercises.length} (categorie: ${allCategories.join(', ') || 'nessuna'})`);

  function pickExercises(preferredCats: string[], count: number): string[] {
    const ids: string[] = [];
    const cats = preferredCats.filter((c) => exercisesByCategory[c]?.length);
    const pool = cats.length ? cats : allCategories;
    let guard = 0;
    while (ids.length < count && pool.length && guard < 50) {
      guard++;
      const cat = pick(pool);
      const ex = pick(exercisesByCategory[cat]);
      if (!ids.includes(ex.id)) ids.push(ex.id);
    }
    return ids;
  }

  const typeToCategories: Record<string, string[]> = {
    'Forza & Condizionamento': ['FORZA', 'CARDIO'],
    'Tecnica individuale': ['TECNICA'],
    'Tattica di squadra': ['TECNICA'],
    'Tiro e finalizzazione': ['TECNICA'],
    'Agilità e velocità': ['CARDIO', 'PLIOMETRIA'],
    Pliometria: ['PLIOMETRIA', 'FORZA'],
    'Recupero attivo': ['MOBILITA'],
    Scrimmage: ['TECNICA', 'CARDIO'],
    'Video analisi + campo': ['TECNICA'],
  };

  // 5. Periodizzazioni + piani + sessioni
  const now = new Date();
  let totalSessions = 0;
  let totalSessionExercises = 0;

  for (const cfg of PERI_CONFIGS) {
    const startDate = new Date(cfg.start);
    const endDate = addDays(startDate, cfg.weeks * 7 - 1);

    const periPlan = await prisma.periodizationPlan.create({
      data: {
        name: cfg.name,
        type: cfg.type,
        startDate,
        endDate,
        totalWeeks: cfg.weeks,
        organizationId: orgId,
        createdById: admin.id,
        teamId: team.id,
      },
    });

    const trainingPlan = await prisma.trainingPlan.create({
      data: {
        name: `${cfg.name} — Piano Allenamento`,
        startDate,
        endDate,
        organizationId: orgId,
        createdById: admin.id,
        teamId: team.id,
        periodizationPlanId: periPlan.id,
      },
    });

    let mesoOrder = 0;
    let globalWeekNum = 0;
    for (const mesoCfg of cfg.mesocycles) {
      const meso = await prisma.mesocycle.create({
        data: {
          periodizationPlanId: periPlan.id,
          orderIndex: mesoOrder,
          name: mesoCfg.name,
          phase: mesoCfg.phase,
          durationWeeks: mesoCfg.weeks,
          targetLoadPercent: mesoCfg.load,
          color: PHASES_CONFIG[mesoCfg.phase].color,
        },
      });

      for (let w = 1; w <= mesoCfg.weeks; w++) {
        globalWeekNum++;
        const isDeload = w === mesoCfg.weeks && mesoCfg.weeks >= 3;
        let loadPct: number;
        if (isDeload) {
          loadPct = 60;
        } else {
          const progWeeks = mesoCfg.weeks >= 3 ? mesoCfg.weeks - 1 : mesoCfg.weeks;
          const t = progWeeks <= 1 ? 1 : (w - 1) / (progWeeks - 1);
          loadPct = Math.round(75 + t * 25);
        }
        const scaledLoad = Math.round((loadPct * mesoCfg.load) / 100);
        const focusPool = ['forza', 'velocità', 'agilità', 'resistenza', 'tiro', 'tattica', 'tecnica', 'pliometria'];
        const focusAreas = [pick(focusPool), pick(focusPool)].filter((v, i, a) => a.indexOf(v) === i);

        const micro = await prisma.microcycle.create({
          data: {
            mesocycleId: meso.id,
            weekNumber: w,
            loadPercent: scaledLoad,
            intensity: intensityFromLoad(scaledLoad),
            sessionsCount: isDeload ? 3 : randInt(4, 6),
            focusAreas,
            isDeload,
          },
        });

        const weekStart = addDays(startDate, (globalWeekNum - 1) * 7);
        const week = await prisma.week.create({
          data: {
            weekNumber: globalWeekNum,
            trainingPlanId: trainingPlan.id,
            microcycleId: micro.id,
            notes: `${mesoCfg.name} — Sett. ${w}${isDeload ? ' (Scarico)' : ''}`,
          },
        });

        const sessCount = micro.sessionsCount;
        const daysOfWeek = [1, 2, 3, 4, 5, 6];
        const selectedDays = daysOfWeek.slice(0, sessCount);

        for (let s = 0; s < sessCount; s++) {
          const sessionDate = addDays(weekStart, selectedDays[s] ?? s);
          const sessionType = pick(SESSION_TYPES);
          const isPast = sessionDate < now;

          const session = await prisma.trainingSession.create({
            data: {
              title: `${sessionType} — ${mesoCfg.name}`,
              date: sessionDate,
              duration: isDeload ? randInt(45, 60) : randInt(60, 120),
              status: isPast ? 'COMPLETED' : 'PLANNED',
              rpe: isPast ? (isDeload ? randInt(3, 5) : randInt(5, 9)) : null,
              notes: `Intensità: ${micro.intensity}. Carico: ${scaledLoad}%. Focus: ${focusAreas.join(', ')}.`,
              weekId: week.id,
              organizationId: orgId,
              isTemplate: false,
            },
          });
          totalSessions++;

          const exIds = pickExercises(typeToCategories[sessionType] || [], randInt(3, 5));
          for (let eIdx = 0; eIdx < exIds.length; eIdx++) {
            await prisma.sessionExercise.create({
              data: {
                trainingSessionId: session.id,
                exerciseId: exIds[eIdx],
                orderIndex: eIdx,
                sets: randInt(2, 5),
                reps: `${randInt(6, 15)}`,
                weight: Math.random() < 0.4 ? rand(20, 100) : null,
                duration: Math.random() < 0.4 ? randInt(30, 120) : null,
                restTime: randInt(60, 180),
              },
            });
            totalSessionExercises++;
          }
        }
      }
      mesoOrder++;
    }
    console.log(`📅 ${cfg.name}: ${cfg.weeks} settimane`);
  }
  console.log(`💪 Sessioni: ${totalSessions} (${totalSessionExercises} esercizi collegati)`);

  // 6. Infortuni realistici (3 giocatori) con protocolli RTP
  console.log('🩹 Creazione infortuni...');

  interface InjuryCfg {
    athleteIdx: number;
    type: string;
    location: string;
    severity: number;
    occurred: string;
    resolved: string | null; // null = ancora in corso
    rtpPhase: 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4' | 'PHASE_5' | 'CLEARED';
    notes: string;
  }

  const INJURY_CONFIGS: InjuryCfg[] = [
    {
      athleteIdx: 4, // esterno
      type: 'Distorsione',
      location: 'Caviglia destra',
      severity: 2,
      occurred: '2025-11-08',
      resolved: '2025-12-01',
      rtpPhase: 'CLEARED',
      notes: 'Distorsione in ricaduta da rimbalzo durante partita. Trattamento conservativo, tutore per 10 giorni.',
    },
    {
      athleteIdx: 9, // lungo
      type: 'Stiramento',
      location: 'Ischiocrurali sinistri',
      severity: 3,
      occurred: '2026-02-14',
      resolved: '2026-03-25',
      rtpPhase: 'CLEARED',
      notes: 'Lesione di I-II grado in sprint di transizione. Ecografia a 5gg, ripresa graduale con protocollo RTP completo.',
    },
    {
      athleteIdx: 12, // centro
      type: 'Tendinopatia',
      location: 'Tendine rotuleo destro',
      severity: 2,
      occurred: '2026-06-10',
      resolved: null, // ancora in gestione
      rtpPhase: 'PHASE_3',
      notes: 'Jumper\'s knee da sovraccarico di fine stagione. Gestione del carico + rinforzo eccentrico in corso.',
    },
  ];

  const RTP_CRITERIA: Record<string, string[]> = {
    PHASE_1: ['Dolore a riposo assente', 'ROM completo senza dolore'],
    PHASE_2: ['Camminata/corsa leggera senza dolore', 'Forza >70% arto controlaterale'],
    PHASE_3: ['Corsa progressiva e cambi di direzione senza dolore', 'Forza >85% arto controlaterale'],
    PHASE_4: ['Allenamento completo senza contatto tollerato', 'Test funzionali >90%'],
    PHASE_5: ['Allenamento completo con contatto tollerato', 'Idoneità medica al rientro in gara'],
  };
  const PHASE_ORDER = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'] as const;

  for (const cfg of INJURY_CONFIGS) {
    const athlete = athletes[cfg.athleteIdx];
    const occurred = new Date(cfg.occurred);
    const resolved = cfg.resolved ? new Date(cfg.resolved) : null;

    const injury = await prisma.injury.create({
      data: {
        athleteId: athlete.id,
        type: cfg.type,
        location: cfg.location,
        severity: cfg.severity,
        status: resolved ? 'RESOLVED' : 'RECOVERING',
        dateOccurred: occurred,
        dateResolved: resolved,
        notes: cfg.notes,
      },
    });

    const rtpStart = addDays(occurred, 3);
    const rtpTarget = resolved ?? addDays(occurred, 45);
    const protocol = await prisma.rTPProtocol.create({
      data: {
        injuryId: injury.id,
        athleteId: athlete.id,
        currentPhase: cfg.rtpPhase,
        startDate: rtpStart,
        targetDate: rtpTarget,
        notes: `Protocollo RTP — ${cfg.type} ${cfg.location.toLowerCase()}`,
      },
    });

    // Log di avanzamento fase + criteri di clearance
    const reachedIdx = PHASE_ORDER.indexOf(cfg.rtpPhase);
    const totalDaysRtp = Math.max(7, Math.floor((rtpTarget.getTime() - rtpStart.getTime()) / 86400000));
    for (let i = 0; i < PHASE_ORDER.length - 1 && i < reachedIdx; i++) {
      const changeDate = addDays(rtpStart, Math.round(((i + 1) / (PHASE_ORDER.length - 1)) * totalDaysRtp));
      await prisma.rTPPhaseLog.create({
        data: {
          rtpProtocolId: protocol.id,
          fromPhase: PHASE_ORDER[i],
          toPhase: PHASE_ORDER[i + 1],
          changedById: admin.id,
          reason: `Criteri fase ${i + 1} soddisfatti — avanzamento`,
          createdAt: changeDate,
        },
      });
    }

    for (let p = 0; p < 5; p++) {
      const phase = PHASE_ORDER[p] as 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4' | 'PHASE_5';
      const phaseCompleted = p < reachedIdx;
      for (const desc of RTP_CRITERIA[phase]) {
        await prisma.clearanceCriteria.create({
          data: {
            rtpProtocolId: protocol.id,
            phase,
            description: desc,
            isMet: phaseCompleted,
            metAt: phaseCompleted ? addDays(rtpStart, Math.round(((p + 1) / 5) * totalDaysRtp)) : null,
            metById: phaseCompleted ? admin.id : null,
          },
        });
      }
    }

    const roster14 = ROSTERS[orgName][cfg.athleteIdx];
    console.log(`   ${roster14.first} ${roster14.last}: ${cfg.type} ${cfg.location} (${resolved ? 'risolto' : 'in corso — ' + cfg.rtpPhase})`);
  }

  // 6b. Wellness log giornalieri (intera stagione)
  const endCap = SEASON_END > now ? now : SEASON_END;
  const totalDays = Math.floor((endCap.getTime() - SEASON_START.getTime()) / 86400000) + 1;
  const CHUNK_SIZE = 500;
  let wellnessTotal = 0;

  for (const athlete of athletes) {
    const baseSleep = rand(6.5, 8.5);
    const baseSleepQ = randInt(3, 4);
    const baseFatigue = randInt(2, 3);
    const baseSoreness = randInt(2, 3);
    const baseStress = randInt(2, 3);
    const baseMood = randInt(3, 4);

    const chunk: Array<{
      athleteId: string; date: Date; sleepHours: number; sleepQuality: number;
      fatigue: number; soreness: number; stress: number; mood: number; notes: string | null;
    }> = [];

    for (let d = 0; d < totalDays; d++) {
      const date = addDays(SEASON_START, d);
      const dayOfWeek = date.getDay();
      const isBadDay = Math.random() < 0.1;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isLateWeek = dayOfWeek >= 4;
      const isGameDay = dayOfWeek === 6;

      let fatigueMod = 0, sorenessMod = 0, moodMod = 0, stressMod = 0;
      if (isWeekend) { fatigueMod = -1; moodMod = 1; }
      if (isLateWeek) { fatigueMod = 1; sorenessMod = 1; }
      if (isGameDay) { stressMod = 1; moodMod = 1; }
      if (isBadDay) { fatigueMod += 1; sorenessMod += 1; moodMod -= 1; stressMod += 1; }

      chunk.push({
        athleteId: athlete.id,
        date: new Date(date.toISOString().slice(0, 10) + 'T07:00:00.000Z'),
        sleepHours: clamp(baseSleep + rand(-1, 1), 4, 10),
        sleepQuality: clamp(baseSleepQ + (isBadDay ? -1 : randInt(-1, 1)), 1, 5),
        fatigue: clamp(baseFatigue + fatigueMod + randInt(-1, 1), 1, 5),
        soreness: clamp(baseSoreness + sorenessMod + randInt(-1, 1), 1, 5),
        stress: clamp(baseStress + stressMod + randInt(-1, 1), 1, 5),
        mood: clamp(baseMood + moodMod + randInt(-1, 1), 1, 5),
        notes: isBadDay
          ? pick(['Notte insonne', 'Mal di testa', 'Poco appetito', 'Stanco mentalmente', 'Dolore muscolare', 'Raffreddore', 'Mal di schiena', 'Ansia pre-partita'])
          : null,
      });
    }

    for (let i = 0; i < chunk.length; i += CHUNK_SIZE) {
      await prisma.wellnessLog.createMany({ data: chunk.slice(i, i + CHUNK_SIZE), skipDuplicates: true });
    }
    wellnessTotal += chunk.length;
  }
  console.log(`❤️  Wellness log: ${wellnessTotal} (${totalDays} giorni × ${athletes.length} atleti)`);
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log('🏀 TrainMind — Seed Prima Squadra (14 giocatori, stagione 2025/26)');
  console.log(`   Stagione: ${SEASON_START.toISOString().slice(0, 10)} → ${SEASON_END.toISOString().slice(0, 10)}`);
  for (const orgName of TARGET_ORGS) {
    await seedOrg(orgName);
  }
  console.log('\n✅ Seed completato per tutte le organizzazioni.');
}

main()
  .catch((e) => {
    console.error('❌ Seed fallito:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
