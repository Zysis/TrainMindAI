import { z } from 'zod';
import { passwordField } from './auth.js';

/**
 * Invito a un membro dello staff.
 *
 * Il ruolo e' obbligatorio e non ammette ATHLETE: gli atleti entrano dal loro
 * invito, che li collega a un'anagrafica esistente e non consuma un posto del
 * piano. Ammetterlo qui vorrebbe dire creare atleti senza scheda e far pagare
 * alla societa' un posto da preparatore per ognuno.
 */
export const createStaffInviteSchema = z.object({
  email: z.string().email('Email non valida').max(200),
  role: z.enum(['ADMIN', 'TRAINER', 'MEDICAL', 'VIEWER']).default('TRAINER'),
});

/**
 * Completamento della registrazione da invito staff.
 *
 * Non c'e' `organizationName`: l'organizzazione arriva dal token, ed e'
 * esattamente questo che impedisce di entrare in una societa' altrui
 * indovinandone il nome. Non c'e' nemmeno `email`, per lo stesso motivo —
 * l'indirizzo e' quello a cui l'invito e' stato spedito.
 *
 * I consensi invece ci sono tutti: chi entra su invito e' un utente come gli
 * altri e le sue accettazioni vanno registrate con la stessa tracciabilita'
 * di chi si registra dalla landing.
 */
export const staffRegisterSchema = z
  .object({
    token: z.string().min(1, 'Token richiesto'),
    password: passwordField,
    firstName: z.string().min(2, 'Nome troppo corto').max(50),
    lastName: z.string().min(2, 'Cognome troppo corto').max(50),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data di nascita non valida (YYYY-MM-DD)'),
    acceptTerms: z
      .boolean()
      .refine((v) => v === true, 'Devi accettare i Termini di Servizio per registrarti'),
    acceptPrivacy: z
      .boolean()
      .refine((v) => v === true, 'Devi dichiarare di aver letto l\'Informativa Privacy'),
    consentHealthData: z.boolean().optional().default(false),
    acceptMarketing: z.boolean().optional().default(false),
    uiLanguage: z.enum(['it', 'en', 'es']).optional().default('it'),
  })
  .superRefine((data, ctx) => {
    // Stesso cancello eta' della registrazione normale (art. 8 GDPR): chi
    // entra su invito non e' un utente di serie B e la regola non cambia.
    const dob = new Date(data.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return;
    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const m = today.getUTCMonth() - dob.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age -= 1;
    if (age < 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateOfBirth'],
        message: 'Per registrarti devi avere almeno 14 anni.',
      });
    }
  });

export type CreateStaffInviteInput = z.infer<typeof createStaffInviteSchema>;
export type StaffRegisterInput = z.infer<typeof staffRegisterSchema>;
