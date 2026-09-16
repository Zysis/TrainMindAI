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
/**
 * Una data che `new Date()` sa leggere. Con un semplice `z.string()` un
 * valore come "ieri" diventava Invalid Date e Prisma rispondeva 500.
 */
const parsableDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Data non valida');

export const athleteWellnessSchema = z.object({
  date: parsableDate, // ISO date
  sleepHours: z.number().min(0).max(24),
  sleepQuality: z.number().int().min(1).max(5),
  fatigue: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  mood: z.number().int().min(1).max(5),
  notes: z.string().max(2000).optional(),
  mediaUrls: z
    .array(
      // `z.string().url()` accetta anche `javascript:...`: se un giorno questi
      // link finiscono in un <a href> sullo schermo del preparatore, sarebbe
      // uno script eseguito nella sua sessione. Solo http(s).
      z.string().url().refine((v) => /^https?:\/\//i.test(v), 'Sono ammessi solo link http(s)'),
    )
    .max(10)
    .optional(),
});

// ─── Session Log (RPE + notes + exercise checks) ────────
export const athleteSessionLogSchema = z.object({
  trainingSessionId: z.string().min(1),
  actualRpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(2000).optional(),
  exerciseChecks: z.record(z.string(), z.boolean()).optional(), // { exerciseId: true/false }
});

// ─── Sessions query ─────────────────────────────────────
export const athleteSessionsQuerySchema = z.object({
  from: parsableDate.optional(),
  to: parsableDate.optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Wellness query ─────────────────────────────────────
export const athleteWellnessQuerySchema = z.object({
  from: parsableDate.optional(),
  to: parsableDate.optional(),
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

// ─── Notifications read ────────────────────────────────
export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});
