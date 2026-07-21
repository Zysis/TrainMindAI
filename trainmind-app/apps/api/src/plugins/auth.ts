import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      id: string;
      email: string;
      role: string;
      organizationId: string;
    };
    user: {
      userId: string;
      /** Alias of userId for backward compat with routes that destructure `id`. */
      id: string;
      email: string;
      role: string;
      organizationId: string;
    };
  }
}

export default fp(async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-must-be-at-least-32-chars-long',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token non valido o scaduto',
        },
      });
    }
  });
}, { name: 'auth', dependencies: ['prisma'] });
