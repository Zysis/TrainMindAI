import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
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

  // Errori di validazione di zod.
  //
  // Quindici rotte usano `schema.parse(request.query)` invece di
  // `safeParse`, e `parse` solleva una ZodError. Una ZodError non ha
  // `statusCode`, quindi finiva nel ramo generico in fondo: l'utente vedeva
  // 500 "An internal server error occurred" per un dato che aveva sbagliato
  // lui, e i log si riempivano di falsi errori del server che nascondevano
  // quelli veri. Riproducibile con `GET /api/v1/teams?sortBy=nome` o con un
  // `from` in formato ISO su `GET /api/v1/calendar/events`.
  //
  // Il ramo `error.validation` piu' sotto e' un'altra cosa: e' la
  // validazione di schema di Fastify, che qui non si usa.
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted data is invalid',
        details: error.flatten().fieldErrors,
      },
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
