import type { FastifyReply } from 'fastify';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (entity: string) => new AppError(404, 'NOT_FOUND', `${entity} not found`);
export const validationError = (_details?: unknown) => new AppError(400, 'VALIDATION_ERROR', 'Invalid data');
export const duplicate = (entity: string) => new AppError(409, 'DUPLICATE', `${entity} already exists`);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export function sendError(reply: FastifyReply, error: AppError, details?: unknown) {
  return reply.status(error.statusCode).send({
    success: false,
    error: { code: error.code, message: error.message, ...(details ? { details } : {}) },
  });
}

export function handleValidation<T>(reply: FastifyReply, result: { success: boolean; data?: T; error?: { flatten: () => { fieldErrors: unknown } } }): T | null {
  if (!result.success) {
    sendError(reply, validationError(null), (result.error as any).flatten().fieldErrors);
    return null;
  }
  return result.data as T;
}
