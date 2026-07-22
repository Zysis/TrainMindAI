import { z } from 'zod';

/**
 * Signup form:
 *  - `acceptTerms` e `acceptPrivacy` sono OBBLIGATORI (proof-of-consent).
 *  - `consentHealthData` è OBBLIGATORIO per l'attivazione delle feature di IA sui dati
 *    salute/fitness (art. 9(2)(a) GDPR — consenso esplicito). Se false, l'utente potrà
 *    comunque usare il Servizio ma senza feature IA.
 *  - `dateOfBirth` serve per il gate 14+ (art. 8 GDPR / art. 2-quinquies D.lgs. 196/2003).
 *  - `acceptMarketing` è FACOLTATIVO (opt-in separato, revocabile).
 *  - `uiLanguage` è la lingua della UI al momento dell'accettazione (proof).
 */
export const registerSchema = z
  .object({
    email: z.string().email('Email non valida'),
    password: z
      .string()
      .min(8, 'La password deve avere almeno 8 caratteri')
      .regex(/[A-Z]/, 'La password deve contenere almeno una maiuscola')
      .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
    firstName: z.string().min(2, 'Nome troppo corto').max(50),
    lastName: z.string().min(2, 'Cognome troppo corto').max(50),
    organizationName: z.string().min(2, 'Nome organizzazione troppo corto').max(100),
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
    // Gate età: minimo 14 anni compiuti alla data odierna
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
        message:
          'Per registrarti devi avere almeno 14 anni. Se sei minorenne, un genitore deve creare l\'account per te.',
      });
    }
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
