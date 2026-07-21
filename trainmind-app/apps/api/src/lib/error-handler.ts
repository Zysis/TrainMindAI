import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './api-errors.js';

export function errorHandler(
  error: FastifyError | AppError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  // Handle AppError thrown from routes / services
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: { code: error.code, message: error.message },
    });
  }

  const statusCode = error.statusCode || 500;

  // Log server errors
  if (statusCode >= 500) {
    _request.log.error(error);
  }

  // Zod validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted data is invalid',
        details: error.validation,
      },
    });
  }

  // Rate limit errors
  if (statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    });
  }

  // Generic error response
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message:
        statusCode >= 500
          ? 'An internal server error occurred'
          : error.message,
    },
  });
}
