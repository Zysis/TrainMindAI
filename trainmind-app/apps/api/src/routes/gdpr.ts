/**
 * Sprint 5.2 — GDPR Compliance Routes
 *
 * Endpoints:
 *   GET    /gdpr/export          Export all user's personal data (JSON)
 *   DELETE /gdpr/delete-account  Permanently delete user account + all data
 *   GET    /gdpr/consent         Get current consent status
 *   PATCH  /gdpr/consent         Update consent preferences
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { requireMinRole } from '../middleware/rbac.js';

const consentSchema = z.object({
  analytics: z.boolean().optional(),
  marketing: z.boolean().optional(),
  thirdParty: z.boolean().optional(),
});

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
  password: z.string().min(1),
});

export async function gdprRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ─── GET /gdpr/export — Data portability (Art. 20) ────
  app.get('/gdpr/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, organizationId } = request.user;

    const [user, athletes, wellnessLogs, trainingSessions, injuries] = await Promise.all([
      app.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, firstName: true, lastName: true, role: true,
          createdAt: true, updatedAt: true,
        },
      }),
      app.prisma.athlete.findMany({
        where: { organizationId },
        select: {
          id: true, firstName: true, lastName: true, dateOfBirth: true,
          position: true, height: true, weight: true, createdAt: true,
        },
      }),
      app.prisma.wellnessLog.findMany({
        where: { athlete: { organizationId } },
        select: {
          id: true, athleteId: true, date: true, sleepHours: true, sleepQuality: true,
          fatigue: true, soreness: true, stress: true, mood: true, notes: true, createdAt: true,
        },
        orderBy: { date: 'desc' },
        take: 1000,
      }),
      app.prisma.trainingSession.findMany({
        where: { week: { trainingPlan: { organizationId } } },
        select: {
          id: true, title: true, date: true, status: true,
          duration: true, notes: true, createdAt: true,
        },
        orderBy: { date: 'desc' },
        take: 500,
      }),
      app.prisma.injury.findMany({
        where: { athlete: { organizationId } },
        select: {
          id: true, athleteId: true, type: true, location: true, severity: true,
          status: true, dateOccurred: true, dateResolved: true, notes: true,
        },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      format: 'GDPR_DATA_EXPORT_V1',
      user,
      athletes,
      wellnessLogs,
      trainingSessions,
      injuries,
    };

    reply.header('Content-Disposition', `attachment; filename="trainmind-export-${userId}.json"`);
    reply.header('Content-Type', 'application/json');
    return reply.send(exportData);
  });

  // ─── DELETE /gdpr/delete-account — Right to erasure (Art. 17) ──
  app.delete('/gdpr/delete-account', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = deleteAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Conferma "DELETE_MY_ACCOUNT" e inserisci la password per procedere.',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { userId } = request.user;

    // Verify password
    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Utente non trovato' },
      });
    }

    // Verifica password
    const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password non corretta' },
      });
    }

    // Soft-delete + anonimizzazione: preserva l'integrità referenziale
    // (ConsentRecord, AuditLog, invites) senza mantenere dati identificativi.
    // I dati sanitari collegati vengono cancellati subito solo per atleti.
    await app.prisma.$transaction(async (tx) => {
      // Se è un atleta: cancella i dati sanitari collegati al suo profilo Athlete
      if (user.role === 'ATHLETE' && user.athleteId) {
        const athleteId = user.athleteId;
        await tx.wellnessLog.deleteMany({ where: { athleteId } });
        await tx.metric.deleteMany({ where: { athleteId } });
        await tx.clearanceCriteria.deleteMany({ where: { rtpProtocol: { athleteId } } });
        await tx.rTPPhaseLog.deleteMany({ where: { rtpProtocol: { athleteId } } });
        await tx.rTPProtocol.deleteMany({ where: { athleteId } });
        await tx.injury.deleteMany({ where: { athleteId } });
      }

      // Anonimizza l'utente e blocca il login
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@removed.local`,
          firstName: 'Rimosso',
          lastName: 'Rimosso',
          passwordHash: '!disabled',
          refreshToken: null,
          isActive: false,
          deletedAt: new Date(),
          pushSubscription: undefined,
        },
      });
    });

    request.log.info({ userId, role: user.role }, 'GDPR account erasure completed');

    return reply.send({
      success: true,
      data: {
        message: 'Account eliminato. Dati personali anonimizzati e dati sanitari rimossi.',
        deletedAt: new Date().toISOString(),
      },
    });
  });

  // ─── POST /gdpr/erase-athlete/:id — Cancellazione GDPR di un atleta (ADMIN) ──
  // Usato quando un atleta dismesso chiede la cancellazione dei suoi dati.
  // Cancella dati sanitari + anonimizza il profilo Athlete; l'eventuale User
  // collegato viene disattivato.
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/gdpr/erase-athlete/:id',
    { preHandler: [requireMinRole('ADMIN')] },
    async (request, reply) => {
      const { id: athleteId } = request.params;
      const { organizationId, userId: actorId } = request.user;

      const athlete = await app.prisma.athlete.findFirst({
        where: { id: athleteId, organizationId },
      });
      if (!athlete) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Atleta non trovato nella tua organizzazione' },
        });
      }

      await app.prisma.$transaction(async (tx) => {
        await tx.wellnessLog.deleteMany({ where: { athleteId } });
        await tx.metric.deleteMany({ where: { athleteId } });
        await tx.clearanceCriteria.deleteMany({ where: { rtpProtocol: { athleteId } } });
        await tx.rTPPhaseLog.deleteMany({ where: { rtpProtocol: { athleteId } } });
        await tx.rTPProtocol.deleteMany({ where: { athleteId } });
        await tx.injury.deleteMany({ where: { athleteId } });
        await tx.athleteInvite.deleteMany({ where: { athleteId } });

        // Se aveva un account atleta collegato, disattivalo e anonimizzalo
        const linkedUser = await tx.user.findFirst({ where: { athleteId } });
        if (linkedUser) {
          await tx.user.update({
            where: { id: linkedUser.id },
            data: {
              email: `deleted-${linkedUser.id}@removed.local`,
              firstName: 'Rimosso',
              lastName: 'Rimosso',
              passwordHash: '!disabled',
              refreshToken: null,
              isActive: false,
              deletedAt: new Date(),
            },
          });
        }

        // Anonimizza l'anagrafica dell'atleta ma la conserva per integrità
        // referenziale con TrainingPlan/TrainingSession/AlertRule/ecc.
        await tx.athlete.update({
          where: { id: athleteId },
          data: {
            firstName: 'Rimosso',
            lastName: 'Rimosso',
            email: null,
            photoUrl: null,
            isActive: false,
          },
        });
      });

      request.log.info(
        { athleteId, actorId, reason: request.body?.reason },
        'GDPR athlete erasure completed',
      );

      return reply.send({
        success: true,
        data: {
          message: 'Atleta e dati sanitari collegati eliminati.',
          erasedAt: new Date().toISOString(),
        },
      });
    },
  );

  // ─── GET /gdpr/audit-log — Elenco degli accessi ai propri dati ─
  app.get('/gdpr/audit-log', async (request, reply) => {
    const { userId } = request.user;
    const logs = await app.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        method: true,
        path: true,
        ipAddress: true,
        createdAt: true,
      },
    });
    return reply.send({ success: true, data: logs });
  });

  // ─── GET /gdpr/consent — Get consent status ──────────
  app.get('/gdpr/consent', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.user;

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        consentAnalytics: true,
        consentMarketing: true,
        consentThirdParty: true,
        consentUpdatedAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Utente non trovato' },
      });
    }

    return reply.send({
      success: true,
      data: {
        consent: {
          analytics: user.consentAnalytics ?? false,
          marketing: user.consentMarketing ?? false,
          thirdParty: user.consentThirdParty ?? false,
          updatedAt: user.consentUpdatedAt,
        },
      },
    });
  });

  // ─── PATCH /gdpr/consent — Update consent ────────────
  app.patch('/gdpr/consent', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = consentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Preferenze non valide' },
      });
    }

    const { userId } = request.user;
    const data: Record<string, unknown> = { consentUpdatedAt: new Date() };
    if (parsed.data.analytics !== undefined) data.consentAnalytics = parsed.data.analytics;
    if (parsed.data.marketing !== undefined) data.consentMarketing = parsed.data.marketing;
    if (parsed.data.thirdParty !== undefined) data.consentThirdParty = parsed.data.thirdParty;

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        consentAnalytics: true,
        consentMarketing: true,
        consentThirdParty: true,
        consentUpdatedAt: true,
      },
    });

    request.log.info({ userId, consent: parsed.data }, 'GDPR consent updated');

    return reply.send({
      success: true,
      data: {
        consent: {
          analytics: updated.consentAnalytics,
          marketing: updated.consentMarketing,
          thirdParty: updated.consentThirdParty,
          updatedAt: updated.consentUpdatedAt,
        },
      },
    });
  });
}
