import { z } from 'zod';

// ============================================================
// Chat
// ============================================================

export const aiChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1),
    })
  ).min(1),
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
