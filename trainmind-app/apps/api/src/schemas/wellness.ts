import { z } from 'zod';

export const createWellnessLogSchema = z.object({
  athleteId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleepHours: z.number().min(0).max(24),
  sleepQuality: z.number().int().min(1).max(5),
  fatigue: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  mood: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
});

export const createMetricSchema = z.object({
  athleteId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const wellnessQuerySchema = z.object({
  athleteId: z.string().optional(),
  teamId: z.string().optional(),
  type: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CreateWellnessLogInput = z.infer<typeof createWellnessLogSchema>;
export type CreateMetricInput = z.infer<typeof createMetricSchema>;
export type WellnessQuery = z.infer<typeof wellnessQuerySchema>;
