import { z } from 'zod';

export const createExerciseSchema = z.object({
  name: z.string().min(2, 'Nome troppo corto').max(100),
  category: z.string().min(1, 'Categoria richiesta'),
  description: z.string().max(1000).optional(),
  muscleGroups: z.array(z.string()).default([]),
  equipment: z.array(z.string()).default([]),
  videoUrl: z.string().url().optional(),
});

export const updateExerciseSchema = createExerciseSchema.partial();

export const exerciseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  muscleGroup: z.string().optional(),
  onlyCustom: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'category', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export type ExerciseQuery = z.infer<typeof exerciseQuerySchema>;
