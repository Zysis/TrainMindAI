/**
 * TrainMind — Account di prova per i piani (gratis, Starter, Pro, Ultra)
 * ======================================================================
 *
 * Scritto il 9/10/2026 per provare in locale piani, prova gratuita e limiti
 * (documentation/GUIDA_PIANI_E_PROVA.md). Fa quattro cose, in quest'ordine:
 *
 *   1. ELENCA tutti gli account presenti nel database, con organizzazione e
 *      piano, cosi' si vede se ce ne sono altri oltre a quelli noti.
 *
 *   2. CANCELLA le organizzazioni degli account in DA_CANCELLARE, con tutto
 *      quello che contengono (squadre, atleti, dati sanitari, utenti...).
 *      Se in una di quelle organizzazioni c'e' anche un account NON elencato,
 *      l'organizzazione viene saltata e segnalata: per cancellarla lo stesso
 *      si rilancia con --forza.
 *      Gli account in SOLO_ACCOUNT perdono solo l'accesso: l'organizzazione
 *      resta, e resta anche l'atleta collegato con tutti i suoi dati.
 *
 *   3. CREA (o ritrova) test_starter / test_pro / test_ultra / test_club (con
 *      due utenti di staff) con la stessa
 *      password di test_gratis@demo.com: se ne copia l'hash, quindi la
 *      password non passa mai da qui. Copia anche i consensi di test_gratis
 *      e crea la libreria esercizi di default, come fa la registrazione.
 *
 *   4. RIEMPIE le quattro organizzazioni di dati demo dentro i limiti di
 *      ciascun piano, dopo averne svuotato i dati (squadre, atleti, piani,
 *      calendario, report, consumi AI...). Restano organizzazione, utenti,
 *      consensi e libreria esercizi. Niente report giornalieri: quello della
 *      prova gratuita resta da fare.
 *
 * Si puo' rilanciare quando si vuole: riparte da dati puliti.
 * I dati casuali sono deterministici (stessi nomi a ogni giro).
 *
 * Esecuzione (PowerShell, dalla radice di trainmind-app):
 *   pnpm --filter @trainmind/db exec tsx prisma/setup-test-accounts.ts
 *   pnpm --filter @trainmind/db exec tsx prisma/setup-test-accounts.ts --solo-elenco
 *   pnpm --filter @trainmind/db exec tsx prisma/setup-test-accounts.ts --forza
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(QUI, '../../..'); // trainmind-app

const ARGOMENTI = new Set(process.argv.slice(2));
const SOLO_ELENCO = ARGOMENTI.has('--solo-elenco');
const FORZA = ARGOMENTI.has('--forza');

// ─── Account ─────────────────────────────────────────────────────────────────

/** Account la cui organizzazione va cancellata per intero. */
const DA_CANCELLARE = [
  'avispa@pro.com',
  'avispa@starter.com',
  'admin.test@trainmind.demo',
  'medico.test@trainmind.demo',
  'preparatore1.test@trainmind.demo',
  'preparatore2.test@trainmind.demo',
  'viewer.test@trainmind.demo',
];

/**
 * Account da cancellare SENZA toccare l'organizzazione: Nicola Bortolotti sta
 * nella "TrainMind Demo" di coach@example.com, che resta (9/10/2026). Si toglie
 * l'utente (l'accesso all'app atleti); l'atleta e i suoi dati restano.
 */
const SOLO_ACCOUNT = ['nicola.bortolotti@example.com'];

/** Account noti che restano: servono solo a non segnalarli come "altri". */
const ACCOUNT_DA_TENERE = ['coach@example.com', 'camilla.coresi@demo.com'];

const EMAIL_GRATIS = 'test_gratis@demo.com';


type Tier = 'STARTER' | 'PROFESSIONAL' | 'ULTRA' | 'CLUB';

interface SquadraCfg {
  name: string;
  color: string;
  size: number;
}

interface AccountCfg {
  key: string;
  email: string;
  /** Assente = l'account esiste gia' (test_gratis, nato dalla registrazione). */
  crea?: { orgName: string; tier: Tier; firstName: string; lastName: string };
  /** Altri utenti dello staff nella stessa organizzazione (stessa password). */
  staff?: Array<{ email: string; role: 'TRAINER' | 'MEDICAL' | 'VIEWER'; firstName: string; lastName: string }>;
  squadre: SquadraCfg[];
}

/**
 * Dati dentro i limiti di ogni piano, lasciando spazio per provare il limite:
 *   prova    1 × 12  → 1 squadra da 10   (si aggiungono 2 atleti, il 13° no)
 *   Starter  1 × 12  → 1 squadra da 11
 *   Pro      2 × 14  → 2 squadre da 12   (la 3ª squadra no)
 *   Ultra    4 × 20  → 3 squadre da 16   (si crea la 4ª, la 5ª no; estensioni)
 */
const ACCOUNTS: AccountCfg[] = [
  {
    key: 'gratis',
    email: EMAIL_GRATIS,
    squadre: [{ name: 'Prima Squadra', color: '#0d9488', size: 10 }],
  },
  {
    key: 'starter',
    email: 'test_starter@demo.com',
    crea: { orgName: 'Test Starter', tier: 'STARTER', firstName: 'Test', lastName: 'Starter' },
    squadre: [{ name: 'Prima Squadra', color: '#ef4444', size: 11 }],
  },
  {
    key: 'pro',
    email: 'test_pro@demo.com',
    crea: { orgName: 'Test Professional', tier: 'PROFESSIONAL', firstName: 'Test', lastName: 'Pro' },
    squadre: [
      { name: 'Prima Squadra', color: '#ef4444', size: 12 },
      { name: 'Serie C', color: '#3b82f6', size: 12 },
    ],
  },
  {
    key: 'ultra',
    email: 'test_ultra@demo.com',
    crea: { orgName: 'Test Ultra', tier: 'ULTRA', firstName: 'Test', lastName: 'Ultra' },
    squadre: [
      { name: 'Prima Squadra', color: '#ef4444', size: 16 },
      { name: 'Serie C', color: '#3b82f6', size: 16 },
      { name: 'Under 20', color: '#f59e0b', size: 16 },
    ],
  },
  {
    // Club 6 × 20, 4 utenti: 5 squadre da 18 (si crea la 6ª, la 7ª no; si
    // aggiungono 2 atleti per squadra) e 3 utenti su 4 (se ne invita uno, il
    // quinto no, salvo utente aggiuntivo).
    key: 'club',
    email: 'test_club@demo.com',
    crea: { orgName: 'Test Club', tier: 'CLUB', firstName: 'Test', lastName: 'Club' },
    staff: [
      { email: 'test_club_preparatore@demo.com', role: 'TRAINER', firstName: 'Paolo', lastName: 'Preparatore' },
      { email: 'test_club_medico@demo.com', role: 'MEDICAL', firstName: 'Marta', lastName: 'Medico' },
    ],
    squadre: [
      { name: 'Prima Squadra', color: '#ef4444', size: 18 },
      { name: 'Serie C', color: '#3b82f6', size: 18 },
      { name: 'Serie D', color: '#8b5cf6', size: 18 },
      { name: 'Under 20', color: '#f59e0b', size: 18 },
      { name: 'Promozione', color: '#10b981', size: 18 },
    ],
  },
];

/** Tutti gli indirizzi degli account di prova, staff compreso. */
const EMAIL_PROVA = new Set(ACCOUNTS.flatMap((a) => [a.email, ...(a.staff ?? []).map((x) => x.email)]));

// ─── Ambiente ────────────────────────────────────────────────────────────────

/**
 * Il client di @trainmind/db cifra le anagrafiche degli atleti se trova
 * IDENTITY_KEY_FILE, che sta nel .env della radice: pnpm qui carica solo
 * packages/db/.env. Si leggono SOLO le due variabili che servono (NODE_ENV
 * no: in sviluppo il client stamperebbe ogni query).
 */
function caricaAmbiente(): void {
  for (const file of [resolve(RADICE, '.env'), resolve(QUI, '../.env')]) {
    if (!existsSync(file)) continue;
    for (const riga of readFileSync(file, 'utf-8').split(/\r?\n/)) {
      const m = riga.match(/^\s*(IDENTITY_KEY_FILE|DATABASE_URL)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, nome, grezzo] = m;
      const valore = grezzo.replace(/^["']|["']$/g, '');
      if (!process.env[nome] && valore) process.env[nome] = valore;
    }
  }
}

// ─── Numeri casuali ripetibili ───────────────────────────────────────────────

function generatore(seme: string) {
  let h = 1779033703 ^ seme.length;
  for (let i = 0; i < seme.length; i++) {
    h = Math.imul(h ^ seme.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    num: (min: number, max: number) => Math.round((next() * (max - min) + min) * 100) / 100,
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
  };
}

// ─── Date ────────────────────────────────────────────────────────────────────

const OGGI = new Date();
const GIORNO = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * GIORNO);
const giorno = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Inizio stagione 2026/27: lunedi' 17 agosto 2026. */
const INIZIO_STAGIONE = giorno('2026-08-17');

// ─── Anagrafiche ─────────────────────────────────────────────────────────────

const NOMI = [
  'Alessandro', 'Marco', 'Luca', 'Davide', 'Matteo', 'Andrea', 'Simone', 'Giulio', 'Federico', 'Riccardo',
  'Pietro', 'Emanuele', 'Filippo', 'Giacomo', 'Lorenzo', 'Christian', 'Daniele', 'Antonio', 'Michele', 'Enrico',
  'Samuele', 'Roberto', 'Fabio', 'Edoardo', 'Vincenzo', 'Alessio', 'Nicolò', 'Manuel', 'Paolo', 'Gianluca',
  'Tommaso', 'Leonardo', 'Gabriele', 'Stefano', 'Mattia', 'Diego', 'Jacopo', 'Elia', 'Cristian', 'Francesco',
];
const COGNOMI = [
  'Baldini', 'Sartori', 'Ferraro', 'Callegari', 'Righi', 'Trevisan', 'Battaglia', 'Piras', 'Zanetti', 'Donati',
  'Guarnieri', 'Costantini', 'Bellini', 'Serafini', 'Pagani', 'Vidal', 'Orsini', 'Farina', 'Cattaneo', 'Spadoni',
  'Grimaldi', 'Milani', 'Nardini', 'Vaccaro', 'Rizzo', 'Fiorentini', 'Cortesi', 'Bertani', 'Rossetti', 'Mazzoni',
  'Innocenti', 'De Santis', 'Perri', 'Rocca', 'Marconi', 'Longo', 'Ferretti', 'Baldassarre', 'Esposito', 'Aiello',
  'Palumbo', 'Grasso', 'De Rosa', 'Coppola', 'Cirillo', 'Ruggiero', 'Iovine', 'Migliore', 'Napolitano', 'Barbato',
  'Santagata', 'Galli', 'Conti', 'Marini', 'Colombo', 'Bruno', 'Greco', 'Lombardi', 'Moretti', 'Fontana',
];
const RUOLI = [
  { pos: 'PG', h: [178, 186], w: [74, 82] },
  { pos: 'SG', h: [185, 193], w: [80, 89] },
  { pos: 'SF', h: [192, 199], w: [87, 96] },
  { pos: 'PF', h: [198, 205], w: [95, 106] },
  { pos: 'C', h: [203, 212], w: [102, 116] },
];

// ─── Contenuti ───────────────────────────────────────────────────────────────

const METRICHE = [
  { type: 'vertical_jump', unit: 'cm', range: [42, 64] },
  { type: 'sprint_20m', unit: 's', range: [2.8, 3.3] },
  { type: 't_test', unit: 's', range: [8.7, 10.3] },
  { type: 'body_fat', unit: '%', range: [7, 14] },
  { type: 'vo2_max', unit: 'ml/kg/min', range: [46, 61] },
  { type: '1rm_bench', unit: 'kg', range: [80, 135] },
  { type: '1rm_squat', unit: 'kg', range: [120, 195] },
];
const DATE_TEST = [giorno('2026-08-24'), giorno('2026-09-28')];

const COLORI_FASE: Record<string, string> = {
  PREPARATION: '#14b8a6',
  SPECIFIC: '#f59e0b',
  COMPETITION: '#ef4444',
  TRANSITION: '#8b5cf6',
  TAPER: '#3b82f6',
  RECOVERY: '#22c55e',
};

type Fase = 'PREPARATION' | 'SPECIFIC' | 'COMPETITION' | 'TRANSITION' | 'TAPER' | 'RECOVERY';
interface PeriCfg {
  name: string;
  type: 'BLOCK' | 'UNDULATING' | 'LINEAR';
  start: Date;
  mesocicli: Array<{ name: string; phase: Fase; weeks: number; load: number }>;
}

const PERIODIZZAZIONI: PeriCfg[] = [
  {
    name: 'Pre-Season 2026/27',
    type: 'BLOCK',
    start: INIZIO_STAGIONE,
    mesocicli: [
      { name: 'Preparazione Generale', phase: 'PREPARATION', weeks: 3, load: 70 },
      { name: 'Forza & Potenza', phase: 'SPECIFIC', weeks: 4, load: 85 },
      { name: 'Pre-Campionato', phase: 'TAPER', weeks: 2, load: 60 },
    ],
  },
  {
    name: 'Campionato 2026/27 — Andata',
    type: 'UNDULATING',
    start: addDays(INIZIO_STAGIONE, 9 * 7), // lunedi' 19 ottobre
    mesocicli: [
      { name: 'Andata Fase 1', phase: 'COMPETITION', weeks: 6, load: 85 },
      { name: 'Recupero Natale', phase: 'RECOVERY', weeks: 2, load: 45 },
      { name: 'Andata Fase 2', phase: 'COMPETITION', weeks: 5, load: 88 },
    ],
  },
];

const TIPI_SEDUTA = [
  'Forza & Condizionamento',
  'Tecnica individuale',
  'Tattica di squadra',
  'Tiro e finalizzazione',
  'Agilità e velocità',
  'Pliometria',
  'Recupero attivo',
  'Scrimmage',
];

const AVVERSARI = ['Virtus Ponte', 'Basket Riviera', 'Pallacanestro Colli', 'Olimpia Valle', 'Aurora Basket', 'Junior Lago'];

const CRITERI_RTP: Record<string, string[]> = {
  PHASE_1: ['Dolore a riposo assente', 'ROM completo senza dolore'],
  PHASE_2: ['Camminata/corsa leggera senza dolore', 'Forza >70% arto controlaterale'],
  PHASE_3: ['Corsa progressiva e cambi di direzione senza dolore', 'Forza >85% arto controlaterale'],
  PHASE_4: ['Allenamento completo senza contatto tollerato', 'Test funzionali >90%'],
  PHASE_5: ['Allenamento completo con contatto tollerato', 'Idoneità medica al rientro in gara'],
};
const ORDINE_FASI = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'] as const;

function intensita(load: number): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' {
  if (load < 40) return 'VERY_LOW';
  if (load < 60) return 'LOW';
  if (load < 75) return 'MODERATE';
  if (load < 90) return 'HIGH';
  return 'VERY_HIGH';
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  caricaAmbiente();
  // Import dinamico: il client legge IDENTITY_KEY_FILE quando viene caricato.
  const { prisma } = await import('../src/index.js');
  type Db = typeof prisma;
  type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];

  // ── Cancellazione generica, guidata dalle foreign key ──────────────────────
  //
  // Lo schema ha decine di tabelle e parecchie FK senza cascade (13 solo verso
  // `athletes`): un elenco scritto a mano invecchia alla prima tabella nuova.
  // Qui si legge il catalogo di Postgres: per ogni riga da cancellare si
  // cancellano prima le righe che la richiamano con una FK obbligatoria, e si
  // mettono a NULL quelle che la richiamano con una FK facoltativa.

  interface Fk { child: string; col: string; nullable: boolean; refcol: string }
  const cacheFk = new Map<string, Fk[]>();
  const cachePk = new Map<string, string | null>();

  async function fkVerso(db: Tx, tabella: string): Promise<Fk[]> {
    const c = cacheFk.get(tabella);
    if (c) return c;
    const righe = await db.$queryRawUnsafe<Fk[]>(
      `SELECT ch.relname::text AS child, a.attname::text AS col, NOT a.attnotnull AS nullable, ra.attname::text AS refcol
         FROM pg_constraint k
         JOIN pg_class ch ON ch.oid = k.conrelid
         JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
         JOIN pg_attribute ra ON ra.attrelid = k.confrelid AND ra.attnum = k.confkey[1]
        WHERE k.contype = 'f' AND array_length(k.conkey, 1) = 1
          AND k.confrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace)`,
      tabella,
    );
    cacheFk.set(tabella, righe);
    return righe;
  }

  async function pkDi(db: Tx, tabella: string): Promise<string | null> {
    if (cachePk.has(tabella)) return cachePk.get(tabella)!;
    const righe = await db.$queryRawUnsafe<Array<{ col: string }>>(
      `SELECT a.attname::text AS col FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace)
          AND i.indisprimary`,
      tabella,
    );
    const pk = righe.length === 1 ? righe[0].col : null;
    cachePk.set(tabella, pk);
    return pk;
  }

  async function cancella(db: Tx, tabella: string, colonna: string, valori: string[], conteggi: Map<string, number>, visti = new Set<string>()) {
    const daFare = valori.filter((v) => !visti.has(`${tabella}:${colonna}:${v}`));
    if (daFare.length === 0) return;
    daFare.forEach((v) => visti.add(`${tabella}:${colonna}:${v}`));

    for (const fk of await fkVerso(db, tabella)) {
      // I valori richiamati dalla FK (quasi sempre l'id stesso).
      const rif =
        fk.refcol === colonna
          ? daFare
          : (
              await db.$queryRawUnsafe<Array<{ v: string }>>(
                `SELECT "${fk.refcol}"::text AS v FROM "${tabella}" WHERE "${colonna}"::text = ANY($1::text[])`,
                daFare,
              )
            ).map((r) => r.v);
      if (rif.length === 0) continue;

      if (fk.nullable) {
        await db.$executeRawUnsafe(
          `UPDATE "${fk.child}" SET "${fk.col}" = NULL WHERE "${fk.col}"::text = ANY($1::text[])`,
          rif,
        );
        continue;
      }
      const pk = await pkDi(db, fk.child);
      if (pk) {
        const figli = (
          await db.$queryRawUnsafe<Array<{ v: string }>>(
            `SELECT "${pk}"::text AS v FROM "${fk.child}" WHERE "${fk.col}"::text = ANY($1::text[])`,
            rif,
          )
        ).map((r) => r.v);
        await cancella(db, fk.child, pk, figli, conteggi, visti);
      } else {
        const n = await db.$executeRawUnsafe(
          `DELETE FROM "${fk.child}" WHERE "${fk.col}"::text = ANY($1::text[])`,
          rif,
        );
        if (n) conteggi.set(fk.child, (conteggi.get(fk.child) ?? 0) + n);
      }
    }

    const n = await db.$executeRawUnsafe(
      `DELETE FROM "${tabella}" WHERE "${colonna}"::text = ANY($1::text[])`,
      daFare,
    );
    if (n) conteggi.set(tabella, (conteggi.get(tabella) ?? 0) + n);
  }

  function stampaConteggi(conteggi: Map<string, number>) {
    const voci = [...conteggi.entries()].sort((a, b) => b[1] - a[1]);
    if (voci.length === 0) return console.log('      (niente da cancellare)');
    console.log('      ' + voci.map(([t, n]) => `${t} ${n}`).join(' · '));
  }

  // ── 1. Elenco ──────────────────────────────────────────────────────────────

  interface RigaUtente {
    email: string; role: string; isActive: boolean; lastLoginAt: Date | null;
    orgId: string; orgName: string; tier: string; planLegacy: boolean; trialEndsAt: Date | null;
  }
  const elenca = () =>
    prisma.$queryRawUnsafe<RigaUtente[]>(
      `SELECT u.email, u.role::text AS role, u."isActive", u."lastLoginAt",
              o.id AS "orgId", o.name AS "orgName", o.tier::text AS tier, o."planLegacy", o."trialEndsAt"
         FROM users u JOIN organizations o ON o.id = u."organizationId"
        ORDER BY o.name, u.email`,
    );

  const fmtData = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
  function stampaElenco(righe: RigaUtente[]) {
    const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
    console.log(
      `  ${pad('EMAIL', 34)} ${pad('RUOLO', 8)} ${pad('ORGANIZZAZIONE', 24)} ${pad('PIANO', 13)} ${pad('STATO', 18)} ULTIMO ACCESSO`,
    );
    for (const r of righe) {
      const stato = r.planLegacy
        ? 'esistente (esente)'
        : r.trialEndsAt
          ? `prova → ${fmtData(r.trialEndsAt)}`
          : 'piano attivo';
      const segno = DA_CANCELLARE.includes(r.email) || SOLO_ACCOUNT.includes(r.email) ? '✖' : EMAIL_PROVA.has(r.email) ? '★' : ' ';
      console.log(
        `${segno} ${pad(r.email, 34)} ${pad(r.role, 8)} ${pad(r.orgName, 24)} ${pad(r.tier, 13)} ${pad(stato, 18)} ${fmtData(r.lastLoginAt)}`,
      );
    }
    console.log('  ✖ = da cancellare   ★ = account di prova   (coach@example.com e camilla.coresi@demo.com restano)');
  }

  console.log('\n═══ 1. Account presenti ═══');
  const prima = await elenca();
  stampaElenco(prima);
  const noti = new Set([...DA_CANCELLARE, ...SOLO_ACCOUNT, ...ACCOUNT_DA_TENERE, ...EMAIL_PROVA]);
  const altri = prima.filter((r) => !noti.has(r.email));
  console.log(
    altri.length
      ? `\n  Altri account oltre a quelli noti (${altri.length}): ${altri.map((r) => r.email).join(', ')}`
      : '\n  Nessun altro account oltre a quelli noti.',
  );
  if (SOLO_ELENCO) return;

  // ── 2. Cancellazione ───────────────────────────────────────────────────────

  console.log('\n═══ 2. Cancellazione ═══');
  const orgDaCancellare = new Map<string, string>(); // id → nome
  const orgCancellate = new Set<string>();
  for (const r of prima) if (DA_CANCELLARE.includes(r.email)) orgDaCancellare.set(r.orgId, r.orgName);
  for (const email of [...DA_CANCELLARE, ...SOLO_ACCOUNT]) {
    if (!prima.some((r) => r.email === email)) console.log(`  · ${email}: non presente, niente da fare`);
  }

  for (const [orgId, orgName] of orgDaCancellare) {
    const ospiti = prima.filter(
      (r) => r.orgId === orgId && !DA_CANCELLARE.includes(r.email) && !SOLO_ACCOUNT.includes(r.email),
    );
    if (ospiti.length && !FORZA) {
      console.log(
        `  ! "${orgName}" SALTATA: contiene anche ${ospiti.map((r) => r.email).join(', ')}. ` +
          'Rilancia con --forza per cancellarla lo stesso.',
      );
      continue;
    }
    const conteggi = new Map<string, number>();
    await prisma.$transaction((tx) => cancella(tx as Tx, 'organizations', 'id', [orgId], conteggi), {
      timeout: 300_000,
      maxWait: 30_000,
    });
    const utenti = prima.filter((r) => r.orgId === orgId).map((r) => r.email);
    console.log(`  ✓ "${orgName}" cancellata con ${utenti.join(', ')}`);
    stampaConteggi(conteggi);
    orgCancellate.add(orgId);
  }

  // Solo l'account: l'organizzazione resta.
  for (const email of SOLO_ACCOUNT) {
    const r = prima.find((x) => x.email === email);
    if (!r || orgCancellate.has(r.orgId)) continue;
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) continue;
    const conteggi = new Map<string, number>();
    await prisma.$transaction((tx) => cancella(tx as Tx, 'users', 'id', [u.id], conteggi), {
      timeout: 300_000,
      maxWait: 30_000,
    });
    console.log(`  ✓ account ${email} cancellato ("${r.orgName}" resta, con l'atleta collegato)`);
    stampaConteggi(conteggi);
  }

  // ── 3. Account di prova ────────────────────────────────────────────────────

  console.log('\n═══ 3. Account di prova ═══');
  const gratis = await prisma.user.findUnique({ where: { email: EMAIL_GRATIS } });
  if (!gratis) {
    throw new Error(`${EMAIL_GRATIS} non esiste: registralo dall'app (prova gratuita) e rilancia lo script.`);
  }
  const consensiGratis = await prisma.consentRecord.findMany({
    where: { userId: gratis.id, revokedAt: null },
  });

  const esercizi = (() => {
    const file = resolve(RADICE, 'seed/exercises.json');
    if (!existsSync(file)) return [] as Array<{ name: string; category: string; description?: string; muscleGroups: string[]; equipment: string[] }>;
    return JSON.parse(readFileSync(file, 'utf-8')) as Array<{
      name: string; category: string; description?: string; muscleGroups: string[]; equipment: string[];
    }>;
  })();

  async function assicuraEsercizi(orgId: string) {
    const ci = await prisma.exercise.count({ where: { organizationId: orgId } });
    if (ci > 0 || esercizi.length === 0) return;
    await prisma.exercise.createMany({
      data: esercizi.map((ex) => ({
        id: `default-${orgId}-${ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`,
        name: ex.name,
        category: ex.category,
        description: ex.description || null,
        muscleGroups: ex.muscleGroups,
        equipment: ex.equipment,
        organizationId: orgId,
      })),
      skipDuplicates: true,
    });
  }

  const SUB_TIER: Record<Tier, string> = { STARTER: 'starter', PROFESSIONAL: 'professional', ULTRA: 'ultra', CLUB: 'club' };

  /** Utente con la password e i consensi di test_gratis, come alla registrazione. */
  async function creaUtente(
    tx: Tx,
    dati: { email: string; role: 'ADMIN' | 'TRAINER' | 'MEDICAL' | 'VIEWER'; orgId: string; firstName: string; lastName: string },
  ) {
    const u = await tx.user.create({
      data: {
        email: dati.email,
        passwordHash: gratis!.passwordHash,
        role: dati.role,
        locale: gratis!.locale ?? 'it',
        organizationId: dati.orgId,
        identity: { create: { firstName: dati.firstName, lastName: dati.lastName } },
      },
    });
    if (consensiGratis.length) {
      await tx.consentRecord.createMany({
        data: consensiGratis.map((k) => ({
          userId: u.id,
          docType: k.docType,
          docVersion: k.docVersion,
          ipAddress: '127.0.0.1',
          userAgent: 'setup-test-accounts',
          language: k.language,
          metadata: k.metadata ?? undefined,
        })),
      });
    }
    return u;
  }
  const pronti: Array<{ cfg: AccountCfg; orgId: string; adminId: string }> = [];

  for (const cfg of ACCOUNTS) {
    let utente = await prisma.user.findUnique({ where: { email: cfg.email } });
    if (!utente && cfg.crea) {
      const c = cfg.crea;
      utente = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: c.orgName,
            slug: `test-${cfg.key}-demo`,
            sport: 'basketball',
            tier: c.tier,
            subscriptionTier: SUB_TIER[c.tier],
            subscriptionStatus: 'active',
            billingCycle: 'monthly',
            planLegacy: false,
            trialEndsAt: null,
          },
        });
        return creaUtente(tx as Tx, { email: cfg.email, role: 'ADMIN', orgId: org.id, firstName: c.firstName, lastName: c.lastName });
      });
      console.log(`  ✓ creato ${cfg.email} (${c.tier}, organizzazione "${c.orgName}")`);
    } else if (utente && cfg.crea) {
      // Gia' presente (secondo giro): si riallineano password e piano.
      await prisma.user.update({ where: { id: utente.id }, data: { passwordHash: gratis.passwordHash, isActive: true } });
      await prisma.organization.update({
        where: { id: utente.organizationId },
        data: {
          tier: cfg.crea.tier,
          subscriptionTier: SUB_TIER[cfg.crea.tier],
          subscriptionStatus: 'active',
          billingCycle: 'monthly',
          planLegacy: false,
          trialEndsAt: null,
          extraTeams: 0,
          extraSeats: 0,
        },
      });
      console.log(`  ✓ ritrovato ${cfg.email}: password e piano riallineati`);
    } else if (utente) {
      console.log(`  ✓ ritrovato ${cfg.email} (lasciato com'e': organizzazione e piano)`);
    }
    if (!utente) continue;

    for (const st of cfg.staff ?? []) {
      const esiste = await prisma.user.findUnique({ where: { email: st.email } });
      if (!esiste) {
        const orgId = utente.organizationId;
        await prisma.$transaction((tx) => creaUtente(tx as Tx, { ...st, orgId }));
        console.log(`    + staff ${st.email} (${st.role})`);
      } else if (esiste.organizationId === utente.organizationId) {
        await prisma.user.update({
          where: { id: esiste.id },
          data: { passwordHash: gratis.passwordHash, isActive: true, role: st.role },
        });
        console.log(`    + staff ${st.email} (${st.role}): ritrovato, password riallineata`);
      } else {
        console.log(`    ! ${st.email} esiste gia' in un'altra organizzazione: saltato`);
      }
    }

    await assicuraEsercizi(utente.organizationId);
    pronti.push({ cfg, orgId: utente.organizationId, adminId: utente.id });
  }

  // ── 4. Dati demo ───────────────────────────────────────────────────────────

  console.log('\n═══ 4. Dati demo ═══');

  /** Tabelle con organizationId che NON si svuotano. */
  const DA_TENERE = new Set(['organizations', 'users', 'exercises']);
  const tabelleOrg = (
    await prisma.$queryRawUnsafe<Array<{ t: string }>>(
      `SELECT table_name::text AS t FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'organizationId'`,
    )
  )
    .map((r) => r.t)
    .filter((t) => !DA_TENERE.has(t));

  for (const { cfg, orgId, adminId } of pronti) {
    const rng = generatore(`trainmind-test-${cfg.key}`);
    console.log(`\n  ── ${cfg.email}`);

    // Pulizia: tutto cio' che appartiene all'organizzazione, tranne utenti ed esercizi.
    const conteggi = new Map<string, number>();
    await prisma.$transaction(
      async (tx) => {
        for (const t of tabelleOrg) {
          const pk = await pkDi(tx as Tx, t);
          if (!pk) continue;
          const ids = (
            await (tx as Tx).$queryRawUnsafe<Array<{ v: string }>>(
              `SELECT "${pk}"::text AS v FROM "${t}" WHERE "organizationId" = $1`,
              orgId,
            )
          ).map((r) => r.v);
          await cancella(tx as Tx, t, pk, ids, conteggi);
        }
        // Le estensioni acquistate tornano a zero: le squadre sono nuove.
        await tx.organization.update({ where: { id: orgId }, data: { extraTeams: 0 } });
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
    if (conteggi.size) {
      console.log('     pulizia:');
      stampaConteggi(conteggi);
    }

    // Libreria esercizi per categoria, per riempire le sedute.
    const libreria = await prisma.exercise.findMany({ where: { organizationId: orgId }, select: { id: true } });

    let nomeIdx = rng.int(0, NOMI.length - 1);
    let cognomeIdx = rng.int(0, COGNOMI.length - 1);
    const totali = { atleti: 0, sedute: 0, wellness: 0, test: 0, infortuni: 0, eventi: 0 };

    for (const sq of cfg.squadre) {
      const team = await prisma.team.create({
        data: { name: sq.name, color: sq.color, description: `${sq.name} — stagione 2026/27`, organizationId: orgId },
      });

      // Atleti: prima la riga, poi l'anagrafica con athleteId esplicito (lo
      // richiede la cifratura, che lega il testo cifrato alla riga).
      const atleti: Array<{ id: string; nome: string }> = [];
      const maglie = new Set<number>();
      for (let i = 0; i < sq.size; i++) {
        const ruolo = RUOLI[i % RUOLI.length];
        const firstName = NOMI[nomeIdx++ % NOMI.length];
        const lastName = COGNOMI[cognomeIdx++ % COGNOMI.length];
        let maglia = rng.int(0, 55);
        while (maglie.has(maglia)) maglia = (maglia + 1) % 100;
        maglie.add(maglia);
        const nascita = giorno(`${rng.int(1996, 2006)}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`);
        const a = await prisma.athlete.create({
          data: {
            birthYear: nascita.getUTCFullYear(),
            position: ruolo.pos,
            height: rng.int(ruolo.h[0], ruolo.h[1]),
            weight: rng.int(ruolo.w[0], ruolo.w[1]),
            jerseyNumber: maglia,
            organizationId: orgId,
          },
        });
        await prisma.athleteIdentity.create({
          data: { athleteId: a.id, firstName, lastName, dateOfBirth: nascita },
        });
        await prisma.athleteTeam.create({ data: { athleteId: a.id, teamId: team.id } });
        atleti.push({ id: a.id, nome: `${firstName} ${lastName}` });
      }
      totali.atleti += atleti.length;

      // Test fisici: due sessioni di valutazione.
      const test = atleti.flatMap((a) =>
        DATE_TEST.flatMap((d, k) =>
          METRICHE.map((m) => {
            const base = rng.num(m.range[0], m.range[1]);
            const progresso = m.unit === 's' ? base / (1 + k * 0.015) : base * (1 + k * 0.015);
            return { athleteId: a.id, date: d, type: m.type, value: Math.round(progresso * 100) / 100, unit: m.unit };
          }),
        ),
      );
      await prisma.metric.createMany({ data: test });
      totali.test += test.length;

      // Periodizzazioni, piani, settimane e sedute (passate completate con RPE).
      for (const peri of PERIODIZZAZIONI) {
        const settimane = peri.mesocicli.reduce((s, m) => s + m.weeks, 0);
        const fine = addDays(peri.start, settimane * 7 - 1);
        const piano = await prisma.periodizationPlan.create({
          data: {
            name: peri.name, type: peri.type, startDate: peri.start, endDate: fine, totalWeeks: settimane,
            organizationId: orgId, createdById: adminId, teamId: team.id,
          },
        });
        const training = await prisma.trainingPlan.create({
          data: {
            name: `${peri.name} — ${sq.name}`, startDate: peri.start, endDate: fine,
            organizationId: orgId, createdById: adminId, teamId: team.id, periodizationPlanId: piano.id,
            trainingDays: [1, 2, 3, 4, 5],
          },
        });

        let numSett = 0;
        for (const [ordine, m] of peri.mesocicli.entries()) {
          const meso = await prisma.mesocycle.create({
            data: {
              periodizationPlanId: piano.id, orderIndex: ordine, name: m.name, phase: m.phase,
              durationWeeks: m.weeks, targetLoadPercent: m.load, color: COLORI_FASE[m.phase],
            },
          });
          for (let w = 1; w <= m.weeks; w++) {
            numSett++;
            const scarico = w === m.weeks && m.weeks >= 3;
            const progr = m.weeks >= 3 ? m.weeks - 1 : m.weeks;
            const pct = scarico ? 60 : Math.round(75 + (progr <= 1 ? 1 : (w - 1) / (progr - 1)) * 25);
            const carico = Math.round((pct * m.load) / 100);
            const nSedute = scarico ? 3 : rng.int(4, 5);
            const micro = await prisma.microcycle.create({
              data: {
                mesocycleId: meso.id, weekNumber: w, loadPercent: carico, intensity: intensita(carico),
                sessionsCount: nSedute, focusAreas: [rng.pick(['forza', 'velocità', 'agilità', 'tiro', 'tattica'])], isDeload: scarico,
              },
            });
            const settimana = await prisma.week.create({
              data: { weekNumber: numSett, trainingPlanId: training.id, microcycleId: micro.id, notes: `${m.name} — Sett. ${w}${scarico ? ' (Scarico)' : ''}` },
            });
            const lunedi = addDays(peri.start, (numSett - 1) * 7);
            for (let s = 0; s < nSedute; s++) {
              const data = new Date(addDays(lunedi, s).getTime() + 17 * 3600_000); // ore 17
              const tipo = rng.pick(TIPI_SEDUTA);
              const passata = data < OGGI;
              const seduta = await prisma.trainingSession.create({
                data: {
                  title: `${tipo} — ${m.name}`,
                  date: data,
                  duration: scarico ? rng.int(45, 60) : rng.int(60, 105),
                  status: passata ? 'COMPLETED' : 'PLANNED',
                  rpe: passata ? (scarico ? rng.int(3, 5) : rng.int(5, 8)) : null,
                  notes: `Carico ${carico}% · ${intensita(carico)}`,
                  weekId: settimana.id,
                  organizationId: orgId,
                },
              });
              totali.sedute++;
              if (libreria.length) {
                const scelti = new Set<string>();
                const quanti = rng.int(3, 5);
                while (scelti.size < Math.min(quanti, libreria.length)) scelti.add(rng.pick(libreria).id);
                await prisma.sessionExercise.createMany({
                  data: [...scelti].map((exerciseId, orderIndex) => ({
                    trainingSessionId: seduta.id, exerciseId, orderIndex,
                    sets: rng.int(2, 5), reps: String(rng.int(6, 12)), restTime: rng.int(60, 150),
                  })),
                });
              }
            }
          }
        }
      }

      // Due sedute individuali extra negli ultimi giorni al primo atleta:
      // senza, tutti hanno lo stesso carico e "Atleti a rischio" resta vuoto.
      for (const [giorniFa, rpe, min] of [[1, 9, 80], [3, 8, 75], [5, 9, 70]] as const) {
        await prisma.trainingSession.create({
          data: {
            title: 'Lavoro individuale extra', date: addDays(OGGI, -giorniFa), duration: min, status: 'COMPLETED',
            rpe, notes: 'Seduta individuale oltre il programma di squadra.', athleteId: atleti[0].id, organizationId: orgId,
          },
        });
        totali.sedute++;
      }

      // Wellness dall'inizio della stagione a oggi. Scala 1-5, 5 = condizione migliore su tutte le voci.
      const wellness: Array<{
        athleteId: string; date: Date; sleepHours: number; sleepQuality: number; fatigue: number;
        soreness: number; stress: number; mood: number; notes: string | null; submittedBy: string;
      }> = [];
      const giorniStagione = Math.floor((OGGI.getTime() - INIZIO_STAGIONE.getTime()) / GIORNO);
      for (const [idx, a] of atleti.entries()) {
        const base = { sonno: rng.num(6.5, 8.5), qual: rng.int(3, 4), fat: rng.int(3, 4), dol: rng.int(3, 4), str: rng.int(3, 4), umore: rng.int(3, 4) };
        // Il secondo atleta ha l'ultima settimana storta: alert e semafori da vedere.
        const inCalo = idx === 1;
        for (let d = 0; d <= giorniStagione; d++) {
          const data = addDays(INIZIO_STAGIONE, d);
          if (rng.next() < 0.08) continue; // qualche giorno non compilato
          const recente = giorniStagione - d < 6;
          const male = (inCalo && recente) || rng.next() < 0.08;
          const giornoSett = data.getUTCDay();
          const fineSett = giornoSett === 4 || giornoSett === 5 ? -1 : 0; // fine settimana di lavoro piu' pesante
          wellness.push({
            athleteId: a.id,
            date: new Date(`${data.toISOString().slice(0, 10)}T07:00:00.000Z`),
            sleepHours: clamp(base.sonno + rng.num(-1, 1) - (male ? 1.5 : 0), 4, 10),
            sleepQuality: clamp(base.qual + rng.int(-1, 1) - (male ? 1 : 0), 1, 5),
            fatigue: clamp(base.fat + fineSett + rng.int(-1, 1) - (male ? 2 : 0), 1, 5),
            soreness: clamp(base.dol + fineSett + rng.int(-1, 1) - (male ? 2 : 0), 1, 5),
            stress: clamp(base.str + rng.int(-1, 1) - (male ? 1 : 0), 1, 5),
            mood: clamp(base.umore + rng.int(-1, 1) - (male ? 1 : 0), 1, 5),
            notes: male ? rng.pick(['Dormito male', 'Gambe pesanti', 'Dolore al polpaccio', 'Stanco dopo il viaggio', 'Raffreddore']) : null,
            submittedBy: 'athlete',
          });
        }
      }
      for (let i = 0; i < wellness.length; i += 500) {
        await prisma.wellnessLog.createMany({ data: wellness.slice(i, i + 500), skipDuplicates: true });
      }
      totali.wellness += wellness.length;

      // Infortuni: uno risolto, uno in corso con protocollo RTP.
      const infortuni = [
        {
          a: atleti[3], type: 'ligament', onset: 'traumatic', location: 'ankle_r', severity: 2,
          occurred: giorno('2026-08-28'), resolved: giorno('2026-09-19'), fase: 'CLEARED' as const,
          notes: 'Distorsione in ricaduta da rimbalzo. Tutore per 10 giorni, ripresa graduale.',
        },
        {
          a: atleti[Math.min(7, atleti.length - 1)], type: 'tendon', onset: 'overuse', location: 'knee_r', severity: 2,
          occurred: addDays(OGGI, -14), resolved: null, fase: 'PHASE_3' as const,
          notes: 'Tendinopatia rotulea da sovraccarico. Gestione del carico e rinforzo eccentrico.',
        },
      ];
      for (const inf of infortuni) {
        const injury = await prisma.injury.create({
          data: {
            athleteId: inf.a.id, type: inf.type, onset: inf.onset, location: inf.location, severity: inf.severity,
            status: inf.resolved ? 'RESOLVED' : 'RECOVERING', dateOccurred: inf.occurred, dateResolved: inf.resolved, notes: inf.notes,
          },
        });
        const inizio = addDays(inf.occurred, 2);
        const obiettivo = inf.resolved ?? addDays(inf.occurred, 40);
        const protocollo = await prisma.rTPProtocol.create({
          data: {
            injuryId: injury.id, athleteId: inf.a.id, currentPhase: inf.fase, startDate: inizio, targetDate: obiettivo,
            notes: `Protocollo RTP — ${inf.type} ${inf.location}`,
          },
        });
        const raggiunta = ORDINE_FASI.indexOf(inf.fase);
        const durata = Math.max(7, Math.floor((Math.min(obiettivo.getTime(), OGGI.getTime()) - inizio.getTime()) / GIORNO));
        for (let i = 0; i < raggiunta && i < ORDINE_FASI.length - 1; i++) {
          await prisma.rTPPhaseLog.create({
            data: {
              rtpProtocolId: protocollo.id, fromPhase: ORDINE_FASI[i], toPhase: ORDINE_FASI[i + 1], changedById: adminId,
              reason: `Criteri fase ${i + 1} soddisfatti`, createdAt: addDays(inizio, Math.round(((i + 1) / raggiunta) * durata * 0.9)),
            },
          });
        }
        for (let p = 0; p < 5; p++) {
          const fase = ORDINE_FASI[p] as 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4' | 'PHASE_5';
          const fatto = p < raggiunta;
          for (const description of CRITERI_RTP[fase]) {
            await prisma.clearanceCriteria.create({
              data: {
                rtpProtocolId: protocollo.id, phase: fase, description, isMet: fatto,
                metAt: fatto ? addDays(inizio, Math.round(((p + 1) / Math.max(1, raggiunta)) * durata * 0.9)) : null,
                metById: fatto ? adminId : null,
              },
            });
          }
        }
        totali.infortuni++;
      }

      // Calendario: una partita giocata e due in programma (sabato ore 18).
      const sabato = (d: Date) => addDays(d, (6 - d.getUTCDay() + 7) % 7);
      const prossimo = sabato(OGGI);
      const partite = [addDays(prossimo, -7), prossimo, addDays(prossimo, 7)];
      for (const [k, g] of partite.entries()) {
        const inizio = new Date(`${g.toISOString().slice(0, 10)}T16:00:00.000Z`);
        const casa = k % 2 === 0;
        const avversario = rng.pick(AVVERSARI);
        await prisma.calendarEvent.create({
          data: {
            title: casa ? `${sq.name} vs ${avversario}` : `${avversario} vs ${sq.name}`,
            startTime: inizio, endTime: new Date(inizio.getTime() + 2 * 3600_000), type: 'match',
            opponent: avversario, isHome: casa, venue: casa ? 'Palazzetto di casa' : `Palestra ${avversario}`,
            userId: adminId, organizationId: orgId, teamId: team.id,
          },
        });
        totali.eventi++;
      }
    }

    console.log(
      `     ${cfg.squadre.length} squadr${cfg.squadre.length === 1 ? 'a' : 'e'} · ${totali.atleti} atleti · ${totali.sedute} sedute · ` +
        `${totali.wellness} wellness · ${totali.test} test · ${totali.infortuni} infortuni · ${totali.eventi} partite`,
    );
  }

  // ── Riepilogo ──────────────────────────────────────────────────────────────

  console.log('\n═══ Account dopo lo script ═══');
  stampaElenco(await elenca());
  console.log('\nPassword: la stessa di test_gratis@demo.com per tutti gli account di prova.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Script interrotto:', e instanceof Error ? e.message : e);
  process.exit(1);
});
