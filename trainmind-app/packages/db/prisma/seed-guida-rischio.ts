/**
 * TrainMind — Complemento al seed della guida: due atleti in zona di rischio.
 *
 * Il seed principale distribuisce lo stesso carico di squadra a tutta la rosa,
 * quindi l'ACWR esce identico per tutti e il pannello "Atleti a rischio" resta
 * vuoto. Qui si aggiungono sedute INDIVIDUALI recenti (lavoro extra, il caso
 * reale che fa salire il carico acuto di un singolo) a due atleti:
 *   - uno finisce sopra 1.5 (zona rossa),
 *   - uno fra 1.3 e 1.5 (zona di attenzione).
 *
 * Rilanciabile: cancella le proprie sedute prima di ricrearle.
 *
 * Run: pnpm --filter @trainmind/db exec tsx prisma/seed-guida-rischio.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_NAME = 'AV';
const TAG = '[extra individuale]';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: ORG_NAME } });
  if (!org) throw new Error(`Organizzazione ${ORG_NAME} non trovata`);

  const athletes = await prisma.athlete.findMany({
    where: { organizationId: org.id, isActive: true },
    orderBy: { lastName: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  });
  if (athletes.length < 2) throw new Error('Servono almeno due atleti: lancia prima seed-guida.ts');

  await prisma.trainingSession.deleteMany({
    where: { organizationId: org.id, title: { contains: TAG } },
  });

  // Chi va in rosso e chi in giallo. Indici scelti per avere due cognomi
  // diversi in cima all'elenco della dashboard.
  const plan = [
    { athlete: athletes[0], label: 'Richiamo forza massimale', sessions: [ { d: 1, rpe: 9, min: 110 }, { d: 3, rpe: 9, min: 105 }, { d: 5, rpe: 8, min: 100 } ] },
    { athlete: athletes[1], label: 'Lavoro tecnico aggiuntivo', sessions: [ { d: 2, rpe: 8, min: 90 }, { d: 4, rpe: 7, min: 85 } ] },
  ];

  for (const p of plan) {
    for (const s of p.sessions) {
      await prisma.trainingSession.create({
        data: {
          title: `${p.label} ${TAG}`,
          date: daysAgo(s.d),
          duration: s.min,
          status: 'COMPLETED',
          rpe: s.rpe,
          notes: 'Seduta individuale extra rispetto al programma di squadra.',
          athleteId: p.athlete.id,
          organizationId: org.id,
          isTemplate: false,
        },
      });
    }
    const load = p.sessions.reduce((a, s) => a + s.rpe * s.min, 0);
    console.log(`+ ${p.athlete.firstName} ${p.athlete.lastName}: ${p.sessions.length} sedute, carico extra ${load} UA`);
  }
  console.log('Fatto. Ricarica la Dashboard.');
}

main()
  .catch((e) => { console.error('Seed rischio fallito:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
