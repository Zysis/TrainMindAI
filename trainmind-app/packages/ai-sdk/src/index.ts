// ============================================
// TrainMind AI — AI SDK Client
// ============================================
// Typed client for the Node.js backend (Fastify) to communicate with
// the Python AI service running on port 3002.
//
// Features:
// - Full TypeScript support with Zod validation
// - Retry logic with exponential backoff
// - Timeout handling
// - Streaming support via Server-Sent Events
// - Comprehensive error types
//
// @example
// ```typescript
// import { createAIClient } from '@trainmind/ai-sdk';
//
// const client = createAIClient({ baseUrl: 'http://localhost:3002' });
// const response = await client.chat({
//   messages: [{ role: 'user', content: 'Create a training plan' }]
// });
// ```

// ============================================
// Main Exports
// ============================================

export { AIClient, createAIClient } from './client.js';
export type { AIClientOptions } from './client.js';

// ============================================
// Type Exports
// ============================================

export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  SSEEvent,
  SSEContentEvent,
  SSESourcesEvent,
  SSEDoneEvent,
  SSEErrorEvent,
  GenerateRequest,
  GenerateResponse,
  CoachRequest,
  CoachResponse,
  EmbedRequest,
  EmbedResponse,
  EmbedStats,
  Source,
  HealthResponse,
  ErrorResponse,
} from './types.js';

export {
  ChatMessageSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  GenerateRequestSchema,
  GenerateResponseSchema,
  CoachRequestSchema,
  CoachResponseSchema,
  EmbedRequestSchema,
  EmbedResponseSchema,
  EmbedStatsSchema,
  SourceSchema,
  HealthResponseSchema,
  ErrorResponseSchema,
} from './types.js';

// ============================================
// Error Exports
// ============================================

export {
  AIServiceError,
  AITimeoutError,
  AIValidationError,
  AIConnectionError,
} from './errors.js';

// ============================================
// Stream & Utility Exports
// ============================================

export { parseSSEStream, withRetry } from './stream.js';
export type { RetryOptions } from './stream.js';
