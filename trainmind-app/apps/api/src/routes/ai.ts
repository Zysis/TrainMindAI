import type { FastifyInstance } from 'fastify';
import { aiChatSchema, aiCoachSchema, aiGenerateSchema, aiWellnessInsightSchema, aiRtpSuggestSchema } from '../schemas/ai.js';
import { requireMinRole } from '../middleware/rbac.js';
import { openAIGenerate, openAIChat, isOpenAIFallbackAvailable } from '../lib/openai-fallback.js';

/**
 * AI Service URL (Python FastAPI on port 3002)
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';

/** Timeout for AI service requests (60s default, longer for generate) */
const AI_TIMEOUT_MS = 60_000;
const AI_GENERATE_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;

/**
 * Sleep helper for retry delay.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Proxy a request to the AI service with timeout and retry logic.
 *
 * Retry strategy:
 * - 5xx / timeout: retry up to MAX_RETRIES times with exponential backoff
 * - 4xx: no retry (client error)
 * - Connection refused: no retry on first attempt, fail immediately with helpful message
 */
async function proxyToAI(
  endpoint: string,
  body: unknown,
  options: { timeoutMs?: number } = {}
): Promise<Response> {
  const url = `${AI_SERVICE_URL}${endpoint}`;
  const timeout = options.timeoutMs || AI_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });

      // Don't retry client errors
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry server errors
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new Error(`AI service returned ${response.status}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Connection refused — don't retry, service is down
      if (lastError.message.includes('ECONNREFUSED') || lastError.message.includes('fetch failed')) {
        throw new Error('AI_SERVICE_DOWN');
      }

      // Timeout — retry
      if (lastError.name === 'TimeoutError' || lastError.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error('AI_SERVICE_TIMEOUT');
      }

      // Other error — retry
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('AI_SERVICE_UNAVAILABLE');
}

/**
 * Map internal error codes to user-friendly messages.
 */
function aiErrorResponse(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg === 'AI_SERVICE_DOWN') {
    return {
      status: 503,
      body: {
        success: false,
        error: {
          code: 'AI_SERVICE_DOWN',
          message: 'Il servizio AI non è avviato. Avvia il servizio AI e riprova.',
          retryable: true,
        },
      },
    };
  }

  if (msg === 'AI_SERVICE_TIMEOUT') {
    return {
      status: 504,
      body: {
        success: false,
        error: {
          code: 'AI_SERVICE_TIMEOUT',
          message: 'Il servizio AI sta impiegando troppo tempo. Riprova con una domanda più semplice.',
          retryable: true,
        },
      },
    };
  }

  return {
    status: 503,
    body: {
      success: false,
      error: {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'Servizio AI non raggiungibile. Riprova tra qualche secondo.',
        retryable: true,
      },
    },
  };
}

export async function aiRoutes(app: FastifyInstance) {
  // All AI routes require authentication
  app.addHook('preHandler', app.authenticate);

  // ─── POST /ai/chat — Chat with RAG (streaming or not) ────
  app.post('/ai/chat', async (request, reply) => {
    const parsed = aiChatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input non valido',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const response = await proxyToAI('/ai/chat', parsed.data);

      if (!response.ok) {
        const errBody = await response.text();
        app.log.error({ status: response.status, body: errBody }, 'AI chat error');
        return reply.status(response.status).send({
          success: false,
          error: { code: 'AI_SERVICE_ERROR', message: 'Errore dal servizio AI' },
        });
      }

      // Streaming: pipe the SSE response directly
      if (parsed.data.stream && response.body) {
        // reply.raw bypassa il plugin CORS di Fastify: gli header vanno messi a mano,
        // altrimenti il browser rifiuta lo stream ("Failed to fetch")
        const origin = request.headers.origin;
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...(origin
            ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
            : {}),
        });

        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(value);
          }
        } finally {
          reader.releaseLock();
          reply.raw.end();
        }
        return;
      }

      // Non-streaming: return JSON
      const data = await response.json();
      return reply.send({ success: true, data });
    } catch (error) {
      // Fallback: call OpenAI directly if AI service is down (non-streaming only)
      const msg = error instanceof Error ? error.message : String(error);
      if ((msg === 'AI_SERVICE_DOWN' || msg === 'AI_SERVICE_TIMEOUT') && isOpenAIFallbackAvailable() && !parsed.data.stream) {
        app.log.info('AI service down — using OpenAI direct fallback for /ai/chat');
        try {
          const fallbackData = await openAIChat(parsed.data.messages, {
            temperature: parsed.data.temperature,
            max_tokens: parsed.data.max_tokens,
          });
          return reply.send({ success: true, data: fallbackData });
        } catch (fbErr) {
          app.log.error(fbErr, 'OpenAI chat fallback error');
        }
      }

      app.log.error(error, 'AI chat proxy error');
      const errResp = aiErrorResponse(error);
      return reply.status(errResp.status).send(errResp.body);
    }
  });

  // ─── POST /ai/coach — Coach Q&A with RAG ─────────────────
  app.post('/ai/coach', async (request, reply) => {
    const parsed = aiCoachSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input non valido',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    // Load user's exercise library for context
    const { organizationId } = request.user;
    let exerciseContext = '';
    try {
      const exercises = await app.prisma.exercise.findMany({
        where: { organizationId },
        select: { name: true, category: true, muscleGroups: true, equipment: true },
        orderBy: { category: 'asc' },
        take: 150,
      });
      if (exercises.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const ex of exercises) {
          if (!grouped[ex.category]) grouped[ex.category] = [];
          grouped[ex.category].push(ex.name);
        }
        const lines = Object.entries(grouped).map(
          ([cat, names]) => `${cat}: ${names.join(', ')}`
        );
        exerciseContext = `\n\nESERCIZI DISPONIBILI NELLA LIBRERIA DELL'UTENTE:\n${lines.join('\n')}\n\nQuando suggerisci esercizi, preferisci quelli già presenti nella libreria dell'utente. Se suggerisci esercizi non in lista, segnalalo.`;
      }
    } catch {
      // Non-critical
    }

    try {
      const response = await proxyToAI('/ai/coach', {
        ...parsed.data,
        question: parsed.data.question + exerciseContext,
      });

      if (!response.ok) {
        const errBody = await response.text();
        app.log.error({ status: response.status, body: errBody }, 'AI coach error');
        return reply.status(response.status).send({
          success: false,
          error: { code: 'AI_SERVICE_ERROR', message: 'Errore dal servizio AI' },
        });
      }

      const data = await response.json();
      return reply.send({ success: true, data });
    } catch (error) {
      // Fallback: call OpenAI directly if AI service is down
      const msg = error instanceof Error ? error.message : String(error);
      if ((msg === 'AI_SERVICE_DOWN' || msg === 'AI_SERVICE_TIMEOUT') && isOpenAIFallbackAvailable()) {
        app.log.info('AI service down — using OpenAI direct fallback for /ai/coach');
        try {
          const fallbackData = await openAIChat(
            [{ role: 'user', content: parsed.data.question + exerciseContext }],
          );
          return reply.send({ success: true, data: fallbackData });
        } catch (fbErr) {
          app.log.error(fbErr, 'OpenAI coach fallback error');
        }
      }

      app.log.error(error, 'AI coach proxy error');
      const errResp = aiErrorResponse(error);
      return reply.status(errResp.status).send(errResp.body);
    }
  });

  // ─── POST /ai/generate — Generate training content ────────
  app.post('/ai/generate', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = aiGenerateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input non valido',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const response = await proxyToAI('/ai/generate', parsed.data, { timeoutMs: AI_GENERATE_TIMEOUT_MS });

      if (!response.ok) {
        const errBody = await response.text();
        app.log.error({ status: response.status, body: errBody }, 'AI generate error');
        return reply.status(response.status).send({
          success: false,
          error: { code: 'AI_SERVICE_ERROR', message: 'Errore dal servizio AI' },
        });
      }

      const data = await response.json();
      return reply.send({ success: true, data });
    } catch (error) {
      // Fallback: call OpenAI directly if AI service is down
      const msg = error instanceof Error ? error.message : String(error);
      if ((msg === 'AI_SERVICE_DOWN' || msg === 'AI_SERVICE_TIMEOUT') && isOpenAIFallbackAvailable()) {
        app.log.info('AI service down — using OpenAI direct fallback for /ai/generate');
        try {
          const fallbackData = await openAIGenerate(parsed.data.prompt);
          return reply.send({ success: true, data: fallbackData });
        } catch (fbErr) {
          app.log.error(fbErr, 'OpenAI fallback error');
          return reply.status(503).send({
            success: false,
            error: {
              code: 'AI_FALLBACK_ERROR',
              message: 'Errore nella generazione AI. Verifica la chiave OPENAI_API_KEY.',
              retryable: true,
            },
          });
        }
      }

      app.log.error(error, 'AI generate proxy error');
      const errResp = aiErrorResponse(error);
      return reply.status(errResp.status).send(errResp.body);
    }
  });

  // ─── POST /ai/wellness-insights — AI wellness analysis ────
  app.post('/ai/wellness-insights', async (request, reply) => {
    const parsed = aiWellnessInsightSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input non valido',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { organizationId } = request.user;
    const { athlete_id, days } = parsed.data;

    try {
      // Fetch wellness data from DB
      const where: Record<string, unknown> = {};

      if (athlete_id) {
        // Verify athlete belongs to same org
        const athlete = await app.prisma.athlete.findFirst({
          where: { id: athlete_id, organizationId },
        });
        if (!athlete) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Atleta non trovato' },
          });
        }
        where.athleteId = athlete_id;
      } else {
        // All athletes in the organization
        where.athlete = { organizationId };
      }

      // Fetch recent wellness logs
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      where.date = { gte: sinceDate };

      const wellnessLogs = await app.prisma.wellnessLog.findMany({
        where,
        include: { athlete: { select: { firstName: true, lastName: true, position: true } } },
        orderBy: { date: 'desc' },
        take: 100,
      });

      if (wellnessLogs.length === 0) {
        return reply.send({
          success: true,
          data: {
            answer: 'Nessun dato wellness disponibile per il periodo selezionato.',
            sources: [],
            references: [],
          },
        });
      }

      // Build a summary for the AI coach
      const summary = wellnessLogs.map((log: Record<string, unknown>) => {
        const athlete = log.athlete as { firstName: string; lastName: string; position: string } | null;
        const name = athlete ? `${athlete.firstName} ${athlete.lastName}` : 'Sconosciuto';
        return `${name} (${(log.date as Date).toISOString().slice(0, 10)}): Sonno=${log.sleep}/10, Fatica=${log.fatigue}/10, Dolore=${log.soreness}/10, Stress=${log.stress}/10, Umore=${log.mood}/10`;
      }).join('\n');

      const question = athlete_id
        ? `Analizza i dati wellness di questo atleta degli ultimi ${days} giorni e fornisci raccomandazioni:\n\n${summary}`
        : `Analizza i dati wellness del team degli ultimi ${days} giorni. Identifica atleti a rischio e fornisci raccomandazioni:\n\n${summary}`;

      // Call AI coach with wellness data
      const response = await proxyToAI('/ai/coach', {
        question,
        namespaces: ['protocols', 'references'],
        top_k: 3,
      });

      if (!response.ok) {
        return reply.status(503).send({
          success: false,
          error: { code: 'AI_SERVICE_ERROR', message: 'Errore dal servizio AI' },
        });
      }

      const data = await response.json();
      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error, 'AI wellness insights error');
      const errResp = aiErrorResponse(error);
      return reply.status(errResp.status).send(errResp.body);
    }
  });

  // ─── POST /ai/rtp-suggest — RTP phase advancement advisor ──
  app.post('/ai/rtp-suggest', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = aiRtpSuggestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Input non valido', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { organizationId } = request.user;
    const { protocol_id } = parsed.data;

    let protocol;
    try {
      protocol = await app.prisma.rTPProtocol.findFirst({
        where: { id: protocol_id, athlete: { organizationId } },
        include: {
          injury: true,
          athlete: { select: { firstName: true, lastName: true, position: true, dateOfBirth: true } },
          criteria: { orderBy: { phase: 'asc' } },
          phaseLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });
    } catch (dbErr) {
      app.log.error(dbErr, 'RTP suggest DB error');
      return reply.status(500).send({
        success: false,
        error: { code: 'DB_ERROR', message: 'Errore nel recupero del protocollo RTP' },
      });
    }

    if (!protocol) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Protocollo RTP non trovato' },
      });
    }

    // Build structured context for AI
    const athlete = protocol.athlete;
    const injury = protocol.injury;
    const criteriaMet = protocol.criteria.filter((c: { isMet: boolean }) => c.isMet).length;
    const criteriaTotal = protocol.criteria.length;
    const currentPhaseCriteria = protocol.criteria.filter(
      (c: { phase: string; isMet: boolean; description: string }) => c.phase === protocol.currentPhase,
    );
    const metInPhase = currentPhaseCriteria.filter((c: { isMet: boolean }) => c.isMet).length;

    const phaseNames: Record<string, string> = {
      PHASE_1: 'Fase 1 — Controllo dolore',
      PHASE_2: 'Fase 2 — Mobilità',
      PHASE_3: 'Fase 3 — Forza',
      PHASE_4: 'Fase 4 — Allenamento completo',
      PHASE_5: 'Fase 5 — Return-to-Sport',
      CLEARED: 'Cleared — Ritorno completo',
    };
    const currentPhaseName = phaseNames[protocol.currentPhase] || protocol.currentPhase;

    const protocolSummary = {
      currentPhase: protocol.currentPhase,
      metInPhase,
      totalInPhase: currentPhaseCriteria.length,
      criteriaMet,
      criteriaTotal,
    };

    const question = `Sei un esperto di Return-to-Play nel basket. Analizza questo protocollo RTP e fornisci:
1. VALUTAZIONE: Il protocollo è pronto per avanzare alla fase successiva? Perché sì/no?
2. ESERCIZI CONSIGLIATI: 3-5 esercizi specifici per la fase attuale, considerando il tipo di infortunio e la posizione dell'atleta.
3. RISCHI: Eventuali segnali di attenzione o rischi da monitorare.
4. TIMELINE STIMATA: Stima di quando l'atleta potrebbe essere pronto per la fase successiva.

DATI PROTOCOLLO:
- Atleta: ${athlete.firstName} ${athlete.lastName} (${athlete.position})
- Infortunio: ${injury.type} — ${injury.location} (severità: ${injury.severity}/5)
- Data infortunio: ${injury.dateOccurred}
- Fase attuale: ${currentPhaseName} (${metInPhase}/${currentPhaseCriteria.length} criteri soddisfatti)
- Progresso totale: ${criteriaMet}/${criteriaTotal} criteri soddisfatti
- Criteri fase attuale:
${currentPhaseCriteria.map((c: { description: string; isMet: boolean }) => `  ${c.isMet ? '✅' : '❌'} ${c.description}`).join('\n')}
- Ultime transizioni:
${protocol.phaseLogs.slice(0, 5).map((l: { fromPhase: string; toPhase: string; reason: string | null; createdAt: Date }) => `  ${phaseNames[l.fromPhase] || l.fromPhase} → ${phaseNames[l.toPhase] || l.toPhase} (${l.reason || 'N/A'}) — ${new Date(l.createdAt).toLocaleDateString('it-IT')}`).join('\n')}

Rispondi in italiano, in modo strutturato e professionale.`;

    try {
      const response = await proxyToAI('/ai/coach', {
        question,
        namespaces: ['protocols', 'exercises', 'references'],
        top_k: 8,
      });

      if (!response.ok) {
        const errBody = await response.text();
        app.log.error({ status: response.status, body: errBody }, 'AI RTP suggest error');
        return reply.status(response.status).send({
          success: false,
          error: { code: 'AI_SERVICE_ERROR', message: 'Errore dal servizio AI' },
        });
      }

      const data = await response.json();
      return reply.send({
        success: true,
        data: {
          ...data,
          protocol_summary: protocolSummary,
        },
      });
    } catch (error) {
      // If AI service is down, generate a rule-based fallback suggestion
      const msg = error instanceof Error ? error.message : String(error);
      app.log.warn({ msg }, 'AI RTP suggest — service unavailable, using fallback');

      const allMet = metInPhase === currentPhaseCriteria.length && currentPhaseCriteria.length > 0;
      const unmetCriteria = currentPhaseCriteria
        .filter((c: { isMet: boolean; description: string }) => !c.isMet)
        .map((c: { description: string }) => c.description);

      let fallbackAnswer: string;
      if (allMet) {
        fallbackAnswer = `✅ VALUTAZIONE: Tutti i ${metInPhase} criteri della ${currentPhaseName} sono soddisfatti. L'atleta ${athlete.firstName} ${athlete.lastName} è pronto per avanzare alla fase successiva.\n\n⚠️ NOTA: Suggerimento generato automaticamente (servizio AI non disponibile). Per un'analisi più approfondita, riprova quando il servizio AI è attivo.`;
      } else {
        fallbackAnswer = `📋 VALUTAZIONE: ${metInPhase}/${currentPhaseCriteria.length} criteri soddisfatti nella ${currentPhaseName}. L'atleta ${athlete.firstName} ${athlete.lastName} non è ancora pronto per avanzare.\n\n❌ CRITERI DA COMPLETARE:\n${unmetCriteria.map((c: string) => `• ${c}`).join('\n')}\n\n⚠️ NOTA: Suggerimento generato automaticamente (servizio AI non disponibile). Per esercizi consigliati e analisi dettagliata, riprova quando il servizio AI è attivo.`;
      }

      return reply.send({
        success: true,
        data: {
          answer: fallbackAnswer,
          sources: [],
          protocol_summary: protocolSummary,
        },
      });
    }
  });

  // ─── GET /ai/health — AI service health check ─────────────
  app.get('/ai/health', async (_request, reply) => {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return reply.status(503).send({
          success: false,
          error: { code: 'AI_SERVICE_UNHEALTHY', message: 'Servizio AI non sano' },
        });
      }

      const data = await response.json();
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(503).send({
        success: false,
        error: { code: 'AI_SERVICE_UNAVAILABLE', message: 'Servizio AI non raggiungibile' },
      });
    }
  });
}
