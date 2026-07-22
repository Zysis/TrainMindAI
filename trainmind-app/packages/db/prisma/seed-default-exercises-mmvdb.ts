/**
 * Popola la libreria esercizi di default per le organizzazioni MM e VDB.
 * Uso (sul server):
 *   dc run --rm \
 *     -v /opt/trainmind/trainmind-app/packages/db/prisma/seed-default-exercises-mmvdb.ts:/app/packages/db/prisma/seed-default-exercises-mmvdb.ts \
 *     -v /opt/trainmind/trainmind-app/seed/exercises.json:/app/seed/exercises.json \
 *     migrate pnpm --filter @trainmind/db exec tsx prisma/seed-default-exercises-mmvdb.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const TARGET_ORGS = ['MM', 'VDB', 'AG', 'RP'];

interface ExerciseSeed {
  name: string;
  category: string;
  description?: string;
  muscleGroups: string[];
  equipment: string[];
}

async function main() {
  const seedPath = resolve('/app/seed/exercises.json');
  const raw = readFileSync(seedPath, 'utf-8');
  const exercises = JSON.parse(raw) as ExerciseSeed[];
  console.log(`📖 Esercizi caricati dal JSON: ${exercises.length}`);

  for (const name of TARGET_ORGS) {
    const org = await prisma.organization.findFirst({ where: { name } });
    if (!org) {
      console.warn(`⚠  Organizzazione "${name}" non trovata — salto`);
      continue;
    }

    const existing = await prisma.exercise.findMany({
      where: { organizationId: org.id },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    let created = 0;
    for (const ex of exercises) {
      if (existingNames.has(ex.name.toLowerCase())) continue;
      await prisma.exercise.create({
        data: {
          name: ex.name,
          category: ex.category,
          description: ex.description || null,
          muscleGroups: ex.muscleGroups,
          equipment: ex.equipment,
          isDefault: true,
          organizationId: org.id,
        },
      });
      created++;
    }
    console.log(`✅ ${name}: creati ${created} (esistenti ${existing.length})`);
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
