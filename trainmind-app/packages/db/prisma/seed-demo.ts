/**
 * TrainMind — Demo Seed Script (Full Season)
 *
 * Creates realistic demo data for user alessandro.vispa@gmail.com:
 * - 3 teams: Under 14 (12), Under 16 (12), Under 18 (15 athletes)
 * - Anthropometric + performance metrics per athlete (5 measurement dates)
 * - 8 periodization plans (3 team A, 3 team B, 2 team C) spanning 15/08/2025 → 15/06/2026
 * - Training plans + sessions for every periodization
 * - Exercise library + session exercises
 * - 12 session templates with exercises
 * - Daily wellness logs for every athlete across the full season
 *
 * Run: cd packages/db && npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// ─── Data Definitions ─────────────────────────────────────

// Team A — Under 14 (12 players)
const TEAM_A_PLAYERS = [
  { first: 'Marco', last: 'Rossi', pos: 'PG', dob: '2011-03-15', h: 158, w: 48, jersey: 1 },
  { first: 'Luca', last: 'Bianchi', pos: 'SG', dob: '2011-07-22', h: 162, w: 52, jersey: 3 },
  { first: 'Andrea', last: 'Ferrari', pos: 'SF', dob: '2011-01-10', h: 168, w: 56, jersey: 5 },
  { first: 'Matteo', last: 'Romano', pos: 'PF', dob: '2011-11-05', h: 172, w: 60, jersey: 7 },
  { first: 'Alessandro', last: 'Colombo', pos: 'C', dob: '2011-05-18', h: 176, w: 65, jersey: 11 },
  { first: 'Davide', last: 'Ricci', pos: 'PG', dob: '2011-09-28', h: 155, w: 46, jersey: 2 },
  { first: 'Federico', last: 'Marino', pos: 'SG', dob: '2011-04-12', h: 164, w: 54, jersey: 4 },
  { first: 'Simone', last: 'Greco', pos: 'SF', dob: '2011-08-01', h: 166, w: 56, jersey: 6 },
  { first: 'Lorenzo', last: 'Bruno', pos: 'PF', dob: '2011-12-20', h: 170, w: 58, jersey: 8 },
  { first: 'Gabriele', last: 'Gallo', pos: 'C', dob: '2011-02-14', h: 175, w: 63, jersey: 13 },
  { first: 'Tommaso', last: 'Conti', pos: 'SG', dob: '2011-06-30', h: 160, w: 50, jersey: 10 },
  { first: 'Filippo', last: 'Esposito', pos: 'SF', dob: '2011-10-08', h: 165, w: 55, jersey: 12 },
];

// Team B — Under 16 (12 players)
const TEAM_B_PLAYERS = [
  { first: 'Riccardo', last: 'Mancini', pos: 'PG', dob: '2009-02-20', h: 172, w: 62, jersey: 1 },
  { first: 'Nicola', last: 'Barbieri', pos: 'SG', dob: '2009-06-14', h: 176, w: 66, jersey: 3 },
  { first: 'Stefano', last: 'Moretti', pos: 'SF', dob: '2009-09-03', h: 180, w: 70, jersey: 5 },
  { first: 'Pietro', last: 'Fontana', pos: 'PF', dob: '2009-01-25', h: 184, w: 76, jersey: 7 },
  { first: 'Emanuele', last: 'Santoro', pos: 'C', dob: '2009-04-17', h: 190, w: 82, jersey: 11 },
  { first: 'Giovanni', last: 'Mariani', pos: 'PG', dob: '2009-08-08', h: 170, w: 60, jersey: 2 },
  { first: 'Antonio', last: 'Rinaldi', pos: 'SG', dob: '2009-11-22', h: 174, w: 64, jersey: 4 },
  { first: 'Francesco', last: 'Caruso', pos: 'SF', dob: '2009-03-11', h: 178, w: 68, jersey: 6 },
  { first: 'Christian', last: 'Ferrara', pos: 'PF', dob: '2009-07-29', h: 182, w: 74, jersey: 8 },
  { first: 'Daniele', last: 'Costa', pos: 'C', dob: '2009-12-05', h: 188, w: 80, jersey: 13 },
  { first: 'Giacomo', last: 'Giordano', pos: 'SG', dob: '2009-05-19', h: 173, w: 63, jersey: 10 },
  { first: 'Edoardo', last: 'Leone', pos: 'SF', dob: '2009-10-01', h: 177, w: 67, jersey: 12 },
];

// Team C — Under 18 (15 players)
const TEAM_C_PLAYERS = [
  { first: 'Michele', last: 'Vitale', pos: 'PG', dob: '2007-01-12', h: 180, w: 72, jersey: 1 },
  { first: 'Samuele', last: 'Lombardi', pos: 'SG', dob: '2007-05-25', h: 184, w: 76, jersey: 3 },
  { first: 'Giorgio', last: 'Moretti', pos: 'SF', dob: '2007-09-18', h: 190, w: 82, jersey: 5 },
  { first: 'Enrico', last: 'Marchetti', pos: 'PF', dob: '2007-03-07', h: 194, w: 88, jersey: 7 },
  { first: 'Vincenzo', last: 'Palmieri', pos: 'C', dob: '2007-07-14', h: 200, w: 94, jersey: 11 },
  { first: 'Roberto', last: 'Fabbri', pos: 'PG', dob: '2007-11-29', h: 178, w: 70, jersey: 2 },
  { first: 'Claudio', last: 'Pellegrini', pos: 'SG', dob: '2007-04-02', h: 182, w: 74, jersey: 4 },
  { first: 'Massimo', last: 'Serra', pos: 'SF', dob: '2007-08-20', h: 188, w: 80, jersey: 6 },
  { first: 'Diego', last: 'Benedetti', pos: 'PF', dob: '2007-12-15', h: 192, w: 86, jersey: 8 },
  { first: 'Fabio', last: 'De Luca', pos: 'C', dob: '2007-02-08', h: 198, w: 92, jersey: 13 },
  { first: 'Paolo', last: 'Testa', pos: 'PG', dob: '2007-06-11', h: 176, w: 68, jersey: 9 },
  { first: 'Carlo', last: 'Amato', pos: 'SG', dob: '2007-10-24', h: 183, w: 75, jersey: 10 },
  { first: 'Valerio', last: 'Silvestri', pos: 'SF', dob: '2008-01-16', h: 187, w: 79, jersey: 12 },
  { first: 'Alessio', last: 'Gentile', pos: 'PF', dob: '2008-05-30', h: 191, w: 85, jersey: 14 },
  { first: 'Ivan', last: 'Russo', pos: 'C', dob: '2008-09-07', h: 196, w: 90, jersey: 15 },
];

// Metric types
const METRIC_TYPES = [
  { type: 'vertical_jump', unit: 'cm', guardRange: [35, 50], bigRange: [30, 45] },
  { type: 'sprint_20m', unit: 's', guardRange: [2.9, 3.3], bigRange: [3.1, 3.6] },
  { type: 'agility_t_test', unit: 's', guardRange: [9.2, 10.8], bigRange: [9.8, 11.2] },
  { type: 'body_fat', unit: '%', guardRange: [8, 14], bigRange: [10, 16] },
  { type: 'vo2max', unit: 'ml/kg/min', guardRange: [46, 56], bigRange: [42, 52] },
  { type: 'bench_press_1rm', unit: 'kg', guardRange: [40, 70], bigRange: [55, 90] },
  { type: 'squat_1rm', unit: 'kg', guardRange: [70, 110], bigRange: [90, 140] },
  { type: 'standing_reach', unit: 'cm', guardRange: [210, 230], bigRange: [230, 260] },
  { type: 'wingspan', unit: 'cm', guardRange: [170, 190], bigRange: [190, 215] },
  { type: 'hand_span', unit: 'cm', guardRange: [19, 23], bigRange: [22, 26] },
];

// Exercise library
const EXERCISES = [
  // FORZA
  { name: 'Squat', category: 'FORZA', muscleGroups: ['quadricipiti', 'glutei'], equipment: ['bilanciere'], videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8' },
  { name: 'Stacco rumeno', category: 'FORZA', muscleGroups: ['femorali', 'glutei', 'lombari'], equipment: ['bilanciere'] },
  { name: 'Panca piana', category: 'FORZA', muscleGroups: ['petto', 'tricipiti', 'deltoidi'], equipment: ['bilanciere', 'panca'] },
  { name: 'Trazioni alla sbarra', category: 'FORZA', muscleGroups: ['dorsali', 'bicipiti'], equipment: ['sbarra'] },
  { name: 'Military press', category: 'FORZA', muscleGroups: ['deltoidi', 'tricipiti'], equipment: ['bilanciere'] },
  { name: 'Leg press', category: 'FORZA', muscleGroups: ['quadricipiti', 'glutei'], equipment: ['leg press'] },
  { name: 'Rematore con bilanciere', category: 'FORZA', muscleGroups: ['dorsali', 'bicipiti', 'trapezio'], equipment: ['bilanciere'] },
  { name: 'Bulgarian split squat', category: 'FORZA', muscleGroups: ['quadricipiti', 'glutei'], equipment: ['manubri'] },
  // CARDIO
  { name: 'Corsa continua', category: 'CARDIO', muscleGroups: ['cardiovascolare'], equipment: [] },
  { name: 'Interval training 30/30', category: 'CARDIO', muscleGroups: ['cardiovascolare'], equipment: [] },
  { name: 'Fartlek', category: 'CARDIO', muscleGroups: ['cardiovascolare'], equipment: [] },
  { name: 'Suicide drill', category: 'CARDIO', muscleGroups: ['cardiovascolare'], equipment: [] },
  // PLIOMETRIA
  { name: 'Box jump', category: 'PLIOMETRIA', muscleGroups: ['quadricipiti', 'polpacci'], equipment: ['box'], videoUrl: 'https://www.youtube.com/watch?v=52r_Ul5k03g' },
  { name: 'Depth jump', category: 'PLIOMETRIA', muscleGroups: ['quadricipiti', 'polpacci'], equipment: ['box'] },
  { name: 'Salto in lungo da fermo', category: 'PLIOMETRIA', muscleGroups: ['quadricipiti', 'glutei'], equipment: [] },
  { name: 'Tuck jump', category: 'PLIOMETRIA', muscleGroups: ['quadricipiti', 'core'], equipment: [] },
  // MOBILITA
  { name: 'Foam rolling', category: 'MOBILITA', muscleGroups: ['tutto il corpo'], equipment: ['foam roller'] },
  { name: 'Stretching dinamico', category: 'MOBILITA', muscleGroups: ['tutto il corpo'], equipment: [] },
  { name: 'Mobilità anche', category: 'MOBILITA', muscleGroups: ['flessori anca', 'glutei'], equipment: [] },
  { name: 'Mobilità spalle', category: 'MOBILITA', muscleGroups: ['deltoidi', 'cuffia rotatori'], equipment: ['banda elastica'] },
  // TECNICA
  { name: 'Tiro da 3 punti', category: 'TECNICA', muscleGroups: [], equipment: ['pallone'], videoUrl: 'https://www.youtube.com/watch?v=qKk1rR7l3zQ' },
  { name: 'Palleggio in velocità', category: 'TECNICA', muscleGroups: [], equipment: ['pallone'] },
  { name: 'Passaggio a due mani', category: 'TECNICA', muscleGroups: [], equipment: ['pallone'] },
  { name: 'Lay-up destro e sinistro', category: 'TECNICA', muscleGroups: [], equipment: ['pallone'] },
  { name: 'Pick and roll', category: 'TECNICA', muscleGroups: [], equipment: ['pallone'] },
  { name: 'Difesa 1vs1', category: 'TECNICA', muscleGroups: [], equipment: [] },
  { name: 'Tiri liberi', category: 'TECNICA', muscleGroups: [], equipment: ['pallone'] },
  { name: 'Transizione veloce 3vs2', category: 'TECNICA', muscleGroups: [], equipment: ['pallone'] },
];

// Session type configs (for session naming and exercise selection)
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

// Phases
const PHASES_CONFIG: Record<string, { loadTarget: number; color: string }> = {
  PREPARATION: { loadTarget: 70, color: '#14b8a6' },
  SPECIFIC: { loadTarget: 85, color: '#f59e0b' },
  COMPETITION: { loadTarget: 90, color: '#ef4444' },
  TRANSITION: { loadTarget: 50, color: '#8b5cf6' },
  TAPER: { loadTarget: 60, color: '#3b82f6' },
  RECOVERY: { loadTarget: 40, color: '#22c55e' },
};

function intensityFromLoad(load: number): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' {
  if (load < 40) return 'VERY_LOW';
  if (load < 60) return 'LOW';
  if (load < 75) return 'MODERATE';
  if (load < 90) return 'HIGH';
  return 'VERY_HIGH';
}

// ─── Periodization Configs ────────────────────────────────
// 8 plans: 3 per Team A (U14), 3 per Team B (U16), 2 per Team C (U18)
// All span 15/08/2025 → 15/06/2026

interface MesoCfg {
  name: string;
  phase: 'PREPARATION' | 'SPECIFIC' | 'COMPETITION' | 'TRANSITION' | 'TAPER' | 'RECOVERY';
  weeks: number;
  load: number;
}

interface PeriCfg {
  name: string;
  teamKey: 'A' | 'B' | 'C';
  type: 'BLOCK' | 'UNDULATING' | 'LINEAR' | 'REVERSE_LINEAR' | 'CONJUGATE';
  start: string;
  weeks: number;
  mesocycles: MesoCfg[];
}

const periConfigs: PeriCfg[] = [
  // ═══ TEAM A — Under 14 (3 plans) ═══
  {
    name: 'Pre-Season Under 14',
    teamKey: 'A',
    type: 'BLOCK',
    start: '2025-08-15',
    weeks: 10,
    mesocycles: [
      { name: 'Preparazione Generale', phase: 'PREPARATION', weeks: 3, load: 65 },
      { name: 'Preparazione Specifica', phase: 'SPECIFIC', weeks: 4, load: 80 },
      { name: 'Pre-Campionato', phase: 'COMPETITION', weeks: 2, load: 85 },
      { name: 'Scarico', phase: 'TAPER', weeks: 1, load: 50 },
    ],
  },
  {
    name: 'In-Season Under 14',
    teamKey: 'A',
    type: 'UNDULATING',
    start: '2025-10-24',
    weeks: 22,
    mesocycles: [
      { name: 'Campionato Fase 1', phase: 'COMPETITION', weeks: 5, load: 85 },
      { name: 'Recupero Natale', phase: 'RECOVERY', weeks: 2, load: 45 },
      { name: 'Campionato Fase 2', phase: 'COMPETITION', weeks: 5, load: 88 },
      { name: 'Scarico Febbraio', phase: 'TAPER', weeks: 1, load: 50 },
      { name: 'Campionato Fase 3', phase: 'COMPETITION', weeks: 5, load: 90 },
      { name: 'Playoff', phase: 'SPECIFIC', weeks: 3, load: 92 },
      { name: 'Scarico Finale', phase: 'TAPER', weeks: 1, load: 45 },
    ],
  },
  {
    name: 'Off-Season Under 14',
    teamKey: 'A',
    type: 'LINEAR',
    start: '2026-03-27',
    weeks: 12,
    mesocycles: [
      { name: 'Transizione Attiva', phase: 'TRANSITION', weeks: 3, load: 40 },
      { name: 'Ricostruzione Base', phase: 'PREPARATION', weeks: 4, load: 60 },
      { name: 'Sviluppo Tecnico', phase: 'SPECIFIC', weeks: 3, load: 70 },
      { name: 'Recupero Estivo', phase: 'RECOVERY', weeks: 2, load: 35 },
    ],
  },

  // ═══ TEAM B — Under 16 (3 plans) ═══
  {
    name: 'Pre-Season Under 16',
    teamKey: 'B',
    type: 'BLOCK',
    start: '2025-08-15',
    weeks: 9,
    mesocycles: [
      { name: 'Condizionamento Base', phase: 'PREPARATION', weeks: 3, load: 70 },
      { name: 'Forza & Potenza', phase: 'SPECIFIC', weeks: 4, load: 85 },
      { name: 'Tapering', phase: 'TAPER', weeks: 2, load: 55 },
    ],
  },
  {
    name: 'In-Season Under 16',
    teamKey: 'B',
    type: 'UNDULATING',
    start: '2025-10-17',
    weeks: 24,
    mesocycles: [
      { name: 'Campionato Fase 1', phase: 'COMPETITION', weeks: 5, load: 85 },
      { name: 'Recupero Attivo', phase: 'RECOVERY', weeks: 2, load: 45 },
      { name: 'Campionato Fase 2', phase: 'COMPETITION', weeks: 5, load: 90 },
      { name: 'Scarico Invernale', phase: 'TAPER', weeks: 1, load: 50 },
      { name: 'Campionato Fase 3', phase: 'COMPETITION', weeks: 5, load: 92 },
      { name: 'Playoff', phase: 'SPECIFIC', weeks: 4, load: 88 },
      { name: 'Transizione', phase: 'TRANSITION', weeks: 2, load: 40 },
    ],
  },
  {
    name: 'Off-Season Under 16',
    teamKey: 'B',
    type: 'LINEAR',
    start: '2026-04-03',
    weeks: 11,
    mesocycles: [
      { name: 'Rigenerazione', phase: 'RECOVERY', weeks: 2, load: 35 },
      { name: 'Ricostruzione Atletica', phase: 'PREPARATION', weeks: 4, load: 65 },
      { name: 'Sviluppo Specifico', phase: 'SPECIFIC', weeks: 3, load: 75 },
      { name: 'Pausa Estiva', phase: 'TRANSITION', weeks: 2, load: 30 },
    ],
  },

  // ═══ TEAM C — Under 18 (2 plans) ═══
  {
    name: 'Pre-Season + Campionato U18',
    teamKey: 'C',
    type: 'BLOCK',
    start: '2025-08-15',
    weeks: 19,
    mesocycles: [
      { name: 'Preparazione Atletica', phase: 'PREPARATION', weeks: 3, load: 70 },
      { name: 'Forza Massimale', phase: 'SPECIFIC', weeks: 4, load: 90 },
      { name: 'Integrazione Tattica', phase: 'SPECIFIC', weeks: 3, load: 85 },
      { name: 'Pre-Campionato', phase: 'COMPETITION', weeks: 2, load: 88 },
      { name: 'Campionato Fase 1', phase: 'COMPETITION', weeks: 5, load: 90 },
      { name: 'Scarico Dicembre', phase: 'TAPER', weeks: 2, load: 50 },
    ],
  },
  {
    name: 'Campionato + Transizione U18',
    teamKey: 'C',
    type: 'UNDULATING',
    start: '2025-12-29',
    weeks: 24,
    mesocycles: [
      { name: 'Campionato Fase 2', phase: 'COMPETITION', weeks: 5, load: 88 },
      { name: 'Recupero Invernale', phase: 'RECOVERY', weeks: 2, load: 45 },
      { name: 'Campionato Fase 3', phase: 'COMPETITION', weeks: 5, load: 92 },
      { name: 'Playoff', phase: 'SPECIFIC', weeks: 4, load: 90 },
      { name: 'Scarico Post-Playoff', phase: 'TAPER', weeks: 1, load: 45 },
      { name: 'Transizione Estiva', phase: 'TRANSITION', weeks: 3, load: 40 },
      { name: 'Mantenimento', phase: 'PREPARATION', weeks: 4, load: 55 },
    ],
  },
];

// Template sessions with exercise mapping
const SESSION_TEMPLATES = [
  { title: 'Forza — Upper Body', duration: 75, notes: 'Focus su panca, trazioni e shoulder press', exercises: ['Panca piana', 'Trazioni alla sbarra', 'Military press', 'Rematore con bilanciere'] },
  { title: 'Forza — Lower Body', duration: 80, notes: 'Squat, stacco, leg press', exercises: ['Squat', 'Stacco rumeno', 'Leg press', 'Bulgarian split squat'] },
  { title: 'Potenza esplosiva', duration: 60, notes: 'Pliometria e olympic lifts', exercises: ['Box jump', 'Depth jump', 'Squat', 'Tuck jump'] },
  { title: 'Agilità e velocità', duration: 70, notes: 'Agility ladder, sprint, cambi di direzione', exercises: ['Suicide drill', 'Interval training 30/30'] },
  { title: 'Core e stabilità', duration: 45, notes: 'Plank, anti-rotation, pallof press', exercises: ['Mobilità anche', 'Mobilità spalle'] },
  { title: 'Recupero attivo', duration: 40, notes: 'Foam rolling, stretching dinamico, mobilità', exercises: ['Foam rolling', 'Stretching dinamico', 'Mobilità anche', 'Mobilità spalle'] },
  { title: 'Tecnica individuale', duration: 90, notes: 'Tiro, palleggio, passaggi', exercises: ['Tiro da 3 punti', 'Palleggio in velocità', 'Passaggio a due mani', 'Lay-up destro e sinistro'] },
  { title: 'Scrimmage', duration: 80, notes: 'Partitella con focus tattico', exercises: ['Pick and roll', 'Difesa 1vs1', 'Transizione veloce 3vs2'] },
  { title: 'Video analisi + campo', duration: 100, notes: 'Analisi video seguita da esercitazioni', exercises: ['Pick and roll', 'Difesa 1vs1'] },
  { title: 'Pliometria', duration: 55, notes: 'Box jump, depth jump, salti reattivi', exercises: ['Box jump', 'Depth jump', 'Salto in lungo da fermo', 'Tuck jump'] },
  { title: 'Prevenzione infortuni', duration: 50, notes: 'Rinforzo caviglie, ginocchia, core profondo', exercises: ['Mobilità anche', 'Mobilità spalle', 'Stretching dinamico'] },
  { title: 'Tiro e finalizzazione', duration: 85, notes: 'Tiro da varie posizioni, liberi, pick&roll', exercises: ['Tiro da 3 punti', 'Tiri liberi', 'Lay-up destro e sinistro', 'Pick and roll'] },
];

// ─── Main Seed ────────────────────────────────────────────

async function main() {
  console.log('🏀 TrainMind Demo Seed — Full Season 2025/26\n');

  // 1. Find user
  const user = await prisma.user.findUnique({
    where: { email: 'alessandro.vispa@gmail.com' },
    include: { organization: true },
  });

  if (!user) {
    console.error('❌ User alessandro.vispa@gmail.com not found. Register first, then re-run.');
    process.exit(1);
  }

  const orgId = user.organizationId;
  const userId = user.id;
  console.log(`✅ User: ${user.firstName} ${user.lastName} (org: ${user.organization.name})\n`);

  // 2. Clean existing demo data
  console.log('🧹 Cleaning existing data...');
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
  await prisma.planAdaptation.deleteMany({ where: { organizationId: orgId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.exercise.deleteMany({ where: { organizationId: orgId } });
  await prisma.athleteTeam.deleteMany({ where: { team: { organizationId: orgId } } });
  await prisma.athlete.deleteMany({ where: { organizationId: orgId } });
  await prisma.team.deleteMany({ where: { organizationId: orgId } });
  console.log('   Done.\n');

  // ═══════════════════════════════════════════════════════
  // 3. TEAMS
  // ═══════════════════════════════════════════════════════
  console.log('👥 Creating 3 teams...');

  const teamA = await prisma.team.create({
    data: { name: 'Under 14', description: 'Squadra Under 14 maschile — annata 2011', color: '#14b8a6', organizationId: orgId },
  });
  const teamB = await prisma.team.create({
    data: { name: 'Under 16', description: 'Squadra Under 16 maschile — annata 2009', color: '#f59e0b', organizationId: orgId },
  });
  const teamC = await prisma.team.create({
    data: { name: 'Under 18', description: 'Squadra Under 18 maschile — annata 2007/08', color: '#ef4444', organizationId: orgId },
  });

  const teamMap: Record<string, typeof teamA> = { A: teamA, B: teamB, C: teamC };
  console.log(`   ${teamA.name}, ${teamB.name}, ${teamC.name}\n`);

  // ═══════════════════════════════════════════════════════
  // 4. ATHLETES
  // ═══════════════════════════════════════════════════════
  console.log('🏃 Creating athletes...');

  const athleteIds: Record<string, string[]> = { A: [], B: [], C: [] };

  async function createAthletes(players: typeof TEAM_A_PLAYERS, teamKey: string, team: typeof teamA) {
    for (const p of players) {
      const a = await prisma.athlete.create({
        data: {
          firstName: p.first, lastName: p.last, position: p.pos,
          dateOfBirth: new Date(p.dob), height: p.h, weight: p.w,
          jerseyNumber: p.jersey, organizationId: orgId,
        },
      });
      await prisma.athleteTeam.create({ data: { athleteId: a.id, teamId: team.id } });
      athleteIds[teamKey].push(a.id);
    }
  }

  await createAthletes(TEAM_A_PLAYERS, 'A', teamA);
  await createAthletes(TEAM_B_PLAYERS, 'B', teamB);
  await createAthletes(TEAM_C_PLAYERS, 'C', teamC);

  const allPlayers = [
    ...TEAM_A_PLAYERS.map((p, i) => ({ ...p, id: athleteIds.A[i], teamKey: 'A' })),
    ...TEAM_B_PLAYERS.map((p, i) => ({ ...p, id: athleteIds.B[i], teamKey: 'B' })),
    ...TEAM_C_PLAYERS.map((p, i) => ({ ...p, id: athleteIds.C[i], teamKey: 'C' })),
  ];
  const allAthleteIds = allPlayers.map((p) => p.id);

  console.log(`   ${TEAM_A_PLAYERS.length} → ${teamA.name}`);
  console.log(`   ${TEAM_B_PLAYERS.length} → ${teamB.name}`);
  console.log(`   ${TEAM_C_PLAYERS.length} → ${teamC.name}`);
  console.log(`   Totale: ${allAthleteIds.length} atleti\n`);

  // ═══════════════════════════════════════════════════════
  // 5. EXERCISES
  // ═══════════════════════════════════════════════════════
  console.log('📋 Creating exercise library...');

  const exerciseMap: Record<string, string> = {}; // name → id

  for (const ex of EXERCISES) {
    const created = await prisma.exercise.create({
      data: {
        name: ex.name,
        category: ex.category,
        muscleGroups: ex.muscleGroups,
        equipment: ex.equipment,
        videoUrl: ex.videoUrl || null,
        organizationId: orgId,
      },
    });
    exerciseMap[ex.name] = created.id;
  }
  console.log(`   ${EXERCISES.length} esercizi creati\n`);

  // ═══════════════════════════════════════════════════════
  // 6. METRICS (5 measurement dates across season)
  // ═══════════════════════════════════════════════════════
  console.log('📏 Creating metrics...');

  const measureDates = [
    new Date('2025-08-20'), // Pre-season assessment
    new Date('2025-10-25'), // Mid pre-season
    new Date('2026-01-10'), // Mid-season
    new Date('2026-03-15'), // Late season
    new Date('2026-05-20'), // End season
  ];

  const metricBatch: Array<{
    athleteId: string; date: Date; type: string; value: number; unit: string;
  }> = [];

  for (const athlete of allPlayers) {
    const isGuard = ['PG', 'SG'].includes(athlete.pos);
    // Scale ranges by team age (U14 smaller, U18 bigger)
    const ageFactor = athlete.teamKey === 'A' ? 0.85 : athlete.teamKey === 'B' ? 0.95 : 1.0;

    for (let mIdx = 0; mIdx < measureDates.length; mIdx++) {
      const progressFactor = 1 + mIdx * 0.02; // Slight improvement over season
      for (const mt of METRIC_TYPES) {
        const range = isGuard ? mt.guardRange : mt.bigRange;
        // For time-based metrics (lower = better), don't multiply by progressFactor
        const isTimeBased = mt.unit === 's';
        let value = rand(range[0], range[1]) * ageFactor;
        if (!isTimeBased) value *= progressFactor;
        if (isTimeBased) value /= progressFactor; // Faster over season

        metricBatch.push({
          athleteId: athlete.id,
          date: measureDates[mIdx],
          type: mt.type,
          value: Math.round(value * 100) / 100,
          unit: mt.unit,
        });
      }
    }
  }

  await prisma.metric.createMany({ data: metricBatch });
  console.log(`   ${metricBatch.length} metriche create (${allPlayers.length} atleti × 5 date × ${METRIC_TYPES.length} tipi)\n`);

  // ═══════════════════════════════════════════════════════
  // 7. PERIODIZATION PLANS (8 total)
  // ═══════════════════════════════════════════════════════
  console.log('📅 Creating 8 periodization plans...');

  const createdPeriPlans: Array<{ id: string; startDate: Date; endDate: Date; teamKey: string; weeks: number }> = [];

  for (const cfg of periConfigs) {
    const startDate = new Date(cfg.start);
    const endDate = addDays(startDate, cfg.weeks * 7 - 1);
    const team = teamMap[cfg.teamKey];

    const plan = await prisma.periodizationPlan.create({
      data: {
        name: cfg.name,
        type: cfg.type,
        startDate,
        endDate,
        totalWeeks: cfg.weeks,
        organizationId: orgId,
        createdById: userId,
        teamId: team.id,
      },
    });

    let mesoOrder = 0;
    for (const mesoCfg of cfg.mesocycles) {
      const meso = await prisma.mesocycle.create({
        data: {
          periodizationPlanId: plan.id,
          orderIndex: mesoOrder,
          name: mesoCfg.name,
          phase: mesoCfg.phase,
          durationWeeks: mesoCfg.weeks,
          targetLoadPercent: mesoCfg.load,
          color: PHASES_CONFIG[mesoCfg.phase].color,
        },
      });

      for (let w = 1; w <= mesoCfg.weeks; w++) {
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

        await prisma.microcycle.create({
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
      }

      mesoOrder++;
    }

    createdPeriPlans.push({ id: plan.id, startDate, endDate, teamKey: cfg.teamKey, weeks: cfg.weeks });
    console.log(`   ✅ ${cfg.name} — ${cfg.weeks}w, ${cfg.mesocycles.length} mesocicli (${team.name})`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════
  // 8. TRAINING PLANS + SESSIONS + SESSION EXERCISES
  // ═══════════════════════════════════════════════════════
  console.log('💪 Creating training plans, sessions & exercises...');

  // Group exercises by category for smart assignment
  const exercisesByCategory: Record<string, string[]> = {};
  for (const ex of EXERCISES) {
    if (!exercisesByCategory[ex.category]) exercisesByCategory[ex.category] = [];
    exercisesByCategory[ex.category].push(ex.name);
  }

  // Map session type → likely exercise categories
  const typeToCategories: Record<string, string[]> = {
    'Forza & Condizionamento': ['FORZA', 'CARDIO'],
    'Tecnica individuale': ['TECNICA'],
    'Tattica di squadra': ['TECNICA'],
    'Tiro e finalizzazione': ['TECNICA'],
    'Agilità e velocità': ['CARDIO', 'PLIOMETRIA'],
    'Pliometria': ['PLIOMETRIA', 'FORZA'],
    'Recupero attivo': ['MOBILITA'],
    'Scrimmage': ['TECNICA', 'CARDIO'],
    'Video analisi + campo': ['TECNICA'],
  };

  let totalSessions = 0;
  let totalSessionExercises = 0;

  for (const periPlan of createdPeriPlans) {
    const periDetail = await prisma.periodizationPlan.findUnique({
      where: { id: periPlan.id },
      include: {
        mesocycles: {
          include: { microcycles: { orderBy: { weekNumber: 'asc' } } },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!periDetail) continue;

    const team = teamMap[periPlan.teamKey];

    const trainingPlan = await prisma.trainingPlan.create({
      data: {
        name: `${periDetail.name} — Piano Allenamento`,
        startDate: periPlan.startDate,
        endDate: periPlan.endDate,
        organizationId: orgId,
        createdById: userId,
        teamId: team.id,
        periodizationPlanId: periPlan.id,
      },
    });

    let globalWeekNum = 0;
    for (const meso of periDetail.mesocycles) {
      for (const micro of meso.microcycles) {
        globalWeekNum++;
        const weekStart = addDays(periPlan.startDate, (globalWeekNum - 1) * 7);

        const week = await prisma.week.create({
          data: {
            weekNumber: globalWeekNum,
            trainingPlanId: trainingPlan.id,
            microcycleId: micro.id,
            notes: `${meso.name} — Sett. ${micro.weekNumber}${micro.isDeload ? ' (Scarico)' : ''}`,
          },
        });

        const sessCount = micro.sessionsCount;
        const daysOfWeek = [1, 2, 3, 4, 5, 6];
        const selectedDays = daysOfWeek.slice(0, sessCount);

        for (let s = 0; s < sessCount; s++) {
          const sessionDate = addDays(weekStart, selectedDays[s] || s);
          const sessionType = pick(SESSION_TYPES);
          const duration = micro.isDeload ? randInt(45, 60) : randInt(60, 120);
          const rpe = micro.isDeload ? randInt(3, 5) : randInt(5, 9);
          const isPast = sessionDate < new Date();
          const status = isPast ? 'COMPLETED' : 'PLANNED';

          const session = await prisma.trainingSession.create({
            data: {
              title: `${sessionType} — ${meso.name}`,
              date: sessionDate,
              duration,
              status,
              rpe: isPast ? rpe : null,
              notes: `Intensità: ${micro.intensity}. Carico: ${micro.loadPercent}%. Focus: ${micro.focusAreas.join(', ')}.`,
              weekId: week.id,
              organizationId: orgId,
              isTemplate: false,
            },
          });

          // Add exercises to session
          const categories = typeToCategories[sessionType] || ['TECNICA'];
          const exerciseNames: string[] = [];
          for (const cat of categories) {
            const catExercises = exercisesByCategory[cat] || [];
            const count = randInt(2, 3);
            for (let e = 0; e < count && catExercises.length > 0; e++) {
              const exName = pick(catExercises);
              if (!exerciseNames.includes(exName)) exerciseNames.push(exName);
            }
          }

          for (let eIdx = 0; eIdx < exerciseNames.length; eIdx++) {
            const exId = exerciseMap[exerciseNames[eIdx]];
            if (!exId) continue;
            const isStrength = EXERCISES.find((e) => e.name === exerciseNames[eIdx])?.category === 'FORZA';
            await prisma.sessionExercise.create({
              data: {
                trainingSessionId: session.id,
                exerciseId: exId,
                orderIndex: eIdx,
                sets: isStrength ? randInt(3, 5) : randInt(2, 4),
                reps: isStrength ? `${randInt(6, 12)}` : `${randInt(8, 15)}`,
                weight: isStrength ? rand(20, 80) : null,
                duration: !isStrength ? randInt(30, 120) : null,
                restTime: randInt(60, 180),
              },
            });
            totalSessionExercises++;
          }

          totalSessions++;
        }
      }
    }

    console.log(`   ✅ ${trainingPlan.name} — ${globalWeekNum}w`);
  }
  console.log(`   Totale: ${totalSessions} sessioni, ${totalSessionExercises} esercizi-sessione\n`);

  // ═══════════════════════════════════════════════════════
  // 9. SESSION TEMPLATES (with exercises)
  // ═══════════════════════════════════════════════════════
  console.log('📋 Creating session templates...');

  for (const tpl of SESSION_TEMPLATES) {
    const session = await prisma.trainingSession.create({
      data: {
        title: tpl.title,
        duration: tpl.duration,
        notes: tpl.notes,
        isTemplate: true,
        organizationId: orgId,
        status: 'PLANNED',
      },
    });

    for (let i = 0; i < tpl.exercises.length; i++) {
      const exId = exerciseMap[tpl.exercises[i]];
      if (!exId) continue;
      const isStrength = EXERCISES.find((e) => e.name === tpl.exercises[i])?.category === 'FORZA';
      await prisma.sessionExercise.create({
        data: {
          trainingSessionId: session.id,
          exerciseId: exId,
          orderIndex: i,
          sets: isStrength ? randInt(3, 5) : randInt(2, 4),
          reps: isStrength ? `${randInt(6, 12)}` : `${randInt(8, 15)}`,
          weight: isStrength ? rand(30, 80) : null,
          duration: !isStrength ? randInt(30, 120) : null,
          restTime: randInt(60, 180),
        },
      });
    }
  }
  console.log(`   ✅ ${SESSION_TEMPLATES.length} template con esercizi\n`);

  // ═══════════════════════════════════════════════════════
  // 10. WELLNESS LOGS (daily, every athlete, full season)
  // ═══════════════════════════════════════════════════════
  console.log('❤️  Creating wellness logs...');

  const seasonStart = new Date('2025-08-15');
  const seasonEnd = new Date('2026-06-15');
  const today = new Date();
  const endCap = seasonEnd > today ? today : seasonEnd;

  const totalDays = Math.floor((endCap.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  console.log(`   Range: ${seasonStart.toISOString().slice(0, 10)} → ${endCap.toISOString().slice(0, 10)} (${totalDays} giorni)`);
  console.log(`   Atleti: ${allAthleteIds.length} → ~${allAthleteIds.length * totalDays} record`);

  const CHUNK_SIZE = 500;
  let wellnessTotal = 0;

  for (const athleteId of allAthleteIds) {
    const baseSleep = rand(6.5, 8.5);
    const baseSleepQ = randInt(3, 4);
    const baseFatigue = randInt(2, 3);
    const baseSoreness = randInt(2, 3);
    const baseStress = randInt(2, 3);
    const baseMood = randInt(3, 4);

    const chunk: Array<{
      athleteId: string; date: Date;
      sleepHours: number; sleepQuality: number; fatigue: number;
      soreness: number; stress: number; mood: number; notes: string | null;
    }> = [];

    for (let d = 0; d < totalDays; d++) {
      const date = addDays(seasonStart, d);
      const dayOfWeek = date.getDay();

      const isBadDay = Math.random() < 0.1;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isLateWeek = dayOfWeek >= 4;
      // Competition days (Saturday) tend to have higher stress but better mood
      const isGameDay = dayOfWeek === 6;

      let fatigueMod = 0, sorenessMod = 0, moodMod = 0, stressMod = 0;

      if (isWeekend) { fatigueMod = -1; moodMod = 1; }
      if (isLateWeek) { fatigueMod = 1; sorenessMod = 1; }
      if (isGameDay) { stressMod = 1; moodMod = 1; }
      if (isBadDay) { fatigueMod += 1; sorenessMod += 1; moodMod -= 1; stressMod += 1; }

      chunk.push({
        athleteId,
        date: new Date(date.toISOString().slice(0, 10) + 'T07:00:00.000Z'),
        sleepHours: clamp(baseSleep + rand(-1, 1), 4, 10),
        sleepQuality: clamp(baseSleepQ + (isBadDay ? -1 : randInt(-1, 1)), 1, 5),
        fatigue: clamp(baseFatigue + fatigueMod + randInt(-1, 1), 1, 5),
        soreness: clamp(baseSoreness + sorenessMod + randInt(-1, 1), 1, 5),
        stress: clamp(baseStress + stressMod + randInt(-1, 1), 1, 5),
        mood: clamp(baseMood + moodMod + randInt(-1, 1), 1, 5),
        notes: isBadDay ? pick([
          'Notte insonne', 'Mal di testa', 'Poco appetito', 'Stanco mentalmente',
          'Dolore muscolare', 'Raffreddore', 'Mal di schiena', 'Ansia pre-partita',
        ]) : null,
      });
    }

    // Insert in chunks
    for (let i = 0; i < chunk.length; i += CHUNK_SIZE) {
      await prisma.wellnessLog.createMany({
        data: chunk.slice(i, i + CHUNK_SIZE),
        skipDuplicates: true,
      });
    }
    wellnessTotal += chunk.length;
  }

  console.log(`   ✅ ${wellnessTotal} wellness log creati\n`);

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════');
  console.log('✅ DEMO SEED COMPLETO — Stagione 2025/26');
  console.log('═══════════════════════════════════════════');
  console.log(`   Squadre:         3`);
  console.log(`   Atleti:          ${allAthleteIds.length} (12 + 12 + 15)`);
  console.log(`   Esercizi:        ${EXERCISES.length}`);
  console.log(`   Metriche:        ${metricBatch.length}`);
  console.log(`   Periodizzazioni: ${createdPeriPlans.length}`);
  console.log(`   Sessioni:        ${totalSessions}`);
  console.log(`   Esercizi/sess.:  ${totalSessionExercises}`);
  console.log(`   Templates:       ${SESSION_TEMPLATES.length}`);
  console.log(`   Wellness logs:   ${wellnessTotal}`);
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
