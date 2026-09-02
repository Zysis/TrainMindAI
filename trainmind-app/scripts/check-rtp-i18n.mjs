/**
 * Verifica che le traduzioni EN/ES coprano la libreria RTP.
 *
 *   node --experimental-strip-types scripts/check-rtp-i18n.mjs
 *
 * Esce con 1 se manca una chiave o ne avanza una: e' il segnale che
 * rtp-library.ts e' cambiata e rtp-library-i18n.ts va aggiornata.
 * Le chiavi si generano con scripts/gen-rtp-i18n-source.mjs.
 */
import { RTP_SYSTEM_TEMPLATES } from '../packages/types/src/rtp-library.ts';
import { RTP_LIBRARY_I18N } from '../packages/types/src/rtp-library-i18n.ts';

const want = new Set();
for (const t of RTP_SYSTEM_TEMPLATES) {
  want.add(t.code);
  if (t.description) want.add(`${t.code}#d`);
  for (const p of t.phases) {
    want.add(`${t.code}.p${p.order}`);
    if (p.goal) want.add(`${t.code}.p${p.order}#g`);
    for (const c of p.criteria) {
      want.add(`${t.code}.p${p.order}.c${c.order}`);
      if (c.testCode) want.add(`#t:${c.testCode}`);
      if (c.unit) want.add(`#u:${c.unit}`);
    }
  }
}

let bad = 0;
for (const [locale, table] of Object.entries(RTP_LIBRARY_I18N)) {
  const have = new Set(Object.keys(table));
  const missing = [...want].filter((k) => !have.has(k));
  const extra = [...have].filter((k) => !want.has(k));
  const empty = [...have].filter((k) => !String(table[k]).trim());
  if (missing.length) { console.error(`[${locale}] ${missing.length} chiavi mancanti:`, missing.slice(0, 10)); bad++; }
  if (extra.length) { console.error(`[${locale}] ${extra.length} chiavi che non servono piu':`, extra.slice(0, 10)); bad++; }
  if (empty.length) { console.error(`[${locale}] ${empty.length} valori vuoti:`, empty.slice(0, 10)); bad++; }
  if (!missing.length && !extra.length && !empty.length) console.log(`[${locale}] ok — ${have.size} chiavi`);
}
process.exit(bad ? 1 : 0);
