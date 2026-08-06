/**
 * Registrazione del consumo AI.
 *
 * Ogni chiamata a un modello scrive una riga in `ai_usage_logs`. Serve a
 * rispondere a una domanda che oggi non ha risposta: quanto costa davvero
 * ogni organizzazione?
 *
 * Regola fondamentale: **la registrazione non deve mai far fallire la
 * richiesta dell'utente**. Se la scrittura del log va male, si logga
 * l'errore e si prosegue. Un problema di contabilità non può impedire a un
 * preparatore di generare un piano.
 */

import type { FastifyInstance } from 'fastify';
import {
  computeCostUsd,
  getCreditsForOperation,
  isModelPriced,
  type AiOperation,
} from '../lib/ai-models.js';

/** Consumo token restituito dall'ai-service (schema `UsageInfo`). */
export interface AiUsagePayload {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  model?: string;
  provider?: string;
  estimated?: boolean;
}

export interface RecordAiUsageArgs {
  organizationId: string;
  userId?: string | null;
  operation: AiOperation;
  endpoint: string;
  /** Modello richiesto dall'API; usato se l'ai-service non riporta il proprio. */
  requestedModel: string;
  usage?: AiUsagePayload | null;
  success?: boolean;
  errorCode?: string | null;
  durationMs?: number | null;
}

/**
 * Estrae `usage` da una risposta dell'ai-service, che può avere forme diverse
 * a seconda dell'endpoint (`data.usage`, `usage`, oppure assente in caso di
 * risposta servita dalla cache).
 */
export function extractUsage(payload: unknown): AiUsagePayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  const candidate =
    (obj.usage as Record<string, unknown> | undefined) ??
    ((obj.data as Record<string, unknown> | undefined)?.usage as
      | Record<string, unknown>
      | undefined);

  if (!candidate || typeof candidate !== 'object') return null;
  return candidate as AiUsagePayload;
}

/**
 * Scrive una riga di consumo. Non solleva mai: in caso di errore logga e basta.
 *
 * Quando `usage` è assente (risposta dalla cache dell'ai-service, o errore
 * prima della chiamata al modello) la riga viene scritta comunque con zero
 * token: serve a distinguere "operazione mai richiesta" da "operazione
 * servita gratis dalla cache".
 */
export async function recordAiUsage(
  app: FastifyInstance,
  args: RecordAiUsageArgs,
): Promise<void> {
  try {
    const usage = args.usage ?? {};
    const promptTokens = Math.max(0, Math.trunc(usage.prompt_tokens ?? 0));
    const completionTokens = Math.max(0, Math.trunc(usage.completion_tokens ?? 0));
    const totalTokens =
      Math.max(0, Math.trunc(usage.total_tokens ?? 0)) ||
      promptTokens + completionTokens;

    const model = usage.model || args.requestedModel;
    const provider = usage.provider || 'openai';
    const success = args.success ?? true;

    const costUsd = computeCostUsd(model, promptTokens, completionTokens, provider);

    // Un'operazione fallita o servita dalla cache non consuma crediti.
    const creditsCharged =
      success && totalTokens > 0 ? getCreditsForOperation(args.operation) : 0;

    await app.prisma.aiUsageLog.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId ?? null,
        operation: args.operation,
        endpoint: args.endpoint,
        model,
        provider,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        creditsCharged,
        success,
        errorCode: args.errorCode ?? null,
        durationMs: args.durationMs ?? null,
        estimated: usage.estimated === true || !isModelPriced(model),
      },
    });

    app.log.debug(
      {
        organizationId: args.organizationId,
        operation: args.operation,
        model,
        totalTokens,
        costUsd,
      },
      'AI usage recorded',
    );
  } catch (err) {
    // Non propagare: la contabilità non deve mai rompere la funzionalità.
    app.log.error(
      { err, operation: args.operation, organizationId: args.organizationId },
      'Impossibile registrare il consumo AI',
    );
  }
}

/**
 * Intercetta l'evento SSE `usage` mentre lo stream viene inoltrato al browser.
 *
 * In streaming la risposta non è un JSON leggibile in un colpo solo: l'API fa
 * da pipe verso `reply.raw`. L'ai-service emette un evento
 * `{"type":"usage", "usage":{...}}` che qui viene riconosciuto senza alterare
 * il flusso inoltrato.
 */
export function parseUsageFromSseChunk(text: string): AiUsagePayload | null {
  if (!text.includes('"usage"')) return null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const raw = trimmed.slice(5).trim();
    if (!raw || raw === '[DONE]') continue;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.type === 'usage' && parsed.usage) {
        return parsed.usage as AiUsagePayload;
      }
    } catch {
      // Chunk parziale: lo stream può spezzare un evento a metà.
      // Non è un errore, il prossimo chunk completerà l'evento.
    }
  }

  return null;
}
