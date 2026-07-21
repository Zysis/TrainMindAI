import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  // Basic health check
  app.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'trainmind-api',
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
    });
  });

  // Readiness check (includes DB connectivity)
  app.get('/health/ready', async (_request, reply) => {
    try {
      // TODO: Add DB ping when Prisma is connected (Sprint 1.2)
      return reply.send({
        status: 'ok',
        checks: {
          database: 'pending', // Will be 'ok' after DB setup
          redis: 'pending',
        },
      });
    } catch (error) {
      return reply.status(503).send({
        status: 'error',
        checks: {
          database: 'error',
          redis: 'error',
        },
      });
    }
  });
}
