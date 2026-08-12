/**
 * OpenAI direct fallback — used when the Python AI service is unreachable.
 *
 * Calls the OpenAI Chat Completions API via fetch (no npm dependency needed).
 * Lacks RAG context but still generates useful training plans.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

const CHAT_SYSTEM_PROMPT = `Sei TrainMind, un assistente specializzato nella preparazione atletica per il basket.
Sei un esperto di:
- Periodizzazione dell'allenamento (lineare, ondulata, a blocchi)
- Forza, potenza esplosiva, condizionamento atletico
- Prevenzione infortuni nel basket (caviglia, ginocchio, spalla)
- Return-to-Play protocols
- Esercizi specifici: squat, stacco, pliometria, core stability, agilità
- Monitoraggio wellness e recupero

Rispondi SEMPRE in italiano. Sii specifico con serie, ripetizioni, intensità, recupero.`;

const GENERATE_SYSTEM_PROMPT = `Sei TrainMind, un assistente specializzato nella preparazione atletica per il basket.
Sei un esperto di periodizzazione, forza, potenza, condizionamento, prevenzione infortuni e Return-to-Play.

Quando l'utente chiede di generare un piano di allenamento, rispondi ESCLUSIVAMENTE con un JSON valido (senza markdown, senza backtick, senza testo prima o dopo).

Il JSON deve avere questa struttura ESATTA:
{
  "planName": "Nome del piano",
  "description": "Breve descrizione degli obiettivi e della metodologia (2-3 frasi)",
  "weeks": [
    {
      "weekNumber": 1,
      "notes": "Focus e obiettivi della settimana",
      "sessions": [
        {
          "title": "Forza e Condizionamento (Lunedì)",
          "duration": 90,
          "notes": "Note generali sulla sessione",
          "exercises": [
            {
              "name": "Back Squat",
              "category": "Forza",
              "sets": 4,
              "reps": "8",
              "intensity": "70% 1RM",
              "restSeconds": 120,
              "notes": "Enfasi sulla profondità e controllo eccentrico"
            }
          ]
        }
      ]
    }
  ]
}

REGOLE:
- Ogni sessione DEVE avere un array "exercises" con esercizi strutturati
- Ogni esercizio deve avere: "name" (nome preciso), "category" (Forza/Potenza/Pliometria/Velocita/Agilita/Core/Propriocezione/Prevenzione/Flessibilita/Resistenza/Riabilitazione), "sets" (numero), "reps" (stringa, es. "8-12" o "30sec"), "restSeconds" (numero in secondi)
- Campi opzionali esercizio: "intensity" (es. "70% 1RM"), "notes"
- Ogni settimana deve avere 3-4 sessioni
- Il campo "duration" è in minuti
- Usa SOLO JSON valido, nessun altro testo
- Il campo "title" deve indicare il tipo di sessione e il giorno (es. "Forza e Potenza (Lunedì)")
- Usa nomi di esercizi standard e precisi (es. "Back Squat", "Panca Piana", "Stacco Rumeno", "Plank", "Box Jump")
- Rispondi in italiano`;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface FallbackOptions {
  temperature?: number;
  max_tokens?: number;
  /**
   * Modello da usare. Arriva dal routing per operazione in `lib/ai-models.ts`.
   * Senza questo parametro il percorso di emergenza userebbe sempre
   * `OPENAI_MODEL` (gpt-4o), vanificando il risparmio proprio quando
   * l'ai-service è giù.
   */
  model?: string;
}

/** Consumo token riportato da OpenAI, nel formato atteso da `recordAiUsage`. */
export interface FallbackUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  provider: 'openai';
  estimated: false;
}

/** Risposta grezza di OpenAI, limitata ai campi che servono qui. */
interface OpenAICompletionPayload {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** Normalizza `usage` in modo che sia sempre presente e coerente. */
function toFallbackUsage(
  data: OpenAICompletionPayload,
  requestedModel: string,
): FallbackUsage {
  const prompt = data.usage?.prompt_tokens ?? 0;
  const completion = data.usage?.completion_tokens ?? 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: data.usage?.total_tokens ?? prompt + completion,
    model: data.model || requestedModel,
    provider: 'openai',
    estimated: false,
  };
}

/** Modello di default del percorso di emergenza. */
function resolveModel(options: FallbackOptions): string {
  return options.model || process.env.OPENAI_MODEL || 'gpt-4o';
}

/**
 * Formatta il recupero senza arrotondare.
 *
 * Arrotondare ai minuti mostrerebbe 90 secondi come "2 min": un errore del 33%
 * su un parametro che il preparatore usa davvero. I minuti si mostrano solo
 * quando il valore è esatto. Deve restare allineato a `format_rest()` in
 * apps/ai-service/app/routers/generate.py.
 */
function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
}

export interface AIExercise {
  name: string;
  category: string;
  sets: number;
  reps: string;
  intensity?: string;
  restSeconds?: number;
  notes?: string;
}

export interface AISession {
  title: string;
  duration: number;
  notes?: string;
  exercises: AIExercise[];
}

export interface AIWeek {
  weekNumber: number;
  notes?: string;
  sessions: AISession[];
}

export interface AIGeneratedPlan {
  planName: string;
  description: string;
  weeks: AIWeek[];
}

/**
 * Call OpenAI directly for training plan generation.
 * Returns structured JSON plan data.
 */
export async function openAIGenerate(
  prompt: string,
  options: FallbackOptions = {},
): Promise<{ content: string; structured_plan: AIGeneratedPlan | null; sources: never[]; fallback: true; usage: FallbackUsage }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_KEY_MISSING');
  }

  const messages: OpenAIMessage[] = [
    { role: 'system', content: GENERATE_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  const model = resolveModel(options);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as OpenAICompletionPayload;
  const usage = toFallbackUsage(data, model);

  const raw = data.choices?.[0]?.message?.content || '';

  // Try to parse as structured plan
  let structuredPlan: AIGeneratedPlan | null = null;
  try {
    structuredPlan = JSON.parse(raw) as AIGeneratedPlan;
  } catch {
    // If JSON parse fails, return raw text
  }

  // Build a human-readable version for display
  let content = raw;
  if (structuredPlan) {
    const lines: string[] = [];
    lines.push(`${structuredPlan.planName}`);
    lines.push(structuredPlan.description);
    lines.push('');
    for (const week of structuredPlan.weeks) {
      lines.push(`━━━ SETTIMANA ${week.weekNumber} ━━━`);
      if (week.notes) lines.push(week.notes);
      lines.push('');
      for (const session of week.sessions) {
        lines.push(`▸ ${session.title} (${session.duration} min)`);
        if (session.notes) lines.push(session.notes);
        for (let i = 0; i < session.exercises.length; i++) {
          const ex = session.exercises[i];
          let line = `  ${i + 1}. ${ex.name} — ${ex.sets}x${ex.reps}`;
          if (ex.intensity) line += ` @ ${ex.intensity}`;
          if (ex.restSeconds) line += ` | Rec: ${formatRest(ex.restSeconds)}`;
          if (ex.notes) line += ` (${ex.notes})`;
          lines.push(line);
        }
        lines.push('');
      }
    }
    content = lines.join('\n');
  }

  return {
    content,
    structured_plan: structuredPlan,
    sources: [],
    fallback: true,
    usage,
  };
}

/**
 * Call OpenAI directly for chat.
 */
export async function openAIChat(
  messages: OpenAIMessage[],
  options: FallbackOptions = {},
): Promise<{ answer: string; sources: never[]; references: never[]; fallback: true; usage: FallbackUsage }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_KEY_MISSING');
  }

  const fullMessages: OpenAIMessage[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...messages,
  ];

  const model = resolveModel(options);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as OpenAICompletionPayload;

  return {
    answer: data.choices?.[0]?.message?.content || '',
    sources: [],
    references: [],
    fallback: true,
    usage: toFallbackUsage(data, model),
  };
}

/**
 * Check if direct OpenAI fallback is available.
 */
export function isOpenAIFallbackAvailable(): boolean {
  return !!getApiKey();
}
