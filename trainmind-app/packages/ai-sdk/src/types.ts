import { z } from 'zod';

// ============================================
// Chat Types
// ============================================

/**
 * A single message in a chat conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

/**
 * Request to send a chat message to the AI service
 */
export interface ChatRequest {
  messages: ChatMessage[];
  athlete_id?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  namespaces?: string[];
  top_k?: number;
}

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  athlete_id: z.string().optional(),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  namespaces: z.array(z.string()).optional(),
  top_k: z.number().optional(),
});

/**
 * Response from a chat request (non-streaming)
 */
export interface ChatResponse {
  content: string;
  sources: Source[];
  finish_reason: string;
}

export const ChatResponseSchema = z.object({
  content: z.string(),
  sources: z.array(z.lazy(() => SourceSchema)),
  finish_reason: z.string().optional().default('stop'),
});

/**
 * SSE event types from the streaming chat endpoint
 */
export interface SSEContentEvent {
  type: 'content';
  chunk: string;
}

export interface SSESourcesEvent {
  type: 'sources';
  sources: Source[];
}

export interface SSEDoneEvent {
  type: 'done';
  full_content?: string;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent = SSEContentEvent | SSESourcesEvent | SSEDoneEvent | SSEErrorEvent;

// ============================================
// Generate Types (Training Plans)
// ============================================

/**
 * Request to generate content (e.g., training plans, sessions, exercises)
 */
export interface GenerateRequest {
  prompt: string;
  athlete_id?: string;
  context_type: 'plan' | 'session' | 'exercise';
  namespace?: string;
  top_k?: number;
}

export const GenerateRequestSchema = z.object({
  prompt: z.string(),
  athlete_id: z.string().optional(),
  context_type: z.enum(['plan', 'session', 'exercise']),
  namespace: z.string().optional(),
  top_k: z.number().optional(),
});

/**
 * Response from a generate request
 */
export interface GenerateResponse {
  content: string;
  sources: Source[];
  structured_data?: Record<string, unknown> | null;
}

export const GenerateResponseSchema = z.object({
  content: z.string(),
  sources: z.array(z.lazy(() => SourceSchema)),
  structured_data: z.record(z.unknown()).nullable().optional(),
});

// ============================================
// Coach Types (Q&A)
// ============================================

/**
 * Request to ask the coach (Q&A service)
 */
export interface CoachRequest {
  question: string;
  athlete_id?: string;
  category?: string;
  namespaces?: string[];
  top_k?: number;
}

export const CoachRequestSchema = z.object({
  question: z.string(),
  athlete_id: z.string().optional(),
  category: z.string().optional(),
  namespaces: z.array(z.string()).optional(),
  top_k: z.number().optional(),
});

/**
 * Response from a coach request
 */
export interface CoachResponse {
  answer: string;
  sources: Source[];
  references: string[];
}

export const CoachResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.lazy(() => SourceSchema)),
  references: z.array(z.string()),
});

// ============================================
// Embed Types
// ============================================

/**
 * Request to embed texts into a namespace
 */
export interface EmbedRequest {
  texts: string[];
  namespace: string;
  metadata: Record<string, unknown>[];
}

export const EmbedRequestSchema = z.object({
  texts: z.array(z.string()),
  namespace: z.string(),
  metadata: z.array(z.record(z.unknown())),
});

/**
 * Response from an embed request
 */
export interface EmbedResponse {
  count: number;
  namespace: string;
  details?: Record<string, unknown> | null;
}

export const EmbedResponseSchema = z.object({
  count: z.number().nonnegative(),
  namespace: z.string(),
  details: z.record(z.unknown()).nullable().optional(),
});

/**
 * Statistics about embedded vectors
 */
export interface EmbedStats {
  collections: Record<string, { vector_count: number }>;
  persist_directory: string;
}

export const EmbedStatsSchema = z.object({
  collections: z.record(
    z.object({
      vector_count: z.number().nonnegative(),
    })
  ),
  persist_directory: z.string(),
});

// ============================================
// Shared Types
// ============================================

/**
 * A source reference from the AI service
 */
export interface Source {
  id: string;
  title: string;
  category: string;
  score: number;
  metadata?: Record<string, unknown> | null;
}

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  score: z.number(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

/**
 * Health check response from the AI service
 */
export interface HealthResponse {
  status: string;
  version: string;
  services: Record<string, string>;
}

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  services: z.record(z.string()),
});

// ============================================
// Error Response Types
// ============================================

/**
 * Standard error response from the AI service
 */
export interface ErrorResponse {
  detail: string;
}

export const ErrorResponseSchema = z.object({
  detail: z.string(),
});
