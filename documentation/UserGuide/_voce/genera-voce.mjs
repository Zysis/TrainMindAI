#!/usr/bin/env node
/**
 * Genera la voce narrante delle guide video con la TTS di OpenAI.
 *
 *   node genera-voce.mjs it
 *   node genera-voce.mjs it en es      (piu' lingue in fila)
 *
 * La chiave sta solo qui: si legge da OPENAI_API_KEY e non viene mai scritta
 * da nessuna parte.
 *
 *   PowerShell:  $env:OPENAI_API_KEY = "sk-..."
 *   cmd:         set OPENAI_API_KEY=sk-...
 *
 * Legge  narration-<lang>.json  (stessa cartella)
 * Scrive audio/<lang>/<id>.mp3
 *
 * E' ripartibile: i file gia' presenti non si rigenerano. Se una scena esce
 * male, cancella il suo mp3 e rilancia — rifara' solo quello.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const MODEL = 'gpt-4o-mini-tts';
const FORMAT = 'mp3';

/**
 * Istruzioni di lettura. Senza, la TTS legge da telegiornale: veloce e piatta.
 * Qui serve il passo di chi spiega un'interfaccia a un collega.
 */
const STYLE = {
  it: "Parla in italiano, con calma, come un preparatore esperto che spiega il software a un collega. Ritmo tranquillo, pause vere fra le frasi, tono cordiale e concreto. Non enfatico, non pubblicitario.",
  en: "Speak in English, calmly, like an experienced strength coach explaining the software to a colleague. Unhurried pace, real pauses between sentences, warm and matter-of-fact. Not emphatic, not salesy.",
  es: "Habla en espanol, con calma, como un preparador experto que explica el software a un colega. Ritmo tranquilo, pausas reales entre frases, tono cordial y concreto. Nada enfatico, nada publicitario.",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function speak(apiKey, { text, voice, instructions }) {
  // Fino a 4 tentativi: la TTS ogni tanto risponde 429 o 500, e rifare tutto
  // da capo per una scena su quaranta sarebbe uno spreco.
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          voice,
          input: text,
          instructions,
          response_format: FORMAT,
        }),
      });

      if (res.ok) return Buffer.from(await res.arrayBuffer());

      const body = await res.text();
      lastErr = new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      // 4xx diversi da 429 non migliorano riprovando
      if (res.status !== 429 && res.status < 500) throw lastErr;
    } catch (err) {
      lastErr = err;
    }
    const wait = 2000 * attempt;
    console.log(`      ritento fra ${wait / 1000}s (${lastErr.message.slice(0, 90)})`);
    await sleep(wait);
  }
  throw lastErr;
}

async function doLang(apiKey, lang) {
  const scriptPath = join(HERE, `narration-${lang}.json`);
  if (!existsSync(scriptPath)) {
    console.error(`  manca ${scriptPath}`);
    return { ok: 0, skip: 0, fail: 1 };
  }

  const data = JSON.parse(readFileSync(scriptPath, 'utf8'));
  const voice = data.voice || 'onyx';
  const outDir = join(HERE, 'audio', lang);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n=== ${lang.toUpperCase()} — ${data.scenes.length} scene, voce "${voice}"`);

  let ok = 0, skip = 0, fail = 0;
  for (const [i, scene] of data.scenes.entries()) {
    const dest = join(outDir, `${scene.id}.mp3`);
    const n = String(i + 1).padStart(2, '0');

    if (existsSync(dest) && statSync(dest).size > 1000) {
      skip++;
      console.log(`  ${n}/${data.scenes.length} ${scene.id} — gia' fatto`);
      continue;
    }

    process.stdout.write(`  ${n}/${data.scenes.length} ${scene.id} … `);
    try {
      const buf = await speak(apiKey, {
        text: scene.text,
        voice,
        instructions: STYLE[lang] || STYLE.it,
      });
      writeFileSync(dest, buf);
      ok++;
      console.log(`${Math.round(buf.length / 1024)} KB`);
    } catch (err) {
      fail++;
      console.log(`ERRORE — ${err.message.slice(0, 120)}`);
    }
    await sleep(350); // gentile con il rate limit
  }

  console.log(`  ${lang}: ${ok} generate, ${skip} gia' presenti, ${fail} fallite`);
  return { ok, skip, fail };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Manca OPENAI_API_KEY.');
    console.error('PowerShell:  $env:OPENAI_API_KEY = "sk-..."');
    process.exit(1);
  }

  const langs = process.argv.slice(2).filter((a) => ['it', 'en', 'es'].includes(a));
  if (!langs.length) {
    console.error('Uso: node genera-voce.mjs it [en] [es]');
    process.exit(1);
  }

  const totals = { ok: 0, skip: 0, fail: 0 };
  for (const lang of langs) {
    const r = await doLang(apiKey, lang);
    totals.ok += r.ok;
    totals.skip += r.skip;
    totals.fail += r.fail;
  }

  console.log(
    `\nFatto: ${totals.ok} generate, ${totals.skip} gia' presenti, ${totals.fail} fallite.`
  );
  if (totals.fail) {
    console.log('Rilancia lo stesso comando: riprende solo dalle scene mancanti.');
    process.exit(1);
  }
}

main();
