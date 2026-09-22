/**
 * SPIKE — le estensioni Prisma raggiungono i modelli annidati?
 * ============================================================
 *
 * Non modifica niente: legge e basta. Nessuna scrittura, nessuna migration.
 *
 * Il problema: le anagrafiche degli atleti vengono lette in 134 punti su 26
 * file, quasi sempre come `include: { identity: true }` annidato dentro una
 * query su un altro modello. Se la decifratura non scatta li', va fatta a mano
 * in 134 posti — con la certezza di dimenticarne qualcuno.
 *
 * Qui si finge di "decifrare" mettendo il cognome in MAIUSCOLO, cosi' il
 * risultato si vede a occhio. Si provano le quattro forme di query reali su
 * due varianti di estensione.
 *
 * Uso, da packages/db:   node spike-cifratura.mjs
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

const FINTA_DECIFRATURA = (s) => (typeof s === 'string' ? s.toUpperCase() : s);

// ── VARIANTE 1: estensione `result` sul modello AthleteIdentity
const variante1 = new PrismaClient().$extends({
  result: {
    athleteIdentity: {
      lastName: {
        needs: { lastName: true },
        compute: (i) => FINTA_DECIFRATURA(i.lastName),
      },
    },
  },
});

// ── VARIANTE 2: estensione `query` su tutti i modelli, che attraversa il
//    risultato e trasforma ogni oggetto `identity` ovunque si trovi.
//    Stessa meccanica di flattenIdentities, applicata prima.
function attraversa(valore) {
  if (Array.isArray(valore)) return valore.map(attraversa);
  if (valore && typeof valore === 'object' && !(valore instanceof Date)) {
    for (const [k, v] of Object.entries(valore)) {
      if (k === 'identity' && v && typeof v === 'object' && 'lastName' in v) {
        v.lastName = FINTA_DECIFRATURA(v.lastName);
      } else {
        valore[k] = attraversa(v);
      }
    }
  }
  return valore;
}
const variante2 = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return attraversa(await query(args));
      },
    },
  },
});

const maiuscolo = (s) => typeof s === 'string' && s.length > 1 && s === s.toUpperCase();

async function prova(nome, fn) {
  try {
    const valore = await fn();
    if (valore === undefined || valore === null) return console.log(`  ?  ${nome} — nessun dato su cui verificare`);
    console.log(`  ${maiuscolo(valore) ? 'OK  ' : 'NO  '} ${nome}  ->  ${valore}`);
  } catch (e) {
    console.log(`  ERR ${nome}  ->  ${String(e.message).split('\n')[0]}`);
  }
}

async function batteria(p, titolo) {
  console.log(`\n=== ${titolo}`);

  await prova('1. query diretta su athleteIdentity', async () =>
    (await p.athleteIdentity.findFirst({ select: { lastName: true } }))?.lastName);

  await prova('2. include annidato da athlete', async () =>
    (await p.athlete.findFirst({ include: { identity: true } }))?.identity?.lastName);

  await prova('3. select parziale dentro identity', async () =>
    (await p.athlete.findFirst({ select: { id: true, identity: { select: { lastName: true } } } }))?.identity?.lastName);

  await prova('4. annidamento a due livelli (injury -> athlete -> identity)', async () =>
    (await p.injury.findFirst({ include: { athlete: { include: { identity: true } } } }))?.athlete?.identity?.lastName);
}

console.log('SPIKE cifratura — nessuna scrittura, sola lettura');
await batteria(variante1, 'VARIANTE 1 — estensione result su AthleteIdentity');
await batteria(variante2, 'VARIANTE 2 — estensione query su $allModels con attraversamento');
console.log('\nServono quattro OK nella stessa variante perche' + "' " + 'quella strada sia percorribile.\n');
process.exit(0);
