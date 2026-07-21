import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@trainmind/db';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

export default fp(async (app: FastifyInstance) => {
  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}, { name: 'prisma' });
