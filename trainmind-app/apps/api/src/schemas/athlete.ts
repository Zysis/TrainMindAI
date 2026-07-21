import { z } from 'zod';

// ─── Invite ─────────────────────────────────────────────
export const createInviteSchema = z.object({
  athleteId: z.string().min(1),
  email: z.string().email(),
});

export const registerFromInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password minimo 8 caratteri'),
  acceptTerms: z
    .boolean()
    .refine((v) => v === true, 'Devi accettare i Termini di Servizio'),
  acceptHealthData: z
    .boolean()
    .refine((v) => v === true, 'Il consenso al trattamento dei dati sanitari è necessario per usare l\'app'),
  ageConfirmed: z
    .boolean()
    .refine((v) => v === true, 'È necessaria la conferma sull\'età / consenso del genitore'),
});

// ─── Wellness (athlete self-report) ─────────────────────
export const athleteWellnessSchema = z.object({
  date: z.string(), // ISO date
  sleepHours: z.number().min(0).max(24),
  sleepQuality: z.number().int().min(1).max(5),
  fatigue: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  mood: z.number().int().min(1).max(5),
  notes: z.string().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
});

// ─── Session Log (RPE + notes + exercise checks) ────────
export const athleteSessionLogSchema = z.object({
  trainingSessionId: z.string().min(1),
  actualRpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
  exerciseChecks: z.record(z.string(), z.boolean()).optional(), // { exerciseId: true/false }
});

// ─── Sessions query ─────────────────────────────────────
export const athleteSessionsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Wellness query ─────────────────────────────────────
export const athleteWellnessQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// ─── Push subscription ─────────────────────────────────
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
