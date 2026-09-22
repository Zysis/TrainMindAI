/**
 * Test delle guardie sulle query.
 *
 * Difendono da un guasto MUTO: una query che ordina o filtra in SQL su una
 * colonna cifrata non fallisce, restituisce il risultato sbagliato — una rosa
 * in ordine casuale, una ricerca che non trova nessuno. Qui si verifica che
 * venga riconosciuta nelle forme in cui compare davvero nel codice.
 */
import { describe, it, expect } from 'vitest';
import { trovaCampoCifrato, trovaOrdinamentoAnagrafica } from '../identity-guardie.js';

describe('trovaCampoCifrato', () => {
  it('trova un filtro diretto su una colonna cifrata', () => {
    expect(trovaCampoCifrato({ lastName: { contains: 'ros', mode: 'insensitive' } })).toBe('lastName');
  });

  it('trova un campo cifrato annidato sotto identity', () => {
    expect(trovaCampoCifrato({ identity: { email: 'a@b.it' } })).toBe('email');
  });

  it('guarda anche dentro un array: orderBy accetta la forma a lista', () => {
    expect(trovaCampoCifrato([{ identity: { lastName: 'asc' } }])).toBe('lastName');
  });

  it('lascia passare dateOfBirth, che oggi non e\' cifrata', () => {
    expect(trovaCampoCifrato({ identity: { dateOfBirth: 'asc' } })).toBeNull();
  });

  it('lascia passare le colonne normali', () => {
    expect(trovaCampoCifrato({ jerseyNumber: 'asc', position: 'GUARD' })).toBeNull();
  });

  it('non esplode su null, stringhe e numeri', () => {
    expect(trovaCampoCifrato(null)).toBeNull();
    expect(trovaCampoCifrato('lastName')).toBeNull();
    expect(trovaCampoCifrato(42)).toBeNull();
  });
});

describe('trovaOrdinamentoAnagrafica', () => {
  // La forma esatta che il 22/09/2026 ordinava per ciphertext in GET /teams/:id
  it('riconosce l\'ordinamento annidato partito da un altro modello', () => {
    const args = {
      where: { id: 'squadra1', organizationId: 'org1' },
      include: {
        athleteTeams: {
          include: { athlete: { select: { id: true, identity: { select: { lastName: true } } } } },
          orderBy: { athlete: { identity: { lastName: 'asc' } } },
        },
      },
    };
    expect(trovaOrdinamentoAnagrafica(args)).toBe('lastName');
  });

  it('lo riconosce anche a tre livelli di profondita\'', () => {
    const args = {
      where: { id: 'x' },
      include: {
        sessioni: {
          include: {
            entries: {
              include: { athlete: true },
              orderBy: { athlete: { identity: { firstName: 'asc' } } },
            },
          },
        },
      },
    };
    expect(trovaOrdinamentoAnagrafica(args)).toBe('firstName');
  });

  it('riconosce anche un where, non solo un orderBy', () => {
    const args = { where: { athlete: { identity: { email: 'a@b.it' } } } };
    expect(trovaOrdinamentoAnagrafica(args)).toBe('email');
  });

  it('riconosce la forma a lista', () => {
    const args = { orderBy: { athlete: { identity: [{ lastName: 'asc' }] } } };
    expect(trovaOrdinamentoAnagrafica(args)).toBe('lastName');
  });

  // user_identities NON e' cifrata: ordinarla in SQL e' legittimo e deve restare
  // possibile, altrimenti si rompe la console admin.
  it('lascia in pace le anagrafiche dello staff', () => {
    const args = { orderBy: { createdBy: { identity: { lastName: 'asc' } } } };
    expect(trovaOrdinamentoAnagrafica(args)).toBeNull();
  });

  it('lascia passare un ordinamento su colonne in chiaro dell\'atleta', () => {
    const args = { orderBy: { athlete: { jerseyNumber: 'asc' } } };
    expect(trovaOrdinamentoAnagrafica(args)).toBeNull();
  });

  it('lascia passare una query senza ordinamenti', () => {
    const args = { where: { organizationId: 'org1' }, take: 20, skip: 0 };
    expect(trovaOrdinamentoAnagrafica(args)).toBeNull();
  });

  it('non scambia per ordinamento un blocco dati che contiene gli stessi nomi', () => {
    const args = { data: { athleteId: 'a1', lastName: 'Rossi', firstName: 'Mario' } };
    expect(trovaOrdinamentoAnagrafica(args)).toBeNull();
  });
});
