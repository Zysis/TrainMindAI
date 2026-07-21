import { AIServiceError } from './errors.js';

/**
 * Parse Server-Sent Events (SSE) from a Response stream
 *
 * Handles standard SSE format with "data: " prefixes and proper line handling
 *
 * @param response - Response object from fetch with a readable body
 * @returns AsyncGenerator yielding parsed SSE data lines
 *
 * @example
 * ```typescript
 * const response = await fetch('http://localhost:3002/chat/stream', {
 *   method: 'POST',
 *   body: JSON.stringify({ messages: [...] })
 * });
 *
 * for await (const chunk of parseSSEStream(response)) {
 *   console.log('Received:', chunk);
 * }
 * ```
 */
export async function* parseSSEStream(response: Response): AsyncGenerator<string> {
  if (!response.body) {
    throw new AIServiceError('Response has no body stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining buffer content
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') {
              yield data;
            }
          }
        }
        break;
      }

      // Append new chunk to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines[lines.length - 1]; // Keep incomplete line in buffer

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();

        // Skip empty lines and comments
        if (!line || line.startsWith(':')) {
          continue;
        }

        // Parse SSE format: "data: <content>"
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          // [DONE] is a special marker to signal end of stream
          if (data === '[DONE]') {
            break;
          }

          if (data) {
            yield data;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds (default: 100) */
  initialDelayMs?: number;
  /** Maximum backoff delay in milliseconds (default: 10000) */
  maxDelayMs?: number;
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add random jitter to backoff (default: true) */
  useJitter?: boolean;
}

/**
 * Execute a function with exponential backoff retry logic
 *
 * Implements exponential backoff with optional jitter. Useful for handling
 * transient failures like network timeouts or rate limits.
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the function
 *
 * @throws Last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('http://localhost:3002/health'),
 *   { maxRetries: 3, initialDelayMs: 100 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    useJitter = true,
  } = options;

  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxRetries) {
        break;
      }

      // Calculate backoff with optional jitter
      let backoffMs = Math.min(delayMs, maxDelayMs);
      if (useJitter) {
        backoffMs = backoffMs * (0.5 + Math.random());
      }

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      delayMs *= backoffMultiplier;
    }
  }

  throw lastError || new AIServiceError('Request failed after all retries');
}
