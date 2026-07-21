import type { FastifyInstance } from 'fastify';
import { notFound } from './api-errors.js';

export async function findOrgEntity<T>(
  app: FastifyInstance,
  model: string,
  id: string,
  organizationId: string,
  include?: Record<string, unknown>,
): Promise<T> {
  const entity = await (app.prisma as any)[model].findFirst({
    where: { id, organizationId },
    ...(include ? { include } : {}),
  });
  if (!entity) throw notFound(model);
  return entity as T;
}
