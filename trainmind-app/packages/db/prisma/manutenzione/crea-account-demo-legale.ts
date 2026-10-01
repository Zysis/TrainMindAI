/**
 * Account demo per le VERIFICHE LEGALI — camilla.coresi@demo.com
 * =============================================================
 *
 * Crea (o ricrea) una societa' di prova completa: organizzazione ULTRA, un
 * ADMIN, una squadra con 12 atleti, una stagione di allenamenti, wellness,
 * test fisici e due infortuni con protocollo RTP. Serve ad avere sotto mano
 * dati veri per provare informativa, consensi, esportazione e cancellazione.
 *
 * PERCHE' UNO SCRIPT E NON UN FILE .sql
 * Dal 22/09/2026 le anagrafiche degli atleti si scrivono CIFRATE, e la chiave
 * vive nell'API, non in Postgres. Un INSERT a mano scriverebbe nomi in chiaro
 * dentro il caveau. Questo script usa il client esteso di @trainmind/db, lo
 * stesso dell'API: cifra in scrittura e decifra in lettura.
 * Vedi documentation/PIANO_CIFRATURA_VAULT.md.
 *
 * PROVA A VUOTO PER DEFAULT. Senza argomenti dice solo cosa farebbe:
 *
 *   tsx prisma/manutenzione/crea-account-demo-legale.ts            prova a vuoto
 *   tsx prisma/manutenzione/crea-account-demo-legale.ts --esegui   crea davvero
 *
 * In locale (PowerShell, dalla radice di trainmind-app):
 *   pnpm --filter @trainmind/db exec tsx prisma/manutenzione/crea-account-demo-legale.ts --esegui
 *
 * In produzione, dal servizio `migrate` (l'unico con i sorgenti completi e la
 * chiave montata):
 *   dc --profile tools run --rm --entrypoint sh migrate -c \
 *     'pnpm --filter @trainmind/db exec tsx prisma/manutenzione/crea-account-demo-legale.ts --esegui'
 *
 * RILANCIABILE: l'account viene riusato se esiste gia' (la password torna
 * quella indicata qui sotto) e i dati sportivi della societa' vengono
 * cancellati e ricreati. Non tocca nessun'altra organizzazione.
 *
 * Un rilancio pero' si ferma se nel frattempo, dall'app, sono nate partite,
 * fogli presenze o report collegati a questi atleti: quelle righe li tengono
 * agganciati e il database rifiuta la cancellazione. Lo script lo dice
 * chiaramente invece di lasciare la societa' a meta'.
 */

// @ts-expect-error — bcrypt non porta i tipi con se'
import bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../../src/index.js';

// ─── Dati dell'account ──────────────────────────────────────────────────────

const EMAIL = 'camilla.coresi@demo.com';
const PASSWORD = 'CamillaCoresi01';
const ADMIN_FIRST = 'Camilla';
const ADMIN_LAST = 'Coresi';
const ORG_NAME = 'CC Demo Legale';
const ORG_SLUG = 'cc-demo-legale';
const TEAM_NAME = 'Prima Squadra';

// Versioni dei documenti accettati alla registrazione (apps/api/src/lib/legal.ts).
// Se cambiano li', vanno aggiornate anche qui: questo account serve proprio a
// verificare la prova del consenso.
const LEGAL_VERSION = '2026-07-21-v2.0';

const esegui = process.argv.includes('--esegui');

// ─── Stagione simulata ──────────────────────────────────────────────────────

const SEASON_START = new Date('2026-08-17'); // lunedi'
const TOTAL_WEEKS = 20;
const oggi = new Date();

type Fase = 'PREPARATION' | 'SPECIFIC' | 'COMPETITION' | 'TRANSITION' | 'TAPER' | 'RECOVERY';
interface MesoCfg { name: string; phase: Fase; weeks: number; load: number; color: string }
const MESOCICLI: MesoCfg[] = [
  { name: 'Preparazione Generale', phase: 'PREPARATION', weeks: 4, load: 70, color: '#14b8a6' },
  { name: 'Forza & Potenza', phase: 'SPECIFIC', weeks: 5, load: 85, color: '#f59e0b' },
  { name: 'Campionato — Andata', phase: 'COMPETITION', weeks: 9, load: 80, color: '#ef4444' },
  { name: 'Scarico di fine anno', phase: 'RECOVERY', weeks: 2, load: 55, color: '#22c55e' },
];

const ROSTER = [
  { first: 'Elia', last: 'Mancini', pos: 'PG', dob: '1999-02-18', h: 182, w: 79, jersey: 3 },
  { first: 'Tobia', last: 'Reverberi', pos: 'PG', dob: '2002-05-09', h: 180, w: 75, jersey: 6 },
  { first: 'Ruggero', last: 'Alfieri', pos: 'SG', dob: '1998-10-02', h: 190, w: 86, jersey: 8 },
  { first: 'Ettore', last: 'Salvetti', pos: 'SG', dob: '2001-01-27', h: 188, w: 84, jersey: 11 },
  { first: 'Cesare', last: 'Lombardo', pos: 'SG', dob: '2004-03-15', h: 186, w: 81, jersey: 14 },
  { first: 'Ermanno', last: 'Tosi', pos: 'SF', dob: '1997-07-23', h: 197, w: 94, jersey: 17 },
  { first: 'Silvio', last: 'Carbone', pos: 'SF', dob: '2000-11-30', h: 195, w: 91, jersey: 20 },
  { first: 'Danilo', last: 'Prandi', pos: 'SF', dob: '2003-06-12', h: 193, w: 88, jersey: 23 },
  { first: 'Osvaldo', last: 'Ferrini', pos: 'PF', dob: '1996-04-05', h: 202, w: 103, jersey: 26 },
  { first: 'Manlio', last: 'Sestini', pos: 'PF', dob: '1999-09-19', h: 200, w: 99, jersey: 29 },
  { first: 'Teodoro', last: 'Basile', pos: 'C', dob: '1995-12-01', h: 208, w: 111, jersey: 32 },
  { first: 'Ivano', last: 'Guidetti', pos: 'C', dob: '2002-08-08', h: 206, w: 106, jersey: 35 },
];

const TIPI_TEST = [
  { type: 'vertical_jump', unit: 'cm', guardia: [48, 65], lungo: [40, 58] },
  { type: 'sprint_20m', unit: 's', guardia: [2.75, 3.05], lungo: [2.95, 3.35] },
  { type: 't_test', unit: 's', guardia: [8.6, 9.8], lungo: [9.2, 10.5] },
  { type: 'body_fat', unit: '%', guardia: [7, 12], lungo: [9, 15] },
  { type: 'vo2_max', unit: 'ml/kg/min', guardia: [52, 62], lungo: [46, 56] },
  { type: '1rm_bench', unit: 'kg', guardia: [80, 115], lungo: [95, 140] },
  { type: '1rm_squat', unit: 'kg', guardia: [120, 165], lungo: [140, 200] },
];
const DATE_TEST = [new Date('2026-08-24'), new Date('2026-09-21')];

const TIPI_SEDUTA = [
  'Forza & Condizionamento',
  'Tecnica individuale',
  'Tattica di squadra',
  'Tiro e finalizzazione',
  'Agilità e velocità',
  'Pliometria',
  'Recupero attivo',
  'Scrimmage',
];

// ─── Aiutanti ───────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
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
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function intensitaDaCarico(load: number): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' {
  if (load < 40) return 'VERY_LOW';
  if (load < 60) return 'LOW';
  if (load < 75) return 'MODERATE';
  if (load < 90) return 'HIGH';
  return 'VERY_HIGH';
}

/** La libreria esercizi che la registrazione crea da sola: qui va fatta a mano. */
function esercizidiDefault(): Array<{ name: string; category: string; description?: string; muscleGroups: string[]; equipment: string[] }> {
  const candidati = [
    '/app/seed/exercises.json',
    resolve(process.cwd(), 'seed/exercises.json'),
    resolve(process.cwd(), '../../seed/exercises.json'),
  ];
  for (const p of candidati) {
    try {
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      /* prova il prossimo */
    }
  }
  console.warn('⚠ seed/exercises.json non trovato: le sedute nasceranno senza esercizi collegati.');
  return [];
}

// ─── Programma ──────────────────────────────────────────────────────────────

async function main() {
  console.log('🏀 Account demo per le verifiche legali');
  console.log(`   ${EMAIL} — ${ORG_NAME} (ULTRA) — ${ROSTER.length} atleti`);
  if (!esegui) {
    console.log('\nPROVA A VUOTO: non scrivo niente. Rilancia con --esegui per creare.');
    const gia = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, organizationId: true } });
    console.log(gia ? '   L\'account esiste gia\': verrebbe riusato e i suoi dati sportivi rifatti.' : '   L\'account non esiste: verrebbe creato da zero.');
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // ── 1. Organizzazione e amministratore ───────────────────────────────────
  const esistente = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, organizationId: true },
  });

  let orgId: string;
  let adminId: string;

  if (esistente) {
    orgId = esistente.organizationId;
    adminId = esistente.id;
    await prisma.organization.update({
      where: { id: orgId },
      data: { name: ORG_NAME, tier: 'ULTRA', subscriptionTier: 'ultra', subscriptionStatus: 'active' },
    });
    await prisma.user.update({
      where: { id: adminId },
      data: { passwordHash, passwordChangedAt: new Date(), isActive: true, role: 'ADMIN', locale: 'it' },
    });
    await prisma.userIdentity.upsert({
      where: { userId: adminId },
      create: { userId: adminId, firstName: ADMIN_FIRST, lastName: ADMIN_LAST },
      update: { firstName: ADMIN_FIRST, lastName: ADMIN_LAST },
    });
    console.log(`♻️  Account gia' presente: riuso l'organizzazione ${orgId} e rimetto la password.`);
  } else {
    const org = await prisma.organization.create({
      data: {
        name: ORG_NAME,
        slug: `${ORG_SLUG}-${Date.now().toString(36)}`,
        sport: 'basketball',
        tier: 'ULTRA',
        subscriptionTier: 'ultra',
        subscriptionStatus: 'active',
      },
    });
    orgId = org.id;
    const admin = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash,
        passwordChangedAt: new Date(),
        role: 'ADMIN',
        locale: 'it',
        organizationId: orgId,
        consentAnalytics: false,
        consentMarketing: false,
        consentThirdParty: false,
        consentUpdatedAt: new Date(),
        identity: { create: { firstName: ADMIN_FIRST, lastName: ADMIN_LAST } },
      },
    });
    adminId = admin.id;
    console.log(`🏢 Organizzazione ${ORG_NAME} creata (${orgId})`);
  }

  // Prova del consenso, come la scrive la registrazione.
  await prisma.consentRecord.deleteMany({ where: { userId: adminId } });
  await prisma.consentRecord.createMany({
    data: [
      { userId: adminId, docType: 'TERMS', docVersion: LEGAL_VERSION, language: 'it', metadata: { origine: 'script demo legale' } },
      { userId: adminId, docType: 'PRIVACY_ACK', docVersion: LEGAL_VERSION, language: 'it', metadata: { origine: 'script demo legale' } },
      { userId: adminId, docType: 'AGE_DECLARATION', docVersion: LEGAL_VERSION, language: 'it', metadata: { origine: 'script demo legale' } },
      { userId: adminId, docType: 'HEALTH_DATA', docVersion: LEGAL_VERSION, language: 'it', metadata: { granted: true, origine: 'script demo legale' } },
    ],
  });

  // ── 2. Pulizia dei dati sportivi di QUESTA sola organizzazione ───────────
  console.log('🧹 Pulizia dei dati precedenti della societa\'...');
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
  await prisma.athleteIdentity.deleteMany({ where: { athlete: { organizationId: orgId } } });
  try {
    await prisma.athlete.deleteMany({ where: { organizationId: orgId } });
    await prisma.team.deleteMany({ where: { organizationId: orgId } });
  } catch (err) {
    // Se durante le prove sono nati fogli presenze, partite o report, quelle
    // righe puntano agli atleti e il database rifiuta la cancellazione. Non e'
    // un guasto dello script: e' la protezione che impedisce di perdere dati.
    throw new Error(
      'Non riesco a cancellare gli atleti di questa societa\': qualcosa che hai creato durante ' +
        'le prove (una partita, un foglio presenze, un report) li sta ancora usando. ' +
        'Cancella prima quelle voci dall\'app, oppure elimina tutta la societa\' a mano ' +
        'e rilancia lo script. Dettaglio: ' + String(err),
    );
  }

  // ── 3. Squadra e atleti ─────────────────────────────────────────────────
  const team = await prisma.team.create({
    data: {
      name: TEAM_NAME,
      description: 'Prima squadra senior — dati di prova',
      color: '#0d9488',
      organizationId: orgId,
    },
  });

  const atleti: Array<{ id: string; pos: string; nome: string }> = [];
  for (const p of ROSTER) {
    // L'anagrafica NON si crea annidata: la cifratura ha bisogno dell'id
    // dell'atleta, che esiste solo dopo la prima insert (vedi packages/db/src/index.ts).
    const a = await prisma.athlete.create({
      data: {
        birthYear: new Date(p.dob).getFullYear(),
        position: p.pos,
        height: p.h,
        weight: p.w,
        jerseyNumber: p.jersey,
        organizationId: orgId,
      },
    });
    await prisma.athleteIdentity.create({
      data: { athleteId: a.id, firstName: p.first, lastName: p.last, dateOfBirth: new Date(p.dob) },
    });
    await prisma.athleteTeam.create({ data: { athleteId: a.id, teamId: team.id } });
    atleti.push({ id: a.id, pos: p.pos, nome: `${p.first} ${p.last}` });
  }
  console.log(`👥 ${team.name}: ${atleti.length} atleti`);

  // ── 4. Libreria esercizi ────────────────────────────────────────────────
  const daFile = esercizidiDefault();
  if (daFile.length > 0) {
    await prisma.exercise.createMany({
      data: daFile.map((ex) => ({
        id: `default-${orgId.slice(0, 8)}-${ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`,
        name: ex.name,
        category: ex.category,
        description: ex.description || null,
        muscleGroups: ex.muscleGroups,
        equipment: ex.equipment,
        organizationId: orgId,
      })),
      skipDuplicates: true,
    });
  }
  const esercizi = await prisma.exercise.findMany({ where: { organizationId: orgId }, select: { id: true } });
  console.log(`📋 Esercizi: ${esercizi.length}`);

  // ── 5. Test fisici ──────────────────────────────────────────────────────
  const test: Array<{ athleteId: string; date: Date; type: string; value: number; unit: string }> = [];
  for (const a of atleti) {
    const guardia = ['PG', 'SG'].includes(a.pos);
    DATE_TEST.forEach((data, idx) => {
      for (const t of TIPI_TEST) {
        const range = guardia ? t.guardia : t.lungo;
        let v = rand(range[0], range[1]);
        const progresso = 1 + idx * 0.02;
        v = t.unit === 's' ? v / progresso : v * progresso;
        test.push({ athleteId: a.id, date: data, type: t.type, value: Math.round(v * 100) / 100, unit: t.unit });
      }
    });
  }
  await prisma.metric.createMany({ data: test });
  console.log(`📏 Test fisici: ${test.length}`);

  // ── 6. Periodizzazione, piano, sedute ───────────────────────────────────
  const fine = addDays(SEASON_START, TOTAL_WEEKS * 7 - 1);
  const peri = await prisma.periodizationPlan.create({
    data: {
      name: 'Stagione 2026/27',
      type: 'BLOCK',
      startDate: SEASON_START,
      endDate: fine,
      totalWeeks: TOTAL_WEEKS,
      organizationId: orgId,
      createdById: adminId,
      teamId: team.id,
    },
  });
  const piano = await prisma.trainingPlan.create({
    data: {
      name: 'Stagione 2026/27 — Piano Allenamento',
      startDate: SEASON_START,
      endDate: fine,
      organizationId: orgId,
      createdById: adminId,
      teamId: team.id,
      periodizationPlanId: peri.id,
      trainingDays: [1, 3, 5], // ISO: lunedi', mercoledi', venerdi'
    },
  });

  let numeroSettimana = 0;
  let sedute = 0;
  let seduteCompletate = 0;
  for (let m = 0; m < MESOCICLI.length; m++) {
    const cfg = MESOCICLI[m];
    const meso = await prisma.mesocycle.create({
      data: {
        periodizationPlanId: peri.id,
        orderIndex: m,
        name: cfg.name,
        phase: cfg.phase,
        durationWeeks: cfg.weeks,
        targetLoadPercent: cfg.load,
        color: cfg.color,
      },
    });

    for (let w = 1; w <= cfg.weeks; w++) {
      numeroSettimana++;
      const scarico = w === cfg.weeks && cfg.weeks >= 3;
      const carico = scarico ? Math.round(cfg.load * 0.6) : Math.round((cfg.load * (75 + ((w - 1) / Math.max(1, cfg.weeks - 1)) * 25)) / 100);
      const micro = await prisma.microcycle.create({
        data: {
          mesocycleId: meso.id,
          weekNumber: w,
          loadPercent: carico,
          intensity: intensitaDaCarico(carico),
          sessionsCount: scarico ? 2 : 3,
          focusAreas: [pick(['forza', 'velocità', 'agilità', 'tiro', 'tattica', 'pliometria'])],
          isDeload: scarico,
        },
      });
      const inizioSettimana = addDays(SEASON_START, (numeroSettimana - 1) * 7);
      const settimana = await prisma.week.create({
        data: {
          weekNumber: numeroSettimana,
          trainingPlanId: piano.id,
          microcycleId: micro.id,
          notes: `${cfg.name} — Sett. ${w}${scarico ? ' (Scarico)' : ''}`,
        },
      });

      const giorni = [0, 2, 4].slice(0, micro.sessionsCount); // lun, mer, ven
      for (const g of giorni) {
        const data = addDays(inizioSettimana, g);
        const passata = data < oggi;
        const tipo = pick(TIPI_SEDUTA);
        const seduta = await prisma.trainingSession.create({
          data: {
            title: `${tipo} — ${cfg.name}`,
            date: data,
            duration: scarico ? randInt(45, 60) : randInt(70, 110),
            status: passata ? 'COMPLETED' : 'PLANNED',
            rpe: passata ? (scarico ? randInt(3, 5) : randInt(5, 8)) : null,
            notes: `Carico ${carico}% — intensita' ${micro.intensity}.`,
            weekId: settimana.id,
            organizationId: orgId,
            isTemplate: false,
          },
        });
        sedute++;
        if (passata) seduteCompletate++;

        if (esercizi.length > 0) {
          const scelti: string[] = [];
          while (scelti.length < 4 && scelti.length < esercizi.length) {
            const ex = pick(esercizi).id;
            if (!scelti.includes(ex)) scelti.push(ex);
          }
          await prisma.sessionExercise.createMany({
            data: scelti.map((exerciseId, i) => ({
              trainingSessionId: seduta.id,
              exerciseId,
              orderIndex: i,
              sets: randInt(3, 5),
              reps: `${randInt(6, 12)}`,
              restTime: randInt(60, 150),
            })),
          });
        }
      }
    }
  }
  console.log(`💪 Sedute: ${sedute} (${seduteCompletate} completate, ${sedute - seduteCompletate} pianificate)`);

  // ── 7. Wellness giornaliero ─────────────────────────────────────────────
  const giorniTotali = Math.floor((oggi.getTime() - SEASON_START.getTime()) / 86400000) + 1;
  let wellness = 0;
  for (const a of atleti) {
    const righe = [];
    for (let d = 0; d < giorniTotali; d++) {
      const data = addDays(SEASON_START, d);
      const giornoNo = Math.random() < 0.1;
      righe.push({
        athleteId: a.id,
        date: new Date(data.toISOString().slice(0, 10) + 'T07:00:00.000Z'),
        sleepHours: clamp(rand(6.5, 8.5), 4, 10),
        sleepQuality: clamp(randInt(3, 5) - (giornoNo ? 1 : 0), 1, 5),
        fatigue: clamp(randInt(3, 5) - (giornoNo ? 1 : 0), 1, 5),
        soreness: clamp(randInt(3, 5) - (giornoNo ? 1 : 0), 1, 5),
        stress: clamp(randInt(3, 5) - (giornoNo ? 1 : 0), 1, 5),
        mood: clamp(randInt(3, 5) - (giornoNo ? 1 : 0), 1, 5),
        notes: giornoNo ? pick(['Notte corta', 'Gambe pesanti', 'Mal di testa', 'Stanchezza mentale']) : null,
        submittedBy: 'athlete',
      });
    }
    await prisma.wellnessLog.createMany({ data: righe, skipDuplicates: true });
    wellness += righe.length;
  }
  console.log(`❤️  Wellness: ${wellness} questionari (${giorniTotali} giorni × ${atleti.length} atleti)`);

  // ── 8. Infortuni e RTP ──────────────────────────────────────────────────
  const CRITERI: Record<string, string[]> = {
    PHASE_1: ['Dolore a riposo assente', 'ROM completo senza dolore'],
    PHASE_2: ['Corsa leggera senza dolore', 'Forza >70% arto controlaterale'],
    PHASE_3: ['Cambi di direzione senza dolore', 'Forza >85% arto controlaterale'],
    PHASE_4: ['Allenamento completo senza contatto', 'Test funzionali >90%'],
    PHASE_5: ['Allenamento con contatto tollerato', 'Idoneita\' medica al rientro'],
  };
  const ORDINE_FASI = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'] as const;

  const INFORTUNI = [
    {
      idx: 4,
      type: 'ligament',
      onset: 'traumatic',
      location: 'ankle_r',
      severity: 2,
      occorso: '2026-08-28',
      risolto: '2026-09-15',
      fase: 'CLEARED' as const,
      note: 'Distorsione in ricaduta da rimbalzo. Trattamento conservativo, rientro completato.',
    },
    {
      idx: 9,
      type: 'tendon',
      onset: 'overuse',
      location: 'knee_r',
      severity: 2,
      occorso: '2026-09-18',
      risolto: null,
      fase: 'PHASE_2' as const,
      note: 'Sovraccarico del tendine rotuleo. Gestione del carico e rinforzo eccentrico in corso.',
    },
  ];

  for (const cfg of INFORTUNI) {
    const a = atleti[cfg.idx];
    const occorso = new Date(cfg.occorso);
    const risolto = cfg.risolto ? new Date(cfg.risolto) : null;
    const inf = await prisma.injury.create({
      data: {
        athleteId: a.id,
        type: cfg.type,
        onset: cfg.onset,
        location: cfg.location,
        severity: cfg.severity,
        status: risolto ? 'RESOLVED' : 'RECOVERING',
        dateOccurred: occorso,
        dateResolved: risolto,
        notes: cfg.note,
      },
    });
    const inizioRtp = addDays(occorso, 2);
    const obiettivo = risolto ?? addDays(occorso, 40);
    const protocollo = await prisma.rTPProtocol.create({
      data: {
        injuryId: inf.id,
        athleteId: a.id,
        currentPhase: cfg.fase,
        startDate: inizioRtp,
        targetDate: obiettivo,
        notes: `Protocollo RTP — ${cfg.type} ${cfg.location}`,
      },
    });

    const raggiunta = ORDINE_FASI.indexOf(cfg.fase);
    const giorniRtp = Math.max(7, Math.floor((obiettivo.getTime() - inizioRtp.getTime()) / 86400000));
    for (let i = 0; i < raggiunta; i++) {
      await prisma.rTPPhaseLog.create({
        data: {
          rtpProtocolId: protocollo.id,
          fromPhase: ORDINE_FASI[i],
          toPhase: ORDINE_FASI[i + 1],
          changedById: adminId,
          reason: `Criteri della fase ${i + 1} soddisfatti`,
          createdAt: addDays(inizioRtp, Math.round(((i + 1) / 5) * giorniRtp)),
        },
      });
    }
    for (let p = 0; p < 5; p++) {
      const fase = ORDINE_FASI[p];
      const fatta = p < raggiunta;
      for (const desc of CRITERI[fase]) {
        await prisma.clearanceCriteria.create({
          data: {
            rtpProtocolId: protocollo.id,
            phase: fase,
            description: desc,
            isMet: fatta,
            metAt: fatta ? addDays(inizioRtp, Math.round(((p + 1) / 5) * giorniRtp)) : null,
            metById: fatta ? adminId : null,
          },
        });
      }
    }
    console.log(`🩹 ${a.nome}: ${cfg.type} ${cfg.location} (${risolto ? 'risolto' : 'in corso — ' + cfg.fase})`);
  }

  console.log('\n✅ Fatto.');
  console.log(`   Accesso: ${EMAIL} / ${PASSWORD}`);
  console.log(`   Societa': ${ORG_NAME} (ULTRA) — organizationId ${orgId}`);
}

main()
  .catch((e) => {
    console.error('❌ Creazione fallita:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
