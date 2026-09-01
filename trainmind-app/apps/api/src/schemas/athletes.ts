import { z } from 'zod';

// ─── Ruolo di gioco ─────────────────────────────────────
// Nel database sta la sigla. Questa lista deve restare allineata a
// `apps/web/src/lib/constants/positions.ts` e ai seed: e' la divergenza fra
// quelle tre copie che aveva rotto il filtro per ruolo.
const POSITION_CODES = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const POSITION_BY_NAME: Record<string, string> = {
  'point guard': 'PG',
  'shooting guard': 'SG',
  'small forward': 'SF',
  'power forward': 'PF',
  'center': 'C',
};

/** Accetta sigla o nome per esteso, restituisce sempre la sigla. */
function toPositionCode(value: string): string {
  const trimmed = value.trim();
  return POSITION_BY_NAME[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

const positionSchema = z
  .string()
  .min(1, 'Ruolo richiesto')
  .transform(toPositionCode)
  .refine((v) => (POSITION_CODES as readonly string[]).includes(v), 'Ruolo non valido');

export const createAthleteSchema = z.object({
  firstName: z.string().min(2, 'Nome troppo corto').max(50),
  lastName: z.string().min(2, 'Cognome troppo corto').max(50),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  position: positionSchema,
  jerseyNumber: z.number().int().min(0).max(99).optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  email: z.string().email('Email non valida').optional(),
  team: z.string().max(100).optional(),
  photoUrl: z.string().optional(),
});

export const updateAthleteSchema = createAthleteSchema.partial();

export const athleteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  // Anche il filtro normalizza: un client fermo ai nomi per esteso continua a
  // filtrare correttamente invece di ricevere zero risultati in silenzio.
  position: z.string().optional().transform((v) => (v ? toPositionCode(v) : v)),
  // Assente = solo attivi. 'false' = solo archiviati. 'all' = tutti.
  isActive: z.enum(['true', 'false', 'all']).optional(),
  sortBy: z.enum(['firstName', 'lastName', 'position', 'jerseyNumber', 'createdAt']).default('lastName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  teamId: z.string().optional(),
});

export type CreateAthleteInput = z.infer<typeof createAthleteSchema>;
export type UpdateAthleteInput = z.infer<typeof updateAthleteSchema>;
export type AthleteQuery = z.infer<typeof athleteQuerySchema>;
