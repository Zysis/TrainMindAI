/**
 * TrainMind — genera la voce narrante del video della guida.
 *
 * Gira sul TUO computer, non nella sandbox: la chiave OpenAI resta qui.
 * Legge OPENAI_API_KEY da trainmind-app/.env (o dall'ambiente).
 *
 *   node genera-voce.mjs it
 *   node genera-voce.mjs es --voice=nova
 *
 * Legge  narration-<lang>.json  (stessa cartella)
 * Scrive audio/<lang>/<id>.mp3 — salta quelli già presenti, così se si
 * interrompe si rilancia senza ripagare le battute già fatte.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const LANG = (args.find((a) => !a.startsWith('--')) || 'it').toLowerCase();
const voiceArg = args.find((a) => a.startsWith('--voice='));
const MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts';

/* ── chiave: ambiente, oppure .env del monorepo ─────────────── */
function readKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const candidates = [
    resolve(HERE, '../../trainmind-app/.env'),
    resolve(HERE, '../../../trainmind-app/.env'),
    resolve(HERE, '.env'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const line = readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith('OPENAI_API_KEY='));
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const KEY = readKey();
if (!KEY) {
  console.error('OPENAI_API_KEY non trovata: né in ambiente né in trainmind-app/.env');
  process.exit(1);
}

const script = JSON.parse(readFileSync(join(HERE, `narration-${LANG}.json`), 'utf8'));
const VOICE = voiceArg ? voiceArg.split('=')[1] : script.voice || 'onyx';
const outDir = join(HERE, 'audio', LANG);
mkdirSync(outDir, { recursive: true });

const istruzioni = {
  it: 'Parla in italiano, tono professionale e calmo, ritmo da voce narrante di un video tutorial. Non enfatico.',
  en: 'Speak in English, professional and calm, at the pace of a tutorial voice-over. Not emphatic.',
  es: 'Habla en español, tono profesional y tranquilo, al ritmo de una voz en off de un tutorial. Sin énfasis excesivo.',
}[LANG];

let fatte = 0;
let saltate = 0;
let caratteri = 0;

for (const scene of script.scenes) {
  const out = join(outDir, `${scene.id}.mp3`);
  if (existsSync(out)) {
    saltate++;
    continue;
  }
  const body = {
    model: MODEL,
    voice: VOICE,
    input: scene.text,
    response_format: 'mp3',
  };
  // gpt-4o-mini-tts accetta `instructions`; i modelli tts-1 lo ignorano.
  if (MODEL.startsWith('gpt-4o')) body.instructions = istruzioni;

  process.stdout.write(`  ${scene.id} … `);
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`\nErrore ${res.status}: ${(await res.text()).slice(0, 300)}`);
    console.error('Se il modello non esiste su questo account: TTS_MODEL=tts-1-hd node genera-voce.mjs ' + LANG);
    process.exit(1);
  }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  caratteri += scene.text.length;
  fatte++;
  console.log('ok');
}

const files = readdirSync(outDir).filter((f) => f.endsWith('.mp3'));
console.log(`\nVoce "${VOICE}", modello ${MODEL}`);
console.log(`Generate ${fatte}, già presenti ${saltate}, totale file ${files.length}`);
console.log(`Caratteri sintetizzati in questa esecuzione: ${caratteri}`);
console.log(`Cartella: ${outDir}`);
