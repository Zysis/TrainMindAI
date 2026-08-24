import io

p = 'apps/api/src/routes/field-training.ts'
s = io.open(p, encoding='utf-8').read()

# 1. header docs
old_doc = " *   PUT    /field-training/:id/entries       bulk save timer data (autosave)\n"
new_doc = (" *   PUT    /field-training/:id/entries       bulk save timer data (autosave)\n"
           " *   PUT    /field-training/:id/exercises     save exercises + available athletes\n")
assert s.count(old_doc) == 1
s = s.replace(old_doc, new_doc)

# 2. new endpoint, inserted before "POST /field-training/:id/athletes"
anchor = "  // ─── POST /field-training/:id/athletes ──────────────────\n"
assert s.count(anchor) == 1

endpoint = '''  // ─── PUT /field-training/:id/exercises ──────────────────
  // Save the exercise table (name, players, courts, stopwatch totals) + available athletes
  app.put<{ Params: { id: string } }>(
    '/field-training/:id/exercises',
    auth,
    async (request, reply) => {
      const exerciseSchema = z.object({
        id: z.string().min(1),
        name: z.string().max(200),
        isWarmup: z.boolean(),
        players: z.number().int().min(0).max(999),
        courts: z.number().int().min(0).max(99),
        activityMs: z.number().int().min(0),
        pauseMs: z.number().int().min(0),
        breakMs: z.number().int().min(0),
        state: z.enum(['idle', 'running', 'paused', 'done']),
        breakRunning: z.boolean(),
      });
      const schema = z.object({
        availableAthletes: z.number().int().min(0).max(999).nullable().optional(),
        exercises: z.array(exerciseSchema).max(100),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati esercizi non validi', details: parsed.error.flatten() } });
      }

      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      await app.prisma.fieldTrainingSession.update({
        where: { id: session.id },
        data: {
          exercises: parsed.data.exercises as unknown as Prisma.InputJsonValue,
          ...(parsed.data.availableAthletes !== undefined
            ? { availableAthletes: parsed.data.availableAthletes }
            : {}),
        },
      });

      return reply.send({ success: true, data: { saved: parsed.data.exercises.length } });
    },
  );

'''

s = s.replace(anchor, endpoint + anchor)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('api ok')
