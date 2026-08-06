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

/**
 * Prefissi accessibili anche al ruolo ATHLETE.
 *
 * Perche' una lista di eccezioni e non una guardia per rotta:
 *   Questo backend serve la dashboard dei preparatori. Le sue rotte di lettura
 *   restituiscono dati di TUTTI gli atleti dell'organizzazione — anagrafiche,
 *   wellness, infortuni, protocolli di rientro — cioe' anche dati sanitari ex
 *   art. 9 GDPR. La protezione per ruolo era applicata alle scritture ma non
 *   alle letture, lasciando ~55 rotte GET leggibili da qualunque utente
 *   autenticato, atleti inclusi.
 *
 *   Proteggerle una per una avrebbe richiesto 55 modifiche e ogni rotta futura
 *   avrebbe ripetuto la dimenticanza. Qui invece il default e' "negato" e le
 *   eccezioni sono esplicite: una rotta nuova nasce protetta.
 *
 * Cosa resta accessibile e perche':
 *   - /athlete/*  e' l'API dedicata all'app atleti
 *   - /auth/*     login, refresh, logout, gestione password
 *   - /gdpr/*     opera SOLO sui dati dell'utente autenticato (export,
 *                 cancellazione account, consensi, audit log propri): negarla
 *                 priverebbe l'atleta di diritti garantiti dal GDPR.
 *                 L'unica rotta amministrativa del gruppo, /gdpr/erase/:id,
 *                 ha gia' una guardia requireMinRole('ADMIN') propria.
 *   - /health     diagnostica
 *
 * Nota: il confronto usa '/api/v1/athlete/' CON la barra finale, altrimenti
 * combacerebbe anche con '/api/v1/athletes', che e' la rosa lato preparatori.
 */
const ATHLETE_ALLOWED_PREFIXES = [
  '/api/v1/athlete/',
  '/api/v1/auth/',
  '/api/v1/gdpr/',
  '/api/v1/health',
];

function isAthleteAllowed(url: string): boolean {
  return ATHLETE_ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix));
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
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token non valido o scaduto',
        },
      });
    }

    // Confine fra le due applicazioni. Usiamo il pattern della rotta
    // (routeOptions.url, es. "/api/v1/athletes/:id") e non request.url, che
    // conterrebbe i valori dei parametri e la query string.
    if (request.user.role === 'ATHLETE') {
      const routeUrl = request.routeOptions?.url ?? request.url;
      if (!isAthleteAllowed(routeUrl)) {
        request.log.warn(
          { userId: request.user.userId, route: routeUrl },
          'Accesso negato: ruolo ATHLETE su rotta riservata allo staff',
        );
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Questa area e riservata allo staff tecnico. Usa l\'app atleti.',
          },
        });
      }
    }
  });
}, { name: 'auth', dependencies: ['prisma'] });
