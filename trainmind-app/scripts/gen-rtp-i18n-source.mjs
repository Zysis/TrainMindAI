/**
 * Estrae da packages/types/src/rtp-library.ts tutte le stringhe visibili
 * all'utente, con le stesse chiavi deterministiche del seed SQL.
 *
 *   node --experimental-strip-types scripts/gen-rtp-i18n-source.mjs > out.json
 *
 * Schema delle chiavi (stesso id del seed, senza il prefisso sys_):
 *   <code>              nome del template
 *   <code>#d            descrizione del template
 *   <code>.p<n>         nome della fase
 *   <code>.p<n>#g       obiettivo della fase
 *   <code>.p<n>.c<m>    descrizione del criterio
 * Test e unita' di misura sono raccolti a parte: si ripetono fra protocolli,
 * tradurli una volta sola evita che lo stesso test abbia due nomi diversi.
 */
import { RTP_SYSTEM_TEMPLATES } from '../packages/types/src/rtp-library.ts';

const strings = {};
const tests = new Set();
const units = new Set();

for (const t of RTP_SYSTEM_TEMPLATES) {
  strings[t.code] = t.name;
  if (t.description) strings[`${t.code}#d`] = t.description;
  for (const p of t.phases) {
    strings[`${t.code}.p${p.order}`] = p.name;
    if (p.goal) strings[`${t.code}.p${p.order}#g`] = p.goal;
    for (const c of p.criteria) {
      strings[`${t.code}.p${p.order}.c${c.order}`] = c.description;
      if (c.testCode) tests.add(c.testCode);
      if (c.unit) units.add(c.unit);
    }
  }
}

console.log(JSON.stringify({
  strings,
  tests: [...tests].sort(),
  units: [...units].sort(),
  counts: { strings: Object.keys(strings).length, tests: tests.size, units: units.size },
}, null, 1));
