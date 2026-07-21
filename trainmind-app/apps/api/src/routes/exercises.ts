import type { FastifyInstance } from 'fastify';
import { createExerciseSchema, updateExerciseSchema, exerciseQuerySchema } from '../schemas/exercises.js';
import { requireMinRole } from '../middleware/rbac.js';
import { sendError, notFound, handleValidation, AppError } from '../lib/api-errors.js';
import { findOrgEntity } from '../lib/org-guard.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ExerciseSeed {
  name: string;
  category: string;
  description?: string;
  muscleGroups: string[];
  equipment: string[];
}

export async function exerciseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ─── GET /exercises — List with filters + full-text search ─
  app.get('/exercises', async (request, reply) => {
    const query = exerciseQuerySchema.parse(request.query);
    const { organizationId } = request.user;
    const { page, limit, search, category, muscleGroup, onlyCustom, sortBy, sortOrder } = query;

    const where: Record<string, unknown> = { organizationId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (muscleGroup) where.muscleGroups = { has: muscleGroup };
    if (onlyCustom) where.isDefault = false;

    const [exercises, total] = await Promise.all([
      app.prisma.exercise.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      app.prisma.exercise.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: exercises,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ─── GET /exercises/:id ────────────────────────────────────
  app.get<{ Params: { id: string } }>('/exercises/:id', async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const exercise = await app.prisma.exercise.findFirst({ where: { id, organizationId } });
    if (!exercise) {
      return sendError(reply, notFound('Exercise'));
    }

    return reply.send({ success: true, data: exercise });
  });

  // ─── POST /exercises ───────────────────────────────────────
  app.post('/exercises', { preHandler: [requireMinRole('TRAINER')] }, async (request, reply) => {
    const parsed = createExerciseSchema.safeParse(request.body);
    const data = handleValidation(reply, parsed);
    if (!data) return;

    const { organizationId } = request.user;
    const exercise = await app.prisma.exercise.create({
      data: { ...data, organizationId },
    });

    return reply.status(201).send({ success: true, data: exercise });
  });

  // ─── PUT /exercises/:id ────────────────────────────────────
  app.put<{ Params: { id: string } }>('/exercises/:id', { preHandler: [requireMinRole('TRAINER')] }, async (request, reply) => {
    const parsed = updateExerciseSchema.safeParse(request.body);
    const data = handleValidation(reply, parsed);
    if (!data) return;

    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'exercise', id, organizationId);

    const exercise = await app.prisma.exercise.update({ where: { id }, data });
    return reply.send({ success: true, data: exercise });
  });

  // ─── DELETE /exercises/:id ──────────────────────────────────
  app.delete<{ Params: { id: string } }>('/exercises/:id', { preHandler: [requireMinRole('TRAINER')] }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'exercise', id, organizationId);

    // Check if exercise is used in any session
    const usedCount = await app.prisma.sessionExercise.count({ where: { exerciseId: id } });
    if (usedCount > 0) {
      return sendError(
        reply,
        new AppError(409, 'EXERCISE_IN_USE', `This exercise is used in ${usedCount} sessions. Remove it from sessions before deleting.`),
      );
    }

    await app.prisma.exercise.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Exercise deleted' } });
  });

  // ─── GET /exercises/categories — List unique categories ────
  app.get('/exercises/categories', async (request, reply) => {
    const { organizationId } = request.user;
    const categories = await app.prisma.exercise.findMany({
      where: { organizationId },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return reply.send({
      success: true,
      data: categories.map((c) => c.category),
    });
  });

  // ─── POST /exercises/seed-defaults — Import default exercises ──
  app.post('/exercises/seed-defaults', { preHandler: [requireMinRole('TRAINER')] }, async (request, reply) => {
    const { organizationId } = request.user;

    try {
      const __dir = dirname(fileURLToPath(import.meta.url));
      // Vedi seed-default-exercises.ts: la profondità cambia tra sorgente e bundle
      const candidates = [
        resolve(__dir, '../../../../seed/exercises.json'), // dev: apps/api/src/routes
        resolve(__dir, '../../../seed/exercises.json'),    // prod: apps/api/dist
        '/app/seed/exercises.json',
        resolve(process.cwd(), 'seed/exercises.json'),
      ];
      let raw: string | null = null;
      for (const p of candidates) {
        try { raw = readFileSync(p, 'utf-8'); break; } catch { /* prova il prossimo */ }
      }
      if (!raw) {
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL', message: 'seed/exercises.json non trovato' },
        });
      }
      const exercises = JSON.parse(raw) as ExerciseSeed[];

      // Get all existing exercise names for this org to skip duplicates
      const allExisting = await app.prisma.exercise.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      });
      const existingNames = new Set(allExisting.map((e) => e.name.toLowerCase()));

      let created = 0;
      let skipped = 0;

      for (const ex of exercises) {
        if (existingNames.has(ex.name.toLowerCase())) {
          skipped++;
          continue;
        }

        await app.prisma.exercise.create({
          data: {
            name: ex.name,
            category: ex.category,
            description: ex.description || null,
            muscleGroups: ex.muscleGroups,
            equipment: ex.equipment,
            isDefault: true,
            organizationId,
          },
        });
        created++;
        existingNames.add(ex.name.toLowerCase());
      }

      return reply.send({
        success: true,
        data: { created, skipped, total: exercises.length },
      });
    } catch (err) {
      request.log.error(err, 'exercises/seed-defaults error');
      const message = err instanceof Error ? err.message : 'Exercise import failed';
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message } });
    }
  });
}
