import { z } from 'zod';

// ============================================================
// Chat
// ============================================================

/**
 * Numero massimo di messaggi dello storico inviati al modello.
 *
 * Ogni chiamata rimanda tutta la conversazione a OpenAI: senza un limite il
 * costo di input cresce a ogni turno e quello di una singola sessione cresce
 * quadraticamente. Dieci messaggi (cinque scambi) bastano a mantenere il filo
 * del discorso su una domanda tecnica.
 *
 * Sovrascrivibile con AI_CHAT_HISTORY_LIMIT senza ricompilare.
 *
 * La lettura è volutamente dentro la funzione e non a livello di modulo:
 * `lib/load-env.ts` popola process.env solo quando viene importato da
 * server.ts, e leggere qui al caricamento renderebbe il valore dipendente
 * dall'ordine degli import.
 */
function chatHistoryLimit(): number {
  const raw = parseInt(process.env.AI_CHAT_HISTORY_LIMIT ?? '', 10);
  return Number.isFinite(raw) && raw >= 2 ? raw : 10;
}

export const aiChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1),
    })
  )
    .min(1)
    // Si tronca invece di rifiutare: il frontend manda tutta la conversazione
    // e un errore di validazione romperebbe la chat a metà sessione.
    // Si tengono gli ultimi N messaggi, cioè quelli più rilevanti.
    .transform((messages) => {
      const limit = chatHistoryLimit();
      return messages.length > limit ? messages.slice(-limit) : messages;
    }),
  athlete_id: z.string().optional(),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().min(100).max(4096).optional().default(2048),
  namespaces: z.array(z.string()).optional(),
  top_k: z.number().min(1).max(50).optional().default(5),
});

export type AIChatInput = z.infer<typeof aiChatSchema>;

// ============================================================
// Coach
// ============================================================

export const aiCoachSchema = z.object({
  question: z.string().min(1),
  athlete_id: z.string().optional(),
  category: z.string().optional(),
  namespaces: z.array(z.string()).optional(),
  top_k: z.number().min(1).max(50).optional().default(5),
});

export type AICoachInput = z.infer<typeof aiCoachSchema>;

// ============================================================
// Generate
// ============================================================

export const aiGenerateSchema = z.object({
  prompt: z.string().min(1),
  athlete_id: z.string().optional(),
  context_type: z.enum(['plan', 'session', 'exercise']).default('plan'),
  namespace: z.string().optional(),
  top_k: z.number().min(1).max(50).optional().default(5),
});

export type AIGenerateInput = z.infer<typeof aiGenerateSchema>;

// ============================================================
// Wellness Insights
// ============================================================

export const aiWellnessInsightSchema = z.object({
  athlete_id: z.string().optional(),
  days: z.number().min(1).max(90).optional().default(14),
});

export type AIWellnessInsightInput = z.infer<typeof aiWellnessInsightSchema>;

// ============================================================
// RTP Suggest (Return-to-Play AI advisor)
// ============================================================

export const aiRtpSuggestSchema = z.object({
  protocol_id: z.string().min(1),
});
