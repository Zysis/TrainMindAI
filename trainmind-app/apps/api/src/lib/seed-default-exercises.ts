// ============================================
// Seed default exercises for a new organization
// ============================================

import type { PrismaClient } from '@trainmind/db';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ExerciseSeed {
  name: string;
  category: string;
  description?: string;
  muscleGroups: string[];
  equipment: string[];
}

let _cachedExercises: ExerciseSeed[] | null = null;

// Cerca seed/exercises.json in più posizioni: funziona sia in sviluppo
// (tsx, sorgente in apps/api/src/lib) sia in produzione (bundle tsup in apps/api/dist).
// Il numero di "../" è diverso perché nella build i file .lib e .routes finiscono
// tutti in dist/server.js, che è un livello meno profondo del sorgente.
function findSeedFile(): string | null {
  const candidates = [
    resolve(__dirname, '../../../../seed/exercises.json'), // dev: apps/api/src/lib
    resolve(__dirname, '../../../seed/exercises.json'),    // prod: apps/api/dist
    '/app/seed/exercises.json',                             // fallback assoluto (Docker)
    resolve(process.cwd(), 'seed/exercises.json'),          // fallback cwd
  ];
  for (const path of candidates) {
    try {
      readFileSync(path, 'utf-8');
      return path;
    } catch { /* prova il prossimo */ }
  }
  return null;
}

function loadExercises(): ExerciseSeed[] {
  if (_cachedExercises) return _cachedExercises;
  const seedPath = findSeedFile();
  if (!seedPath) {
    console.warn('⚠ Could not load default exercises from seed/exercises.json (nessun percorso valido)');
    return [];
  }
  try {
    const raw = readFileSync(seedPath, 'utf-8');
    _cachedExercises = JSON.parse(raw) as ExerciseSeed[];
    return _cachedExercises;
  } catch (err) {
    console.warn(`⚠ Could not parse default exercises at ${seedPath}:`, err);
    return [];
  }
}

/**
 * Seeds the 115+ default exercises for a newly created organization.
 * Runs in the background — does not block the registration response.
 */
export async function seedDefaultExercises(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const exercises = loadExercises();
  if (exercises.length === 0) return;

  const data = exercises.map((ex) => ({
    id: `default-${organizationId.slice(0, 8)}-${ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`,
    name: ex.name,
    category: ex.category,
    description: ex.description || null,
    muscleGroups: ex.muscleGroups,
    equipment: ex.equipment,
    organizationId,
  }));

  try {
    await prisma.exercise.createMany({
      data,
      skipDuplicates: true,
    });
    console.log(`✓ Seeded ${data.length} default exercises for org ${organizationId}`);
  } catch (err) {
    // Non-critical — log but don't fail registration
    console.error('⚠ Failed to seed default exercises:', err);
  }
}
