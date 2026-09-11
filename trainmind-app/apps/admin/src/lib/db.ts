import { Pool } from 'pg';

/**
 * Accesso al database della piattaforma — SOLA LETTURA.
 *
 * Perche' `pg` e SQL grezzo invece di Prisma:
 *
 *  1. Questa console non scrive nulla. Un ORM non serve, e la connessione usa
 *     l'utente Postgres `trainmind_reporting` che ha solo il permesso SELECT:
 *     anche un bug qui dentro non puo' toccare i dati dei clienti.
 *  2. Niente `prisma generate` nell'immagine, niente engine binari da far
 *     funzionare su Alpine (la libreria openssl/libc6-compat ci ha gia' fatto
 *     perdere tempo al primo deploy).
 *  3. Le query sono quasi tutte aggregazioni con window function e CTE:
 *     scritte in SQL sono leggibili, passate da Prisma no.
 *
 * NOTA SUI NOMI: le tabelle sono snake_case (@@map nello schema Prisma) ma le
 * COLONNE restano camelCase. Vanno quindi sempre fra virgolette doppie:
 * `"createdAt"`, non `createdat` — senza virgolette Postgres le abbassa a
 * minuscolo e la query fallisce.
 */

declare global {
  // eslint-disable-next-line no-var
  var __adminPool: Pool | undefined;
}

/**
 * Il pool si apre alla PRIMA QUERY, non al caricamento del modulo.
 *
 * Non e' un dettaglio di stile: `next build` importa ogni modulo per
 * raccogliere i dati delle pagine, e un pool creato al primo import
 * pretenderebbe il database gia' in fase di compilazione. La build fallirebbe
 * su una macchina di sviluppo con un errore che non c'entra niente col codice.
 * Cosi' invece la mancanza della variabile si manifesta a runtime, dove la
 * pagina di errore sa spiegarla.
 *
 * In sviluppo Next ricarica i moduli a ogni salvataggio: senza la cache
 * globale si aprirebbe un pool nuovo a ogni hot reload finche' Postgres non
 * rifiuta le connessioni.
 */
function getPool(): Pool {
  if (global.__adminPool) return global.__adminPool;

  const connectionString = process.env.DATABASE_URL_READONLY;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL_READONLY non impostata. La console legge il database con ' +
        'un utente dedicato in sola lettura: vedi infra/sql/reporting-role.sql',
    );
  }

  const pool = new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    // Se il database non risponde preferisco un errore in pagina a una
    // schermata bianca che resta appesa.
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
  });

  global.__adminPool = pool;
  return pool;
}

/**
 * Vero se la connessione e' configurata. Serve al layout per mostrare una
 * pagina che spiega cosa manca, invece di lasciar esplodere la prima query:
 * in produzione Next oscura i messaggi degli errori lato server, quindi il
 * testo dell'eccezione non arriverebbe mai a schermo.
 */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL_READONLY);
}

/** Esegue una SELECT e restituisce le righe tipizzate. */
export async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(sql, params as never[]);
  return res.rows as T[];
}

/** Come `q`, ma per le query che restituiscono una riga sola. */
export async function q1<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * `count(*)` di Postgres torna un bigint, che il driver consegna come stringa
 * per non perdere precisione. Qui i numeri sono piccoli: li riporto a number
 * una volta sola invece di ricordarmene in ogni pagina.
 */
export function n(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
