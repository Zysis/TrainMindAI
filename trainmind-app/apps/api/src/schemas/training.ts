import { z } from 'zod';

// ─── Training Plan ──────────────────────────────────────────
export const createTrainingPlanSchema = z.object({
  name: z.string().min(2, 'Nome troppo corto').max(100),
  description: z.string().max(10000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data: YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data: YYYY-MM-DD'),
  athleteId: z.string().min(1).optional(),
  teamId: z.string().optional(),
  weeks: z.number().int().min(1).max(52).default(4),
});

export const updateTrainingPlanSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(10000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const trainingPlanQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  athleteId: z.string().min(1).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'startDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  teamId: z.string().optional(),
});

// ─── Week ───────────────────────────────────────────────────
export const updateWeekSchema = z.object({
  notes: z.string().max(500).optional(),
});

// ─── Training Session ───────────────────────────────────────
export const createSessionSchema = z.object({
  title: z.string().min(2, 'Titolo troppo corto').max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data: YYYY-MM-DD').optional(),
  duration: z.number().int().min(1).max(300).optional(),
  notes: z.string().max(5000).optional(),
  athleteId: z.string().min(1).optional(),
});

// ─── Session Template ──────────────────────────────────────
export const createTemplateSchema = z.object({
  title: z.string().min(2, 'Titolo troppo corto').max(100),
  duration: z.number().int().min(1).max(300).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateSessionSchema = z.object({
  title: z.string().min(2).max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration: z.number().int().min(1).max(300).optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Session Exercise ───────────────────────────────────────
export const addSessionExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  orderIndex: z.number().int().min(0).default(0),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().max(20).optional(), // e.g. "8-12"
  weight: z.number().positive().optional(),
  duration: z.number().int().positive().optional(), // seconds
  restTime: z.number().int().min(0).max(600).optional(), // seconds
  notes: z.string().max(500).optional(),
});

export const updateSessionExerciseSchema = addSessionExerciseSchema.partial().omit({ exerciseId: true });

export const reorderExercisesSchema = z.object({
  exercises: z.array(z.object({
    id: z.string().min(1),
    orderIndex: z.number().int().min(0),
  })),
});

// ─── Session Log (actual performance) ───────────────────────
export const createSessionLogSchema = z.object({
  actualRpe: z.number().int().min(1).max(10).optional(),
  actualDuration: z.number().int().positive().optional(),
  completedSets: z.record(z.unknown()).optional(), // JSON for per-exercise tracking
  notes: z.string().max(1000).optional(),
});

export type CreateTrainingPlanInput = z.infer<typeof createTrainingPlanSchema>;
export type UpdateTrainingPlanInput = z.infer<typeof updateTrainingPlanSchema>;
export type TrainingPlanQuery = z.infer<typeof trainingPlanQuerySchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type AddSessionExerciseInput = z.infer<typeof addSessionExerciseSchema>;
