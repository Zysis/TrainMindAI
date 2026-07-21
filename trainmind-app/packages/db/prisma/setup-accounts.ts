// ============================================
// TrainMind AI — Setup account custom
// ============================================
// Esegue tre cose, in modo idempotente (puoi rilanciarlo quando vuoi):
//
//  1. Cerca l'utente `alessandro.vispa@gmail.com` e, se esiste,
//     porta la sua organization a tier=ULTRA. Nessun altro dato
//     viene modificato.
//
//  2. Crea/aggiorna l'organizzazione demo `Pro Demo Basket` con
//     admin `avispa@pro.com` su tier=PROFESSIONAL, 2 squadre,
//     8 atleti, wellness logs + calendar.
//
//  3. Crea/aggiorna l'organizzazione demo `Starter Demo Basket`
//     con admin `avispa@starter.com` su tier=STARTER, 1 squadra,
//     4 atleti, wellness logs + calendar (rispetta i limiti del piano).
//
// Tutti gli upsert usano chiavi stabili (slug org / id athletes con
// prefisso pro- e starter-) così la rilavorazione non duplica nulla.

import { PrismaClient } from '@prisma/client';
// @ts-expect-error — bcrypt has no bundled types
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD = 'TrainMind2024!';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ─── Tipi ────────────────────────────────────────────────
interface AthleteSpec {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  position: string;
  jerseyNumber: number;
  height: number;
  weight: number;
}

interface TeamSpec {
  name: string;
  description?: string;
  color?: string;
}

interface OrgSpec {
  email: string;
  firstName: string;
  lastName: string;
  orgSlug: string;
  orgName: string;
  tier: 'STARTER' | 'PROFESSIONAL' | 'ULTRA';
  athletes: AthleteSpec[];
  teams: TeamSpec[];
}

// ─── 1. alessandro.vispa@gmail.com → ULTRA ───────────────
async function upgradeAlessandro() {
  console.log('\n─── alessandro.vispa@gmail.com → ULTRA ───');

  const user = await prisma.user.findUnique({
    where: { email: 'alessandro.vispa@gmail.com' },
    select: {
      organizationId: true,
      organization: { select: { name: true, tier: true } },
    },
  });

  if (!user) {
    console.log('⚠️  Account alessandro.vispa@gmail.com non trovato nel DB.');
    console.log('    Registra prima l\'account dalla landing/login, poi rilancia');
    console.log('    questo script — l\'upgrade a ULTRA verrà applicato.');
    return;
  }

  if (user.organization.tier === 'ULTRA') {
    console.log(`✓ Organization "${user.organization.name}" già su tier=ULTRA. Nulla da fare.`);
    return;
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { tier: 'ULTRA' },
  });

  console.log(`✓ Organization "${user.organization.name}" → tier=ULTRA`);
  console.log('  (atleti, squadre, sessioni e tutto il resto NON sono stati toccati)');
}

// ─── 2 & 3. helper per gli account demo ──────────────────
async function createDemoOrg(spec: OrgSpec) {
  console.log(`\n─── ${spec.email} → ${spec.tier} ───`);

  // Organization (upsert by slug)
  const org = await prisma.organization.upsert({
    where: { slug: spec.orgSlug },
    update: { tier: spec.tier, name: spec.orgName },
    create: {
      name: spec.orgName,
      slug: spec.orgSlug,
      sport: 'basketball',
      tier: spec.tier,
    },
  });
  console.log(`✓ Organization: ${org.name} [${spec.tier}]`);

  // Admin user
  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: spec.email },
    update: { passwordHash, organizationId: org.id, isActive: true },
    create: {
      email: spec.email,
      passwordHash,
      firstName: spec.firstName,
      lastName: spec.lastName,
      role: 'ADMIN',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log(`✓ Admin: ${user.firstName} ${user.lastName} (${user.email})`);

  // Teams
  const teams: { id: string; name: string }[] = [];
  for (const td of spec.teams) {
    const team = await prisma.team.upsert({
      where: {
        organizationId_name: { organizationId: org.id, name: td.name },
      },
      update: { description: td.description, color: td.color },
      create: {
        name: td.name,
        description: td.description,
        color: td.color,
        organizationId: org.id,
      },
    });
    teams.push({ id: team.id, name: team.name });
  }
  console.log(`✓ Teams: ${teams.length}`);

  // Athletes
  const athletes: { id: string }[] = [];
  for (const a of spec.athletes) {
    const id = `${spec.orgSlug}-athlete-${a.jerseyNumber}`;
    const athlete = await prisma.athlete.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ...a,
        organizationId: org.id,
        isActive: true,
      },
    });
    athletes.push({ id: athlete.id });
  }
  console.log(`✓ Athletes: ${athletes.length}`);

  // Athletes ↔ Teams (round-robin)
  if (teams.length > 0) {
    for (let i = 0; i < athletes.length; i++) {
      const team = teams[i % teams.length];
      await prisma.athleteTeam.upsert({
        where: {
          athleteId_teamId: { athleteId: athletes[i].id, teamId: team.id },
        },
        update: {},
        create: { athleteId: athletes[i].id, teamId: team.id },
      });
    }
    console.log(`✓ Athlete-Team assignments: ${athletes.length}`);
  }

  // Wellness logs — ultimi 7 giorni per ogni atleta
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let wellnessCount = 0;
  for (const athlete of athletes) {
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      await prisma.wellnessLog.upsert({
        where: { athleteId_date: { athleteId: athlete.id, date } },
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
  console.log(`✓ Wellness logs: ${wellnessCount} (7gg × ${athletes.length} atleti)`);

  // Calendar events (idempotenti via ID stabili)
  const events = [
    { offset: 1, hour: 16, duration: 2, title: 'Allenamento squadra', type: 'training' },
    { offset: 2, hour: 10, duration: 1, title: 'Recovery session', type: 'training' },
    { offset: 4, hour: 18, duration: 2, title: 'Partita amichevole', type: 'match' },
  ];
  for (const ev of events) {
    const start = new Date(today);
    start.setDate(start.getDate() + ev.offset);
    start.setHours(ev.hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + ev.duration);

    await prisma.calendarEvent.upsert({
      where: { id: `${spec.orgSlug}-event-${ev.offset}` },
      update: { startTime: start, endTime: end },
      create: {
        id: `${spec.orgSlug}-event-${ev.offset}`,
        title: ev.title,
        type: ev.type,
        startTime: start,
        endTime: end,
        userId: user.id,
      },
    });
  }
  console.log(`✓ Calendar events: ${events.length}`);
}

// ─── Specs ───────────────────────────────────────────────
const PRO_SPEC: OrgSpec = {
  email: 'avispa@pro.com',
  firstName: 'Alessandro',
  lastName: 'Vispa',
  orgSlug: 'pro-demo',
  orgName: 'Pro Demo Basket',
  tier: 'PROFESSIONAL',
  teams: [
    { name: 'Senior', description: 'Prima squadra', color: '#0D9488' },
    { name: 'Under 18', description: 'Settore giovanile', color: '#F59E0B' },
  ],
  athletes: [
    { firstName: 'Luca', lastName: 'Bianchi', dateOfBirth: new Date('2000-03-15'), position: 'Point Guard', jerseyNumber: 1, height: 185, weight: 78 },
    { firstName: 'Alessandro', lastName: 'Conti', dateOfBirth: new Date('1999-07-22'), position: 'Shooting Guard', jerseyNumber: 5, height: 192, weight: 84 },
    { firstName: 'Davide', lastName: 'Marino', dateOfBirth: new Date('2001-11-08'), position: 'Small Forward', jerseyNumber: 7, height: 198, weight: 90 },
    { firstName: 'Matteo', lastName: 'Ferrari', dateOfBirth: new Date('2000-01-30'), position: 'Power Forward', jerseyNumber: 11, height: 203, weight: 98 },
    { firstName: 'Andrea', lastName: 'Romano', dateOfBirth: new Date('1998-09-12'), position: 'Center', jerseyNumber: 15, height: 208, weight: 105 },
    { firstName: 'Marco', lastName: 'Esposito', dateOfBirth: new Date('2002-05-20'), position: 'Point Guard', jerseyNumber: 3, height: 182, weight: 75 },
    { firstName: 'Federico', lastName: 'Colombo', dateOfBirth: new Date('2001-02-14'), position: 'Shooting Guard', jerseyNumber: 8, height: 190, weight: 82 },
    { firstName: 'Gabriele', lastName: 'Ricci', dateOfBirth: new Date('1999-10-03'), position: 'Small Forward', jerseyNumber: 10, height: 196, weight: 88 },
  ],
};

const STARTER_SPEC: OrgSpec = {
  email: 'avispa@starter.com',
  firstName: 'Alessandro',
  lastName: 'Vispa',
  orgSlug: 'starter-demo',
  orgName: 'Starter Demo Basket',
  tier: 'STARTER',
  teams: [
    { name: 'Prima Squadra', description: 'Unica squadra (limite STARTER)', color: '#0D9488' },
  ],
  athletes: [
    { firstName: 'Luca', lastName: 'Verdi', dateOfBirth: new Date('2001-04-10'), position: 'Point Guard', jerseyNumber: 4, height: 183, weight: 76 },
    { firstName: 'Marco', lastName: 'Galli', dateOfBirth: new Date('2000-08-22'), position: 'Shooting Guard', jerseyNumber: 6, height: 188, weight: 80 },
    { firstName: 'Filippo', lastName: 'Costa', dateOfBirth: new Date('2002-12-01'), position: 'Small Forward', jerseyNumber: 9, height: 195, weight: 87 },
    { firstName: 'Tommaso', lastName: 'Greco', dateOfBirth: new Date('1999-06-18'), position: 'Power Forward', jerseyNumber: 12, height: 200, weight: 94 },
  ],
};

// ─── Main ────────────────────────────────────────────────
async function main() {
  console.log('🔧 Setup account TrainMind AI...');

  await upgradeAlessandro();
  await createDemoOrg(PRO_SPEC);
  await createDemoOrg(STARTER_SPEC);

  console.log('\n' + '='.repeat(54));
  console.log('✅ Setup completato');
  console.log('='.repeat(54));
  console.log('\n📧 Account demo creati:');
  console.log(`   PROFESSIONAL  avispa@pro.com      / ${PASSWORD}`);
  console.log(`   STARTER       avispa@starter.com  / ${PASSWORD}`);
  console.log('\n   alessandro.vispa@gmail.com → tier ULTRA');
  console.log('   (dati esistenti dell\'account invariati)\n');
}

main()
  .catch((e) => {
    console.error('❌ Setup fallito:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
