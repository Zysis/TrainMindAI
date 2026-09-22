/**
 * SPIKE 2 — le estensioni intercettano le SCRITTURE annidate?
 * ===========================================================
 *
 * Le estensioni `result` risolvono la lettura (spike 1: quattro OK).
 * Restano le scritture, che nel codice reale sono quasi tutte annidate:
 *
 *   athlete.update({ data: { identity: { update: { lastName: '...' } } } })
 *
 * Se l'estensione non le vede, si scriverebbero nomi in chiaro dentro un
 * database che crediamo cifrato — e non se ne accorgerebbe nessuno.
 *
 * SICUREZZA: l'estensione ispeziona gli argomenti e poi lancia un'eccezione
 * PRIMA di chiamare query(). Nessuna operazione raggiunge il database.
 *
 * Uso, da packages/db:   node spike-cifratura-scritture.mjs
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

try {
  for (const riga of readFileSync('.env', 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const visto = [];

function cercaCognome(oggetto, percorso = '') {
  if (!oggetto || typeof oggetto !== 'object') return null;
  for (const [k, v] of Object.entries(oggetto)) {
    if (k === 'lastName' && typeof v === 'string') return `${percorso}.${k} = "${v}"`;
    if (v && typeof v === 'object') {
      const trovato = cercaCognome(v, `${percorso}.${k}`);
      if (trovato) return trovato;
    }
  }
  return null;
}

class Stop extends Error {}

const p = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args }) {
        if (['create', 'update', 'upsert', 'updateMany', 'createMany'].includes(operation)) {
          visto.push({ model, operation, cognome: cercaCognome(args, 'args') });
        }
        throw new Stop('spike: operazione interrotta di proposito');
      },
    },
  },
});

async function prova(nome, fn) {
  visto.length = 0;
  try { await fn(); } catch (e) { if (!(e instanceof Stop)) return console.log(`  ERR ${nome} -> ${String(e.message).split('\n')[0]}`); }
  const v = visto[0];
  if (!v) return console.log(`  NO   ${nome} -> l'estensione non e' stata invocata`);
  if (!v.cognome) return console.log(`  NO   ${nome} -> invocata su ${v.model}.${v.operation}, ma il cognome NON e' negli argomenti`);
  console.log(`  OK   ${nome} -> ${v.model}.${v.operation} | ${v.cognome}`);
}

console.log('SPIKE 2 — scritture. Nessuna operazione raggiunge il database.\n');

await prova('A. update annidato   athlete.update({ identity: { update } })', () =>
  p.athlete.update({ where: { id: 'x' }, data: { identity: { update: { lastName: 'Verdi' } } } }));

await prova('B. update diretto    athleteIdentity.update', () =>
  p.athleteIdentity.update({ where: { athleteId: 'x' }, data: { lastName: 'Verdi' } }));

await prova('C. create annidato   athlete.create({ identity: { create } })', () =>
  p.athlete.create({ data: { position: 'PG', birthYear: 2000, organizationId: 'x', identity: { create: { firstName: 'Mario', lastName: 'Verdi', dateOfBirth: new Date() } } } }));

await prova('D. upsert annidato   athlete.update({ identity: { upsert } })', () =>
  p.athlete.update({ where: { id: 'x' }, data: { identity: { upsert: { create: { firstName: 'M', lastName: 'Verdi', dateOfBirth: new Date() }, update: { lastName: 'Verdi' } } } } }));

await prova('E. user annidato     user.update({ identity: { update } })', () =>
  p.user.update({ where: { id: 'x' }, data: { identity: { update: { lastName: 'Verdi' } } } }));

console.log('\nQuattro/cinque OK: la cifratura in scrittura si aggancia qui, una volta sola.');
console.log('Anche un solo NO: quella forma di scrittura va gestita a mano, e va trovata nel codice.\n');
process.exit(0);
