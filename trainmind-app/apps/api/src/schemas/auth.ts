import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z
    .string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .regex(/[A-Z]/, 'La password deve contenere almeno una maiuscola')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
  firstName: z.string().min(2, 'Nome troppo corto').max(50),
  lastName: z.string().min(2, 'Cognome troppo corto').max(50),
  organizationName: z.string().min(2, 'Nome organizzazione troppo corto').max(100),
  acceptTerms: z
    .boolean()
    .refine((v) => v === true, 'Devi accettare i Termini di Servizio per registrarti'),
});

export const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token richiesto'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
