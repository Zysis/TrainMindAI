/**
 * CONTROLLO — cosa c'e' davvero dentro athlete_identities
 * =======================================================
 *
 * Usa il PrismaClient GREZZO, senza le nostre estensioni: quello che stampa
 * e' esattamente cio' che sta scritto su disco nel database, non quello che
 * l'API fa vedere. E' l'unico modo per distinguere "cifrato" da "in chiaro".
 *
 * Non scrive niente. Non decifra niente. Legge e conta.
 *
 * Uso, da packages/db:   node controlla-cifratura.mjs
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// packages/db/.env non viene caricato da solo dal client
try {
  for (const riga of readFileSync('.env', 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* se manca, si usa l'ambiente */ }

const prisma = new PrismaClient();
const CAMPI = ['firstName', 'lastName', 'email', 'photoUrl'];
const eCifrato = (v) => typeof v === 'string' && v.startsWith('v1:');

// abbrevia un valore per la stampa, senza mai mostrare un nome per intero
const mostra = (v) => {
  if (v === null || v === undefined) return '-';
  if (eCifrato(v)) return 'v1:' + v.slice(3, 11) + '...(' + v.length + ')';
  return 'CHIARO <' + String(v).slice(0, 10) + '>';
};

const righe = await prisma.athleteIdentity.findMany({
  select: { athleteId: true, firstName: true, lastName: true, email: true, photoUrl: true },
});

console.log('\nrighe in athlete_identities: ' + righe.length + '\n');

// conteggio per campo
const conteggio = {};
for (const c of CAMPI) conteggio[c] = { cifrati: 0, chiaro: 0, vuoti: 0 };
for (const r of righe) {
  for (const c of CAMPI) {
    const v = r[c];
    if (v === null || v === undefined || v === '') conteggio[c].vuoti++;
    else if (eCifrato(v)) conteggio[c].cifrati++;
    else conteggio[c].chiaro++;
  }
}
console.table(conteggio);

// le ultime righe create: qui si vede l'effetto della cifratura appena accesa
const ultime = righe.slice(-5);
console.log('\nultime ' + ultime.length + ' righe (ordine di tabella):');
for (const r of ultime) {
  console.log(
    '  ' + r.athleteId.slice(0, 8) + '  ' +
    CAMPI.map((c) => c + '=' + mostra(r[c])).join('  ')
  );
}

// controllo di coerenza: una riga mezza cifrata e mezza in chiaro va guardata
const miste = righe.filter((r) => {
  const pieni = CAMPI.map((c) => r[c]).filter((v) => v !== null && v !== undefined && v !== '');
  return pieni.some(eCifrato) && pieni.some((v) => !eCifrato(v));
});
console.log('\nrighe con campi misti (cifrati + in chiaro nella stessa riga): ' + miste.length);
if (miste.length) console.log('  ' + miste.map((r) => r.athleteId.slice(0, 8)).join(' '));

await prisma.$disconnect();
