// ============================================
// TrainMind AI — Database Seed Script (Sprint 1.5)
// ============================================

import { PrismaClient } from '@prisma/client';
// @ts-expect-error — bcrypt has no bundled types; install @types/bcrypt to remove this
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = resolve(__dirname, '../../../seed');

function loadJSON<T>(filename: string): T {
  const raw = readFileSync(resolve(seedDir, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ─── Types for seed data ────────────────────────────────
interface ExerciseSeed {
  name: string;
  nameEN: string;
  category: string;
  description: string;
  muscleGroups: string[];
  equipment: string[];
  movementPattern?: string;
  difficulty?: string;
  contraindications?: string[];
  variants?: string[];
  loadParameters?: Record<string, string>;
}

// Legacy seed interfaces (PeriodizationModel / PreventionProtocol / RTPProtocolSeed)
// were removed here — they weren't referenced anywhere and triggered TS6196.

// ============================================
// MAIN SEED
// ============================================
async function main() {
  console.log('🌱 Seeding TrainMind AI database...\n');

  // ─── Organization ──────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'basket-demo' },
    update: {},
    create: {
      name: 'ASD Basket Demo',
      slug: 'basket-demo',
      sport: 'basketball',
      tier: 'PROFESSIONAL',
    },
  });
  console.log(`✓ Organization: ${org.name}`);

  // ─── Demo Users ────────────────────────────────────
  const passwordHash = await hashPassword('TrainMind2024!');

  const user = await prisma.user.upsert({
    where: { email: 'trainer@trainmind.demo' },
    update: { passwordHash },
    create: {
      email: 'trainer@trainmind.demo',
      passwordHash,
      firstName: 'Marco',
      lastName: 'Rossi',
      role: 'ADMIN',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log(`✓ User: ${user.firstName} ${user.lastName} (${user.email})`);

  // Medical staff user
  const medUser = await prisma.user.upsert({
    where: { email: 'medico@trainmind.demo' },
    update: { passwordHash },
    create: {
      email: 'medico@trainmind.demo',
      passwordHash,
      firstName: 'Laura',
      lastName: 'Verdi',
      role: 'MEDICAL',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log(`✓ User: ${medUser.firstName} ${medUser.lastName} (${medUser.email})`);

  // Viewer user
  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@trainmind.demo' },
    update: { passwordHash },
    create: {
      email: 'viewer@trainmind.demo',
      passwordHash,
      firstName: 'Paolo',
      lastName: 'Neri',
      role: 'VIEWER',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log(`✓ User: ${viewerUser.firstName} ${viewerUser.lastName} (${viewerUser.email})`);

  // ─── Athletes (10) ─────────────────────────────────
  const athletesData = [
    { firstName: 'Luca', lastName: 'Bianchi', dateOfBirth: new Date('2000-03-15'), position: 'Point Guard', jerseyNumber: 1, height: 185, weight: 78 },
    { firstName: 'Alessandro', lastName: 'Conti', dateOfBirth: new Date('1999-07-22'), position: 'Shooting Guard', jerseyNumber: 5, height: 192, weight: 84 },
    { firstName: 'Davide', lastName: 'Marino', dateOfBirth: new Date('2001-11-08'), position: 'Small Forward', jerseyNumber: 7, height: 198, weight: 90 },
    { firstName: 'Matteo', lastName: 'Ferrari', dateOfBirth: new Date('2000-01-30'), position: 'Power Forward', jerseyNumber: 11, height: 203, weight: 98 },
    { firstName: 'Andrea', lastName: 'Romano', dateOfBirth: new Date('1998-09-12'), position: 'Center', jerseyNumber: 15, height: 208, weight: 105 },
    { firstName: 'Marco', lastName: 'Esposito', dateOfBirth: new Date('2002-05-20'), position: 'Point Guard', jerseyNumber: 3, height: 182, weight: 75 },
    { firstName: 'Federico', lastName: 'Colombo', dateOfBirth: new Date('2001-02-14'), position: 'Shooting Guard', jerseyNumber: 8, height: 190, weight: 82 },
    { firstName: 'Gabriele', lastName: 'Ricci', dateOfBirth: new Date('1999-10-03'), position: 'Small Forward', jerseyNumber: 10, height: 196, weight: 88 },
    { firstName: 'Simone', lastName: 'Moretti', dateOfBirth: new Date('2000-08-28'), position: 'Power Forward', jerseyNumber: 14, height: 201, weight: 95 },
    { firstName: 'Lorenzo', lastName: 'Barbieri', dateOfBirth: new Date('2003-01-11'), position: 'Center', jerseyNumber: 20, height: 210, weight: 108 },
  ];

  const athletes = [];
  for (const data of athletesData) {
    const athlete = await prisma.athlete.upsert({
      where: { id: `seed-athlete-${data.jerseyNumber}` },
      update: {},
      create: {
        id: `seed-athlete-${data.jerseyNumber}`,
        ...data,
        organizationId: org.id,
        isActive: true,
      },
    });
    athletes.push(athlete);
  }
  console.log(`✓ Athletes: ${athletes.length} atleti creati`);

  // ─── Exercises from JSON (115+) ────────────────────
  const exercisesJSON = loadJSON<ExerciseSeed[]>('exercises.json');

  let exerciseCount = 0;
  for (const ex of exercisesJSON) {
    const id = `seed-exercise-${ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;
    await prisma.exercise.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: ex.name,
        category: ex.category,
        description: ex.description || null,
        muscleGroups: ex.muscleGroups,
        equipment: ex.equipment,
        organizationId: org.id,
      },
    });
    exerciseCount++;
  }
  console.log(`✓ Exercises: ${exerciseCount} esercizi importati da JSON`);

  // ─── Wellness Logs (last 14 days for each athlete) ──
  const today = new Date();
  let wellnessCount = 0;
  for (const athlete of athletes) {
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      await prisma.wellnessLog.upsert({
        where: {
          athleteId_date: { athleteId: athlete.id, date },
        },
        update: {},
        create: {
          athleteId: athlete.id,
          date,
          sleepHours: parseFloat((6 + Math.random() * 3).toFixed(1)),
          sleepQuality: Math.ceil(Math.random() * 5),
          fatigue: Math.ceil(Math.random() * 5),
          soreness: Math.ceil(Math.random() * 5),
          stress: Math.ceil(Math.random() * 5),
          mood: Math.ceil(Math.random() * 5),
        },
      });
      wellnessCount++;
    }
  }
  console.log(`✓ Wellness Logs: ${wellnessCount} log creati (14 giorni x ${athletes.length} atleti)`);

  // ─── Training Plans ─────────────────────────────────
  const planStart = new Date();
  planStart.setDate(planStart.getDate() - 7);
  const planEnd = new Date();
  planEnd.setDate(planEnd.getDate() + 21);

  const plan = await prisma.trainingPlan.upsert({
    where: { id: 'seed-plan-preseason' },
    update: {},
    create: {
      id: 'seed-plan-preseason',
      name: 'Preparazione Pre-Stagione 2024/25',
      description: 'Piano di preparazione fisica per la pre-stagione con focus su forza, potenza e condizionamento',
      startDate: planStart,
      endDate: planEnd,
      organizationId: org.id,
      createdById: user.id,
      weeks: {
        create: [
          { id: 'seed-week-1', weekNumber: 1, notes: 'Settimana di adattamento anatomico' },
          { id: 'seed-week-2', weekNumber: 2, notes: 'Incremento volume' },
          { id: 'seed-week-3', weekNumber: 3, notes: 'Incremento intensita' },
          { id: 'seed-week-4', weekNumber: 4, notes: 'Scarico attivo' },
        ],
      },
    },
  });
  console.log(`✓ Training Plan: ${plan.name}`);

  // Sessions for week 1
  const sessionDays = [
    { title: 'Forza - Upper Body', dayOffset: 0 },
    { title: 'Potenza - Lower Body', dayOffset: 1 },
    { title: 'Condizionamento + Core', dayOffset: 3 },
    { title: 'Forza - Full Body', dayOffset: 5 },
  ];

  const week1Start = new Date(planStart);
  for (const sd of sessionDays) {
    const sessionDate = new Date(week1Start);
    sessionDate.setDate(sessionDate.getDate() + sd.dayOffset);

    const session = await prisma.trainingSession.upsert({
      where: { id: `seed-session-w1-${sd.dayOffset}` },
      update: {},
      create: {
        id: `seed-session-w1-${sd.dayOffset}`,
        title: sd.title,
        date: sessionDate,
        duration: 75,
        status: sd.dayOffset <= 1 ? 'COMPLETED' : 'PLANNED',
        rpe: sd.dayOffset <= 1 ? Math.floor(Math.random() * 3) + 6 : undefined,
        weekId: 'seed-week-1',
      },
    });

    if (sd.dayOffset === 0) {
      const upperExercises = ['seed-exercise-bench-press', 'seed-exercise-pull-up', 'seed-exercise-pallof-press'];
      for (let i = 0; i < upperExercises.length; i++) {
        await prisma.sessionExercise.upsert({
          where: { id: `seed-se-w1s0-${i}` },
          update: {},
          create: {
            id: `seed-se-w1s0-${i}`,
            trainingSessionId: session.id,
            exerciseId: upperExercises[i],
            orderIndex: i,
            sets: i === 2 ? 3 : 4,
            reps: i === 2 ? '30s' : '8-10',
            weight: i === 0 ? 70 : i === 1 ? 0 : undefined,
            restTime: 90,
          },
        });
      }
    }

    if (sd.dayOffset === 1) {
      const lowerExercises = ['seed-exercise-back-squat', 'seed-exercise-box-jump', 'seed-exercise-nordic-hamstring-curl'];
      for (let i = 0; i < lowerExercises.length; i++) {
        await prisma.sessionExercise.upsert({
          where: { id: `seed-se-w1s1-${i}` },
          update: {},
          create: {
            id: `seed-se-w1s1-${i}`,
            trainingSessionId: session.id,
            exerciseId: lowerExercises[i],
            orderIndex: i,
            sets: i === 1 ? 5 : 4,
            reps: i === 1 ? '5' : '6-8',
            weight: i === 0 ? 100 : undefined,
            restTime: i === 1 ? 120 : 90,
          },
        });
      }
    }
  }
  console.log(`✓ Training Sessions: 4 sessioni con esercizi`);

  // Individual plan for first athlete
  const athletePlan = await prisma.trainingPlan.upsert({
    where: { id: 'seed-plan-athlete-1' },
    update: {},
    create: {
      id: 'seed-plan-athlete-1',
      name: `Scheda Personalizzata - ${athletes[0].firstName} ${athletes[0].lastName}`,
      description: 'Piano individualizzato per migliorare esplosivita e gestione del carico',
      startDate: planStart,
      endDate: planEnd,
      athleteId: athletes[0].id,
      organizationId: org.id,
      createdById: user.id,
      weeks: {
        create: [
          { id: 'seed-ap-week-1', weekNumber: 1 },
          { id: 'seed-ap-week-2', weekNumber: 2 },
        ],
      },
    },
  });
  console.log(`✓ Individual Plan: ${athletePlan.name}`);

  // ─── Demo Injuries & RTP ────────────────────────────
  const injury = await prisma.injury.upsert({
    where: { id: 'seed-injury-1' },
    update: {},
    create: {
      id: 'seed-injury-1',
      athleteId: athletes[2].id, // Davide Marino
      type: 'Distorsione',
      location: 'Caviglia destra',
      severity: 2,
      status: 'RECOVERING',
      dateOccurred: new Date(today.getFullYear(), today.getMonth() - 1, 15),
      notes: 'Distorsione grado 2 durante partita. Trattamento conservativo.',
    },
  });

  await prisma.rTPProtocol.upsert({
    where: { id: 'seed-rtp-1' },
    update: {},
    create: {
      id: 'seed-rtp-1',
      injuryId: injury.id,
      athleteId: athletes[2].id,
      currentPhase: 'PHASE_3',
      startDate: new Date(today.getFullYear(), today.getMonth() - 1, 17),
      targetDate: new Date(today.getFullYear(), today.getMonth(), 15),
      notes: 'Progresso positivo. Fase 3: carico progressivo e propriocezione.',
    },
  });
  console.log(`✓ Injury & RTP: 1 infortunio con protocollo RTP attivo`);

  // ─── Metrics ────────────────────────────────────────
  const metricTypes = [
    { type: 'vertical_jump', unit: 'cm', min: 45, max: 70 },
    { type: 'sprint_20m', unit: 's', min: 2.8, max: 3.5 },
    { type: 'body_fat', unit: '%', min: 8, max: 16 },
    { type: 'squat_1rm', unit: 'kg', min: 100, max: 180 },
  ];

  let metricCount = 0;
  for (const athlete of athletes.slice(0, 5)) {
    for (const mt of metricTypes) {
      const date = new Date(today);
      date.setDate(date.getDate() - Math.floor(Math.random() * 14));
      date.setHours(0, 0, 0, 0);

      await prisma.metric.create({
        data: {
          athleteId: athlete.id,
          date,
          type: mt.type,
          value: parseFloat((mt.min + Math.random() * (mt.max - mt.min)).toFixed(1)),
          unit: mt.unit,
        },
      });
      metricCount++;
    }
  }
  console.log(`✓ Metrics: ${metricCount} metriche create`);

  // ─── Calendar Events ────────────────────────────────
  const calendarEvents = [
    { title: 'Allenamento squadra', type: 'training', daysFromNow: 1, hours: 16, duration: 2 },
    { title: 'Partita vs Virtus', type: 'match', daysFromNow: 5, hours: 18, duration: 2.5 },
    { title: 'Visita medica - Davide Marino', type: 'medical', daysFromNow: 2, hours: 10, duration: 1 },
    { title: 'Riunione staff tecnico', type: 'meeting', daysFromNow: 3, hours: 9, duration: 1 },
    { title: 'Allenamento individuale Luca', type: 'training', daysFromNow: 1, hours: 14, duration: 1.5 },
    { title: 'Recovery session', type: 'training', daysFromNow: 4, hours: 10, duration: 1 },
  ];

  for (const ev of calendarEvents) {
    const start = new Date(today);
    start.setDate(start.getDate() + ev.daysFromNow);
    start.setHours(ev.hours, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + ev.duration);

    await prisma.calendarEvent.create({
      data: {
        title: ev.title,
        type: ev.type,
        startTime: start,
        endTime: end,
        userId: user.id,
      },
    });
  }
  console.log(`✓ Calendar Events: ${calendarEvents.length} eventi creati`);

  // ─── Summary ────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('✅ Seed completato con successo!');
  console.log('='.repeat(50));
  console.log(`\n📊 Riepilogo:`);
  console.log(`   - ${athletes.length} atleti`);
  console.log(`   - ${exerciseCount} esercizi (da KB seed)`);
  console.log(`   - ${wellnessCount} log wellness`);
  console.log(`   - ${metricCount} metriche`);
  console.log(`   - 2 piani allenamento, 4 sessioni`);
  console.log(`   - 1 infortunio con protocollo RTP`);
  console.log(`   - ${calendarEvents.length} eventi calendario`);
  console.log(`\n📧 Account demo:`);
  console.log(`   Admin:   trainer@trainmind.demo / TrainMind2024!`);
  console.log(`   Medico:  medico@trainmind.demo  / TrainMind2024!`);
  console.log(`   Viewer:  viewer@trainmind.demo  / TrainMind2024!\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed fallito:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
