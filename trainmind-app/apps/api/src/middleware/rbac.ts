import type { FastifyRequest, FastifyReply } from 'fastify';

// Role hierarchy: ADMIN > TRAINER > MEDICAL > VIEWER > ATHLETE
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 40,
  TRAINER: 30,
  MEDICAL: 20,
  VIEWER: 10,
  ATHLETE: 5,
};

/**
 * RBAC middleware factory — returns a preHandler that checks
 * if the authenticated user has the minimum required role.
 *
 * Usage in routes:
 *   { preHandler: [app.authenticate, requireRole('TRAINER')] }
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user;

    if (!allowedRoles.includes(role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Non hai i permessi per accedere a questa risorsa',
          requiredRoles: allowedRoles,
          currentRole: role,
        },
      });
    }
  };
}

/**
 * Alternative: minimum role level check.
 * requireMinRole('TRAINER') allows TRAINER and ADMIN.
 */
export function requireMinRole(minRole: string) {
  const minLevel = ROLE_HIERARCHY[minRole] || 0;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user;
    const userLevel = ROLE_HIERARCHY[role] || 0;

    if (userLevel < minLevel) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Non hai i permessi per accedere a questa risorsa',
          requiredMinRole: minRole,
          currentRole: role,
        },
      });
    }
  };
}

/**
 * Require ATHLETE role. Checks JWT user is an athlete.
 */
export function requireAthlete() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user;
    if (role !== 'ATHLETE') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Accesso riservato agli atleti' },
      });
    }
  };
}

/**
 * Check if user belongs to the same organization as the resource.
 * Use with authenticate middleware.
 */
export function requireSameOrganization(getOrgId: (request: FastifyRequest) => string | Promise<string>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userOrgId = request.user.organizationId;
    const resourceOrgId = await getOrgId(request);

    if (userOrgId !== resourceOrgId) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Non puoi accedere a risorse di altre organizzazioni',
        },
      });
    }
  };
}
