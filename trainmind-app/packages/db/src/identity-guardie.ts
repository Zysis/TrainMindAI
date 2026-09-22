// ============================================
// TrainMind — Guardie sulle query delle anagrafiche
// ============================================
//
// Modulo puro: nessun import di Prisma, cosi' si puo' provare con i test
// senza database e senza chiave. Contiene i controlli che fermano una query
// destinata a dare un risultato SBAGLIATO invece che un errore.

/** I campi di `athlete_identities` che viaggiano cifrati. */
export const CAMPI_CIFRATI = ['firstName', 'lastName', 'email', 'photoUrl'] as const;
export type CampoCifrato = (typeof CAMPI_CIFRATI)[number];

/** Oggetto semplice: non un array, non una Date. */
export function eOggetto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

/**
 * Cerca un filtro o un ordinamento su una colonna cifrata.
 *
 * Su testo cifrato un `contains` non puo' funzionare e un `orderBy` ordina per
 * ciphertext: entrambi restituirebbero un risultato sbagliato SENZA errore —
 * "nessun atleta trovato", oppure una lista in ordine casuale. Meglio fermarsi
 * con un messaggio che dice cosa fare.
 */
export function trovaCampoCifrato(nodo: unknown, profondita = 0): CampoCifrato | null {
  if (profondita > 8) return null;
  // `orderBy` accetta anche un array: senza questo ramo la forma
  // `orderBy: [{ identity: { lastName: 'asc' } }]` sfuggiva al controllo.
  if (Array.isArray(nodo)) {
    for (const voce of nodo) {
      const dentro = trovaCampoCifrato(voce, profondita + 1);
      if (dentro) return dentro;
    }
    return null;
  }
  if (!eOggetto(nodo)) return null;
  for (const [chiave, valore] of Object.entries(nodo)) {
    if ((CAMPI_CIFRATI as readonly string[]).includes(chiave)) return chiave as CampoCifrato;
    const dentro = trovaCampoCifrato(valore, profondita + 1);
    if (dentro) return dentro;
  }
  return null;
}

/**
 * Cerca un ordinamento o un filtro sull'anagrafica di un atleta OVUNQUE negli
 * argomenti, anche molti livelli sotto e partendo da un altro modello.
 *
 * Perche' serve un secondo controllo: quello sopra guarda `args.where` e
 * `args.orderBy` del modello in cima, e scatta solo su Athlete/AthleteIdentity.
 * Ma la forma piu' comune in questo codice era un'altra —
 *
 *     prisma.team.findFirst({ include: { athleteTeams: {
 *       orderBy: { athlete: { identity: { lastName: 'asc' } } } } } })
 *
 * — dove il modello in cima e' Team. Passava indisturbata e ordinava per
 * ciphertext: una rosa in ordine casuale, senza un errore da nessuna parte.
 * Trovata il 22/09/2026 leggendo l'SQL di `GET /teams/:id`.
 *
 * Il riconoscimento e' sul nome della relazione, `athlete`, perche' dagli
 * argomenti non si puo' risalire al modello puntato. `user_identities` non e'
 * cifrata e resta libera di ordinarsi in SQL.
 */
export function trovaOrdinamentoAnagrafica(nodo: unknown, profondita = 0): CampoCifrato | null {
  if (profondita > 10) return null;
  if (Array.isArray(nodo)) {
    for (const voce of nodo) {
      const dentro = trovaOrdinamentoAnagrafica(voce, profondita + 1);
      if (dentro) return dentro;
    }
    return null;
  }
  if (!eOggetto(nodo)) return null;
  for (const [chiave, valore] of Object.entries(nodo)) {
    if ((chiave === 'orderBy' || chiave === 'where') && eOggetto(valore)) {
      const perAtleta = valore.athlete;
      if (eOggetto(perAtleta)) {
        const campo = trovaCampoCifrato(perAtleta.identity);
        if (campo) return campo;
      }
    }
    const dentro = trovaOrdinamentoAnagrafica(valore, profondita + 1);
    if (dentro) return dentro;
  }
  return null;
}

