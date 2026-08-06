/**
 * Routing dei modelli AI e listino prezzi.
 *
 * Perché esiste questo file
 * -------------------------
 * Prima ogni chiamata AI usava lo stesso modello (`gpt-4o`), anche per
 * operazioni banali come rispondere in chat o riassumere un report.
 * `gpt-4o` costa ~16 volte `gpt-4o-mini`: usarlo ovunque significava
 * pagare 4,50 €/mese per un cliente tipico invece di 0,76 €.
 *
 * Qui si decide quale modello usa ogni operazione. Il modello viene poi
 * passato all'ai-service nel corpo della richiesta: NON può essere dedotto
 * dall'endpoint, perché `/ai/wellness-insights` riusa `/ai/coach`
 * sull'ai-service e le due operazioni vanno su modelli diversi.
 *
 * Tutte le assegnazioni sono sovrascrivibili da variabile d'ambiente,
 * così si può cambiare modello con un riavvio, senza toccare il codice.
 */

/** Operazioni AI tracciate. Deve restare allineato all'enum Prisma `AiOperation`. */
export type AiOperation =
  | 'CHAT'
  | 'COACH'
  | 'GENERATE'
  | 'WELLNESS'
  | 'RTP'
  | 'REPORT';

/** Modello economico: conversazione e sintesi brevi. */
const CHEAP_MODEL = 'gpt-4o-mini';

/** Modello completo: output lungo e strutturato, o ambito clinico. */
const SMART_MODEL = 'gpt-4o';

/**
 * Modello per operazione.
 *
 * Criterio: `gpt-4o` resta solo dove la qualità paga davvero — la
 * generazione dei piani (output lungo e strutturato) e i suggerimenti
 * Return-to-Play (ambito clinico, nessun compromesso). Tutto il resto
 * passa al modello economico.
 */
const DEFAULT_MODEL_BY_OPERATION: Record<AiOperation, string> = {
  CHAT: CHEAP_MODEL,
  COACH: CHEAP_MODEL,
  WELLNESS: CHEAP_MODEL,
  REPORT: CHEAP_MODEL,
  GENERATE: SMART_MODEL,
  RTP: SMART_MODEL,
};

/** Variabile d'ambiente che sovrascrive il modello di ciascuna operazione. */
const ENV_VAR_BY_OPERATION: Record<AiOperation, string> = {
  CHAT: 'AI_MODEL_CHAT',
  COACH: 'AI_MODEL_COACH',
  WELLNESS: 'AI_MODEL_WELLNESS',
  REPORT: 'AI_MODEL_REPORT',
  GENERATE: 'AI_MODEL_GENERATE',
  RTP: 'AI_MODEL_RTP',
};

/**
 * Restituisce il modello da usare per un'operazione.
 * Precedenza: variabile d'ambiente specifica > default della tabella.
 */
export function getModelForOperation(operation: AiOperation): string {
  const envValue = process.env[ENV_VAR_BY_OPERATION[operation]];
  if (envValue && envValue.trim()) return envValue.trim();
  return DEFAULT_MODEL_BY_OPERATION[operation];
}

/** Mappa completa operazione → modello, per diagnostica e endpoint di stato. */
export function getModelRouting(): Record<AiOperation, string> {
  const out = {} as Record<AiOperation, string>;
  for (const op of Object.keys(DEFAULT_MODEL_BY_OPERATION) as AiOperation[]) {
    out[op] = getModelForOperation(op);
  }
  return out;
}

// ─── Listino ────────────────────────────────────────────

/** Prezzo in USD per 1 milione di token. */
interface ModelPrice {
  input: number;
  output: number;
}

/**
 * Listino OpenAI (verificato luglio 2026).
 *
 * Va aggiornato quando OpenAI cambia i prezzi. Il costo calcolato viene
 * salvato su ogni riga di `ai_usage_logs`: lo storico resta corretto anche
 * dopo un aggiornamento del listino, perché non viene mai ricalcolato.
 */
const PRICE_PER_MILLION: Record<string, ModelPrice> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
};

/** Usato quando il modello non è a listino: stima prudenziale (la più cara). */
const FALLBACK_PRICE: ModelPrice = { input: 2.5, output: 10.0 };

/**
 * Trova la voce di listino di un modello.
 *
 * OpenAI non restituisce il nome che gli hai passato: risolve l'alias nella
 * versione datata concreta. Chiedi `gpt-4o-mini` e nella risposta trovi
 * `gpt-4o-mini-2024-07-18`. Una ricerca per uguaglianza fallisce, ricade sulla
 * stima prudenziale e sovrastima il costo di ~16 volte.
 *
 * Si cerca quindi il prefisso più LUNGO fra quelli a listino. La lunghezza
 * conta: `gpt-4o` è prefisso anche di `gpt-4o-mini-2024-07-18`, e vincerebbe
 * se si prendesse la prima corrispondenza utile.
 */
function resolvePrice(model: string): ModelPrice | null {
  const exact = PRICE_PER_MILLION[model];
  if (exact) return exact;

  let best: { key: string; price: ModelPrice } | null = null;
  for (const [key, price] of Object.entries(PRICE_PER_MILLION)) {
    if (model.startsWith(key) && (!best || key.length > best.key.length)) {
      best = { key, price };
    }
  }
  return best?.price ?? null;
}

/**
 * Costo in USD di una chiamata.
 * Il modello locale non ha costo per token.
 */
export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
  provider = 'openai',
): number {
  if (provider === 'local') return 0;

  const price = resolvePrice(model) ?? FALLBACK_PRICE;
  const cost =
    (promptTokens / 1_000_000) * price.input +
    (completionTokens / 1_000_000) * price.output;

  // 8 decimali: una chiamata su gpt-4o-mini costa ~0,000001 USD
  return Number(cost.toFixed(8));
}

/**
 * True se il modello è a listino (anche via versione datata).
 * Se false il costo è una stima prudenziale e la riga viene marcata `estimated`.
 */
export function isModelPriced(model: string): boolean {
  return resolvePrice(model) !== null;
}

// ─── Crediti ────────────────────────────────────────────

/**
 * Costo in crediti di ogni operazione.
 *
 * In questa fase è puramente informativo: nessuna quota viene applicata,
 * il valore serve solo a popolare `creditsCharged` e a tarare le soglie
 * quando (e se) si introdurranno le quote.
 */
const CREDITS_BY_OPERATION: Record<AiOperation, number> = {
  CHAT: 1,
  WELLNESS: 1,
  COACH: 2,
  REPORT: 2,
  RTP: 3,
  GENERATE: 5,
};

export function getCreditsForOperation(operation: AiOperation): number {
  return CREDITS_BY_OPERATION[operation] ?? 1;
}
