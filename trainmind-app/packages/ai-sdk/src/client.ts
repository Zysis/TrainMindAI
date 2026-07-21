import { ZodSchema } from 'zod';
import {
  ChatRequest,
  ChatResponse,
  ChatResponseSchema,
  SSEEvent,
  GenerateRequest,
  GenerateResponse,
  GenerateResponseSchema,
  CoachRequest,
  CoachResponse,
  CoachResponseSchema,
  EmbedRequest,
  EmbedResponse,
  EmbedResponseSchema,
  EmbedStats,
  EmbedStatsSchema,
  HealthResponse,
  HealthResponseSchema,
} from './types.js';
import {
  AIServiceError,
  AITimeoutError,
  AIValidationError,
  AIConnectionError,
} from './errors.js';
import { parseSSEStream, withRetry } from './stream.js';

/**
 * Configuration options for the AIClient
 */
export interface AIClientOptions {
  /** Base URL of the AI service (default: http://localhost:3002) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum number of retry attempts (default: 2) */
  retries?: number;
  /** Enable automatic retries (default: true) */
  enableRetries?: boolean;
}

/**
 * TypeScript client for the TrainMind AI service.
 *
 * All AI endpoints use the /ai prefix (e.g. /ai/chat, /ai/coach, /ai/generate).
 * The health endpoint is at /health (no prefix).
 */
export class AIClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private enableRetries: boolean;

  constructor(options: AIClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3002';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 2;
    this.enableRetries = options.enableRetries !== false;
  }

  /**
   * Health check
   */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>(
      '/health',
      'GET',
      undefined,
      HealthResponseSchema
    );
  }

  /**
   * Send a chat message (non-streaming)
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>(
      '/ai/chat',
      'POST',
      { ...request, stream: false },
      ChatResponseSchema
    );
  }

  /**
   * Stream a chat response via SSE.
   *
   * Yields parsed SSE events (content chunks, sources, done, error).
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<SSEEvent> {
    const response = await this.fetchWithTimeout('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      throw new AIServiceError(
        `Chat stream failed with status ${response.status}`,
        response.status
      );
    }

    for await (const rawData of parseSSEStream(response)) {
      try {
        const event = JSON.parse(rawData) as SSEEvent;
        yield event;
      } catch {
        // Raw text chunk fallback
        yield { type: 'content', chunk: rawData };
      }
    }
  }

  /**
   * Generate content (plans, sessions, exercises)
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    return this.request<GenerateResponse>(
      '/ai/generate',
      'POST',
      request,
      GenerateResponseSchema
    );
  }

  /**
   * Ask the coach a question
   */
  async coach(request: CoachRequest): Promise<CoachResponse> {
    return this.request<CoachResponse>(
      '/ai/coach',
      'POST',
      request,
      CoachResponseSchema
    );
  }

  /**
   * Embed texts into a namespace
   */
  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    return this.request<EmbedResponse>(
      '/ai/embed',
      'POST',
      request,
      EmbedResponseSchema
    );
  }

  /**
   * Get embedding statistics
   */
  async embedStats(): Promise<EmbedStats> {
    return this.request<EmbedStats>(
      '/ai/embed/stats',
      'GET',
      undefined,
      EmbedStatsSchema
    );
  }

  /**
   * Internal: make HTTP request with validation
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown,
    schema?: ZodSchema
  ): Promise<T> {
    const fn = async (): Promise<T> => {
      const response = await this.fetchWithTimeout(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // Ignore
        }
        throw new AIServiceError(errorMessage, response.status);
      }

      const data = await response.json();

      if (schema) {
        try {
          return schema.parse(data) as T;
        } catch (error) {
          throw new AIValidationError(
            'Response validation failed',
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      return data as T;
    };

    if (this.enableRetries) {
      return withRetry(fn, {
        maxRetries: this.retries,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });
    }

    return fn();
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    endpoint: string,
    options: RequestInit
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AITimeoutError(`Request timeout after ${this.timeout}ms`, this.timeout);
      }
      if (error instanceof TypeError) {
        throw new AIConnectionError('Failed to connect to AI service', error as Error);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Factory function to create an AIClient instance
 */
export function createAIClient(options: AIClientOptions = {}): AIClient {
  return new AIClient(options);
}
