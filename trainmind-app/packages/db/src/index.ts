// ============================================
// TrainMind — Database Client (Prisma)
// ============================================
//
// Il client e' esteso con la cifratura delle anagrafiche atleti.
// Vedi documentation/PIANO_CIFRATURA_VAULT.md.
//
// Perche' qui e non nei punti di chiamata: le anagrafiche si leggono in 134
// punti su 26 file, quasi sempre annidate (`include: { identity: true }`).
// Agganciare la cifratura a mano in 134 posti significa dimenticarne qualcuno,
// e un punto dimenticato in lettura mostra `v1:8fA2...` dentro un PDF gia'
// spedito a una societa'. Qui passa tutto: rotte, servizi, renderer, seed.
//
// Due estensioni, una per verso:
//
//   LETTURA   estensione `result` su AthleteIdentity. Verificata sul campo:
//             scatta sulla query diretta, sull'include annidato, sul select
//             parziale e sull'annidamento a due livelli.
//
//   SCRITTURA estensione `query` su $allModels, che cifra i campi dentro
//             `args.data` prima che partano.
//
// Cosa NON viene cifrato, di proposito:
//   - `user_identities` (nome e cognome dello staff): la console admin li legge
//     con il ruolo di reportistica, che non ha la chiave. Cifrarli romperebbe
//     i Contatti. Sono dati di contatto professionale, non legati a dati
//     sanitari.
//   - `dateOfBirth`: e' ancora una colonna `timestamp` e non puo' contenere
//     testo cifrato. Entra nell'elenco alla fase 4, insieme al cambio di tipo.
//   - `birthYear` su `athletes`: serve in chiaro al contesto IA e ai calcoli.

import { PrismaClient, Prisma } from '@prisma/client';
import {
  cifra,
  decifra,
  chiaveDaFile,
  inizializzaCifratura,
  impronta,
  ErroreCifratura,
} from './identity-cifratura.js';
import {
  CAMPI_CIFRATI,
  eOggetto,
  trovaCampoCifrato,
  trovaOrdinamentoAnagrafica,
} from './identity-guardie.js';

// ─── Attivazione ────────────────────────────────────────────────────────────
//
// In produzione la chiave e' obbligatoria: senza, l'applicazione NON parte.
// Un avvio silenzioso senza chiave scriverebbe nomi in chiaro dentro un
// database che tutti credono cifrato, ed e' il guasto peggiore perche' non si
// vede. Fuori produzione l'assenza e' ammessa, ma dichiarata a voce alta.

const percorsoChiave = process.env.IDENTITY_KEY_FILE;
export let cifraturaAttiva = false;

if (percorsoChiave) {
  const chiave = chiaveDaFile(percorsoChiave);
  inizializzaCifratura(chiave);
  cifraturaAttiva = true;
  console.info(`[db] cifratura anagrafiche ATTIVA — impronta chiave ${impronta(chiave)}`);
} else if (process.env.NODE_ENV === 'production') {
  throw new ErroreCifratura(
    'IDENTITY_KEY_FILE non impostata in produzione. Il servizio non parte: ' +
      'senza chiave scriverebbe anagrafiche in chiaro in un database cifrato.',
  );
} else {
  console.warn('[db] cifratura anagrafiche DISATTIVA — IDENTITY_KEY_FILE non impostata');
}

// ─── Aiutanti ───────────────────────────────────────────────────────────────

/**
 * Cifra i campi dell'anagrafica dentro un blocco `data`.
 * Gestisce sia `{ lastName: 'Rossi' }` sia `{ lastName: { set: 'Rossi' } }`,
 * che Prisma accetta entrambi.
 */
function cifraBlocco(dati: unknown, aad: string): void {
  if (!eOggetto(dati)) return;
  for (const campo of CAMPI_CIFRATI) {
    const valore = dati[campo];
    if (typeof valore === 'string') {
      dati[campo] = cifra(valore, aad);
    } else if (eOggetto(valore) && typeof valore.set === 'string') {
      valore.set = cifra(valore.set, aad);
    }
  }
}

/** I tre rami possibili sotto `identity`: create, update, upsert. */
function cifraRamiIdentity(identity: unknown, aad: string): void {
  if (!eOggetto(identity)) return;
  cifraBlocco(identity.create, aad);
  cifraBlocco(identity.update, aad);
  if (eOggetto(identity.upsert)) {
    cifraBlocco(identity.upsert.create, aad);
    cifraBlocco(identity.upsert.update, aad);
  }
}

const MODELLI_ANAGRAFICA = new Set(['Athlete', 'AthleteIdentity']);

// ─── Il client ──────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof creaClient> | undefined };

function creaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Le estensioni si applicano SEMPRE, cosi' il tipo del client e' uno solo.
  // Quando la chiave non c'e' sono inerti: `decifra` restituisce il testo in
  // chiaro immutato, e la parte di scrittura esce subito (vedi sotto).
  return base
    .$extends({
      name: 'decifratura-anagrafiche',
      result: {
        athleteIdentity: {
          firstName: {
            needs: { athleteId: true, firstName: true },
            compute: (i) => decifra(i.firstName, i.athleteId),
          },
          lastName: {
            needs: { athleteId: true, lastName: true },
            compute: (i) => decifra(i.lastName, i.athleteId),
          },
          email: {
            needs: { athleteId: true, email: true },
            compute: (i) => decifra(i.email, i.athleteId),
          },
          photoUrl: {
            needs: { athleteId: true, photoUrl: true },
            compute: (i) => decifra(i.photoUrl, i.athleteId),
          },
        },
      },
    })
    .$extends({
      name: 'cifratura-anagrafiche',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!cifraturaAttiva) return query(args);

            const a = args as Record<string, unknown>;

            // Questo controllo vale per OGNI modello: l'ordinamento incriminato
            // arriva quasi sempre da un'altra tabella (Team, GameSession...).
            const inOrdinamento = trovaOrdinamentoAnagrafica(a);
            if (inOrdinamento) {
              throw new ErroreCifratura(
                `"${inOrdinamento}" e' cifrata: ordinare o filtrare su questa colonna in SQL ` +
                  'darebbe un risultato sbagliato senza segnalarlo. Togliere l\'orderBy dalla ' +
                  'query e usare ordinaPerCognome/ordinaVoci dopo la lettura ' +
                  '(vedi PIANO_CIFRATURA_VAULT.md §7).',
              );
            }

            // `user_identities` non e' cifrata: si esce subito, senza toccare
            // niente. Il modello va guardato, perche' User.update presenta
            // `identity.update.lastName` identico ad Athlete.update.
            if (!MODELLI_ANAGRAFICA.has(model)) return query(args);

            // Filtri e ordinamenti sulle colonne cifrate: errore esplicito.
            const inFiltro = trovaCampoCifrato(a.where) ?? trovaCampoCifrato(a.orderBy);
            if (inFiltro) {
              throw new ErroreCifratura(
                `"${inFiltro}" e' cifrata: non si puo' filtrare ne' ordinare in SQL. ` +
                  'Caricare le anagrafiche dell\'organizzazione e ordinare/filtrare in memoria ' +
                  '(vedi PIANO_CIFRATURA_VAULT.md §7).',
              );
            }

            if (!['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(operation)) {
              return query(args);
            }

            // ATTENZIONE: `upsert` non mette i dati in `args.data` ma in
            // `args.create` e `args.update`. Senza questo, un upsert
            // scriverebbe in chiaro SENZA sollevare niente.
            const blocchi: unknown[] =
              operation === 'upsert'
                ? [a.create, a.update]
                : Array.isArray(a.data)
                  ? a.data
                  : [a.data];

            if (model === 'AthleteIdentity') {
              for (const blocco of blocchi) {
                if (!eOggetto(blocco)) continue;
                // L'AAD e' l'athleteId: in create sta nei dati, in update nel where.
                const aad =
                  (typeof blocco.athleteId === 'string' && blocco.athleteId) ||
                  (eOggetto(a.where) && typeof a.where.athleteId === 'string' && a.where.athleteId) ||
                  '';
                if (!aad) {
                  throw new ErroreCifratura(
                    `${model}.${operation}: athleteId non determinabile, l'anagrafica non sarebbe ` +
                      'legata alla sua riga. Indicare esplicitamente athleteId.',
                  );
                }
                cifraBlocco(blocco, aad);
              }
              return query(args);
            }

            // model === 'Athlete'
            const conAnagrafica = blocchi.some((b) => eOggetto(b) && eOggetto(b.identity));
            if (!conAnagrafica) return query(args);

            if (operation === 'create') {
              throw new ErroreCifratura(
                "athlete.create con `identity: { create }` annidato non e' supportato: l'id " +
                  "dell'atleta non esiste ancora (@default(cuid()) lo genera il motore) e " +
                  "l'anagrafica non sarebbe legata alla sua riga. Creare prima l'atleta, poi " +
                  "l'anagrafica con athleteId esplicito, nella stessa transazione.",
              );
            }

            const aadAtleta = eOggetto(a.where) && typeof a.where.id === 'string' ? a.where.id : '';
            if (!aadAtleta) {
              throw new ErroreCifratura(
                `${model}.${operation}: id dell'atleta non determinabile dal where.`,
              );
            }
            for (const blocco of blocchi) {
              if (eOggetto(blocco)) cifraRamiIdentity(blocco.identity, aadAtleta);
            }

            return query(args);
          },
        },
      },
    });
}

/**
 * Il tipo del client esteso.
 *
 * `$extends` restituisce un tipo diverso da `PrismaClient` (fra l'altro senza
 * `$on` e `$use`). Chi riceve il client come parametro deve dichiarare questo,
 * non `PrismaClient`.
 */
export type DbClient = ReturnType<typeof creaClient>;

export const prisma = globalForPrisma.prisma ?? creaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { PrismaClient, Prisma };
export * from './identity-cifratura.js';
export default prisma;
