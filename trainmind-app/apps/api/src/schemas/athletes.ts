import { z } from 'zod';

export const createAthleteSchema = z.object({
  firstName: z.string().min(2, 'Nome troppo corto').max(50),
  lastName: z.string().min(2, 'Cognome troppo corto').max(50),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  position: z.string().min(1, 'Ruolo richiesto'),
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
  position: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['firstName', 'lastName', 'position', 'jerseyNumber', 'createdAt']).default('lastName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  teamId: z.string().optional(),
});

export type CreateAthleteInput = z.infer<typeof createAthleteSchema>;
export type UpdateAthleteInput = z.infer<typeof updateAthleteSchema>;
export type AthleteQuery = z.infer<typeof athleteQuerySchema>;
