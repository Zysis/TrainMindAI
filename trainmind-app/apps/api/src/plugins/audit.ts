/**
 * Plugin audit: logga automaticamente gli accessi agli endpoint che toccano
 * dati personali o sanitari degli atleti. Traccia chi, cosa, quando e da dove.
 *
 * NOTA: cattura solo risposte 2xx (accesso avvenuto). I fallimenti di auth
 * finiscono nei log applicativi standard, non nell'audit trail.
 */

import fp from 'fastify-plugin';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Pattern URL da tracciare + tipo risorsa associata.
// L'ordine conta: il primo match vince.
const SENSITIVE_PATTERNS: Array<{ re: RegExp; resource: string }> = [
  { re: /^\/api\/v1\/athletes\/([^/?]+)/, resource: 'athlete' },
  { re: /^\/api\/v1\/athletes/, resource: 'athlete' },
  { re: /^\/api\/v1\/wellness/, resource: 'wellness_log' },
  { re: /^\/api\/v1\/injuries/, resource: 'injury' },
  { re: /^\/api\/v1\/rtp/, resource: 'rtp_protocol' },
  { re: /^\/api\/v1\/metrics/, resource: 'metric' },
  { re: /^\/api\/v1\/reports/, resource: 'report' },
  { re: /^\/api\/v1\/athlete\/invite/, resource: 'athlete_invite' },
  { re: /^\/api\/v1\/me\/(account|export|erase)/, resource: 'gdpr' },
];

function matchSensitive(path: string): { resource: string; resourceId?: string } | null {
  // Rimuovi query string per il match
  const cleanPath = path.split('?')[0];
  for (const p of SENSITIVE_PATTERNS) {
    const m = cleanPath.match(p.re);
    if (m) return { resource: p.resource, resourceId: m[1] };
  }
  return null;
}

function actionFor(method: string, resource: string): string {
  const verb = ({ GET: 'read', POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete' })[method] || method.toLowerCase();
  return `${resource}.${verb}`;
}

export default fp(async (app) => {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Log solo risposte 2xx
      if (reply.statusCode < 200 || reply.statusCode >= 300) return;

      const match = matchSensitive(request.url);
      if (!match) return;

      // Endpoint sensibile ma senza utente autenticato → non loggo
      // (accade solo per il flusso di validazione invito, che è pubblico ma
      // non espone dati oltre nome atleta e organizzazione)
      const user = (request as FastifyRequest & { user?: { id?: string; userId?: string; organizationId?: string } }).user;
      const userId = user?.id ?? user?.userId;
      if (!userId) return;

      await app.prisma.auditLog.create({
        data: {
          userId,
          organizationId: user?.organizationId,
          action: actionFor(request.method, match.resource),
          resourceType: match.resource,
          resourceId: match.resourceId,
          method: request.method,
          path: request.url.split('?')[0].slice(0, 500),
          statusCode: reply.statusCode,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent']?.slice(0, 300),
        },
      });
    } catch (err) {
      // L'audit non deve mai far fallire la richiesta
      request.log.warn({ err }, 'audit log write failed');
    }
  });
}, { name: 'audit', dependencies: ['prisma', 'auth'] });
