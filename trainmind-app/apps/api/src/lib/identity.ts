/**
 * Appiattimento delle identita'
 * ==============================
 *
 * Nome, cognome, data di nascita, email e foto degli atleti (e nome/cognome
 * dello staff) non stanno piu' sulla riga dei dati: vivono in
 * `athlete_identities` / `user_identities`. Vedi
 * documentation/PIANO_SEPARAZIONE_IDENTITA.md.
 *
 * Dal database escono quindi annidati:
 *
 *   { id, position, identity: { firstName, lastName } }
 *
 * mentre la web app, l'app atleta e l'app mobile si aspettano — e devono
 * continuare a ricevere — la forma piatta di sempre:
 *
 *   { id, position, firstName, lastName }
 *
 * `flattenIdentities` fa questa conversione, e un hook `preSerialization`
 * registrato in `app.ts` la applica a OGNI risposta dell'API. E' il motivo per
 * cui nessuna riga di `apps/web`, `trainmind-athlete` e `trainmind-mobile` e'
 * stata toccata da questo lavoro: il JSON in uscita e' identico a prima.
 *
 * Chi costruisce un PDF, un DOCX o un'email lavora sull'oggetto Prisma prima
 * che passi di qui: la' va chiamata a mano (vedi i servizi in `services/`).
 */

/** Anagrafica completa dell'atleta. */
export const athleteIdentitySelect = {
  select: {
    firstName: true,
    lastName: true,
    dateOfBirth: true,
    email: true,
    photoUrl: true,
  },
} as const;

/** Solo nome e cognome: il caso piu' frequente nelle liste. */
export const athleteNameSelect = {
  select: {
    firstName: true,
    lastName: true,
  },
} as const;

/** Nome, cognome e foto: liste con avatar. */
export const athleteNamePhotoSelect = {
  select: {
    firstName: true,
    lastName: true,
    photoUrl: true,
  },
} as const;

/** Nome e cognome di un utente dello staff. */
export const userNameSelect = {
  select: {
    firstName: true,
    lastName: true,
  },
} as const;

/**
 * Ordinamento per cognome, in memoria.
 *
 * NON si puo' ordinare per cognome in SQL: la colonna e' cifrata, e
 * `ORDER BY last_name` metterebbe in fila i ciphertext — cioe' un ordine
 * casuale, senza alcun errore che lo segnali. Il guasto peggiore e' quello
 * muto: una lista di atleti in ordine sbagliato non sembra un difetto, sembra
 * un capriccio dell'applicazione.
 *
 * Quindi si carica e si ordina qui, dopo che l'estensione Prisma ha decifrato.
 * Il costo e' irrilevante: sono le voci di una squadra, non di un archivio.
 *
 * Collazione italiana con `sensitivity: 'base'`, la stessa della lista atleti,
 * cosi' "D'Angelo" e "D'angelo" finiscono vicini e le accentate al posto loro.
 */
const collatore = new Intl.Collator('it', { sensitivity: 'base' });

type Anagrafica = { firstName?: string | null; lastName?: string | null } | null | undefined;

export function ordinaPerCognome<T>(
  righe: T[] | null | undefined,
  anagrafica: (riga: T) => Anagrafica,
): void {
  if (!Array.isArray(righe)) return;
  righe.sort((a, b) => {
    const x = anagrafica(a);
    const y = anagrafica(b);
    const perCognome = collatore.compare(x?.lastName ?? '', y?.lastName ?? '');
    // A parita' di cognome si passa al nome: due Rossi non devono ballare
    // di posizione da una richiesta all'altra.
    return perCognome !== 0 ? perCognome : collatore.compare(x?.firstName ?? '', y?.firstName ?? '');
  });
}

/**
 * Ordina le voci (`entries`) di un foglio presenze o di una partita.
 *
 * Si usa avvolgendo la query: `const s = ordinaVoci(await prisma...)`. In
 * questa forma e' difficile dimenticarla, perche' sta sulla stessa riga della
 * query che prima portava l'`orderBy`.
 */
type Voce = { athlete?: { identity?: Anagrafica } | null };

export function ordinaVoci<T extends { entries: Voce[] } | null>(sessione: T): T {
  if (sessione) ordinaPerCognome(sessione.entries, (v) => v.athlete?.identity);
  return sessione;
}

/** I campi che, in una query, vanno chiesti al caveau e non alla riga dati. */
const IDENTITY_KEYS = ['firstName', 'lastName', 'dateOfBirth', 'email', 'photoUrl'] as const;
type IdentityKey = (typeof IDENTITY_KEYS)[number];
const IDENTITY_FIELDS = new Set<string>(IDENTITY_KEYS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Porta i campi di `identity` sul loro contenitore, ovunque si trovino nella
 * risposta: liste, oggetti annidati, relazioni dentro relazioni.
 *
 * Non tocca niente che non abbia una chiave `identity`, quindi applicarla a una
 * risposta che non contiene anagrafiche non costa e non cambia nulla.
 */
export function flattenIdentities<T>(value: T): T {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = flattenIdentities(value[i]);
    }
    return value;
  }

  if (!isPlainObject(value)) return value;

  const obj = value as Record<string, unknown>;

  if ('identity' in obj) {
    const identity = obj.identity;
    if (isPlainObject(identity)) {
      for (const [key, val] of Object.entries(identity)) {
        // Un campo gia' presente sul contenitore vince: non si sovrascrive
        // nulla che la query abbia messo li' di proposito.
        if (!(key in obj)) obj[key] = val;
      }
    }
    // Sparisce in ogni caso: `identity: null` non deve arrivare al client.
    delete obj.identity;
  }

  for (const key of Object.keys(obj)) {
    obj[key] = flattenIdentities(obj[key]);
  }

  return obj as T;
}

/**
 * Divide un corpo di richiesta (create/update atleta) fra i campi che vanno
 * nella riga dati e quelli che vanno nel caveau.
 */
export function splitAthletePayload<T extends Record<string, unknown>>(
  data: T,
): {
  core: Omit<T, IdentityKey>;
  identity: Pick<T, Extract<keyof T, IdentityKey>>;
} {
  const core: Record<string, unknown> = {};
  const identity: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (IDENTITY_FIELDS.has(key)) {
      identity[key] = value;
    } else {
      core[key] = value;
    }
  }

  // I tipi restano quelli di partenza: senza questo, `...core` perde
  // `position` e Prisma protesta che manca un campo obbligatorio.
  return {
    core: core as Omit<T, IdentityKey>,
    identity: identity as Pick<T, Extract<keyof T, IdentityKey>>,
  };
}

type WithIdentity = {
  identity?: { firstName: string; lastName: string } | null;
} | null | undefined;

/**
 * "Nome Cognome". Stringa vuota se l'anagrafica manca — succede solo se la
 * riga del caveau e' stata cancellata (erasure GDPR) mentre la riga dati resta.
 */
export function fullName(entity: WithIdentity): string {
  if (!entity?.identity) return '';
  return `${entity.identity.firstName} ${entity.identity.lastName}`.trim();
}

/** "Cognome Nome", per elenchi e tabelle ordinate. */
export function sortName(entity: WithIdentity): string {
  if (!entity?.identity) return '';
  return `${entity.identity.lastName} ${entity.identity.firstName}`.trim();
}

/** Nome visualizzato, per PDF, DOCX ed email. */
export function displayName(
  entity: { identity?: { firstName: string; lastName: string } | null } | null | undefined,
): string {
  if (!entity?.identity) return '—';
  return `${entity.identity.firstName} ${entity.identity.lastName}`.trim();
}
