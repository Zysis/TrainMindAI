/**
 * Base error class for all AI service errors
 */
export class AIServiceError extends Error {
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  /**
   * Create a new AIServiceError
   * @param message - Error message
   * @param statusCode - HTTP status code if applicable
   * @param details - Additional error details
   */
  constructor(
    message: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AIServiceError.prototype);
  }
}

/**
 * Error thrown when a request times out
 */
export class AITimeoutError extends AIServiceError {
  /**
   * Create a new AITimeoutError
   * @param message - Error message
   * @param duration - Timeout duration in milliseconds
   */
  constructor(message: string = 'Request timeout', duration?: number) {
    super(message, undefined, duration ? { timeoutMs: duration } : undefined);
    this.name = 'AITimeoutError';
    Object.setPrototypeOf(this, AITimeoutError.prototype);
  }
}

/**
 * Error thrown when response validation fails
 */
export class AIValidationError extends AIServiceError {
  public readonly validationErrors: unknown;

  /**
   * Create a new AIValidationError
   * @param message - Error message
   * @param validationErrors - Zod or other validation errors
   */
  constructor(message: string, validationErrors: unknown) {
    super(message);
    this.name = 'AIValidationError';
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, AIValidationError.prototype);
  }
}

/**
 * Error thrown when connection to the AI service fails
 */
export class AIConnectionError extends AIServiceError {
  /**
   * Create a new AIConnectionError
   * @param message - Error message
   * @param cause - Underlying error
   */
  constructor(message: string, cause?: Error) {
    super(message, undefined, cause ? { cause: cause.message } : undefined);
    this.name = 'AIConnectionError';
    Object.setPrototypeOf(this, AIConnectionError.prototype);
  }
}
