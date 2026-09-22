/**
 * Cifratura delle anagrafiche atleti
 * ===================================
 *
 * AES-256-GCM sulle cinque colonne di `athlete_identities`. Vedi
 * documentation/PIANO_CIFRATURA_VAULT.md.
 *
 * Formato del valore memorizzato:
 *
 *     v1:<base64( nonce(12) || ciphertext || tag(16) )>
 *
 * Il prefisso fa due lavori. Distingue le versioni della chiave, così una
 * rotazione futura diventa manutenzione invece che migration; e soprattutto
 * distingue il cifrato dal chiaro, il che rende gratuita la fase di doppia
 * lettura: un valore senza prefisso e' testo non ancora migrato e viene
 * restituito com'e'.
 *
 * L'AAD e' l'identificativo della riga (`athleteId`). Lega il testo cifrato
 * alla sua riga: chi ha accesso in scrittura al database non puo' scambiare
 * l'anagrafica di un atleta con quella di un altro senza conoscere la chiave.
 *
 * NOTA: questo modulo non conosce Prisma e non importa niente da lui. Serve a
 * poterlo testare da solo, e a non creare un ciclo con il client che lo usa.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const PREFISSO_V1 = 'v1:';
const ALGORITMO = 'aes-256-gcm';
const BYTE_NONCE = 12;
const BYTE_TAG = 16;
const BYTE_CHIAVE = 32;

let chiaveCorrente: Buffer | null = null;

/** Errore dedicato: chi chiama deve poterlo distinguere da un guasto generico. */
export class ErroreCifratura extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreCifratura';
  }
}

/**
 * Converte la chiave da base64 a byte, con le tolleranze che servono e i
 * controlli che non si possono saltare.
 *
 * Il `trim()` non e' cosmetico: `openssl rand -base64 32 > file` lascia un a
 * capo finale, e una copia rincollata senza quell'a capo produrrebbe una
 * chiave diversa. Normalizzare qui rende le due forme equivalenti.
 */
export function chiaveDaBase64(valore: string): Buffer {
  const pulito = (valore ?? '').trim();
  if (!pulito) throw new ErroreCifratura('chiave vuota');

  let byte: Buffer;
  try {
    byte = Buffer.from(pulito, 'base64');
  } catch {
    throw new ErroreCifratura('chiave non decodificabile da base64');
  }
  if (byte.length !== BYTE_CHIAVE) {
    throw new ErroreCifratura(
      `chiave di ${byte.length} byte, ne servono ${BYTE_CHIAVE}: il file e' troncato o non e' una chiave`,
    );
  }
  return byte;
}

/** Legge la chiave dal file indicato. Qualunque problema e' un errore, mai un avviso. */
export function chiaveDaFile(percorso: string): Buffer {
  let contenuto: string;
  try {
    contenuto = readFileSync(percorso, 'utf8');
  } catch (e) {
    throw new ErroreCifratura(`chiave non leggibile in ${percorso}: ${(e as Error).message}`);
  }
  return chiaveDaBase64(contenuto);
}

/**
 * Impronta della chiave: primi 16 caratteri dello sha256.
 *
 * Non rivela la chiave e permette di verificare, a colpo d'occhio e nei log,
 * che quella caricata sia quella attesa. Va annotata accanto a ogni copia.
 */
export function impronta(chiave: Buffer = richiediChiave()): string {
  return createHash('sha256').update(chiave).digest('hex').slice(0, 16);
}

export function inizializzaCifratura(chiave: Buffer): void {
  if (chiave.length !== BYTE_CHIAVE) throw new ErroreCifratura('chiave di lunghezza errata');
  chiaveCorrente = chiave;
}

/** Solo per i test: rimette il modulo nello stato iniziale. */
export function azzeraCifratura(): void {
  chiaveCorrente = null;
}

function richiediChiave(): Buffer {
  if (!chiaveCorrente) {
    throw new ErroreCifratura(
      'cifratura non inizializzata: nessuna chiave caricata. ' +
        "L'applicazione non deve partire in questo stato.",
    );
  }
  return chiaveCorrente;
}

/** Un valore gia' cifrato si riconosce dal prefisso. */
export function eCifrato(valore: unknown): boolean {
  return typeof valore === 'string' && valore.startsWith(PREFISSO_V1);
}

/**
 * Cifra un valore. `null` e `undefined` passano indenni: email e foto sono
 * colonne facoltative e devono poter restare vuote.
 *
 * Un valore gia' cifrato viene restituito com'e': cifrare due volte
 * produrrebbe un dato che nessuno sa piu' leggere.
 */
export function cifra<T extends string | null | undefined>(valore: T, aad: string): T {
  if (valore === null || valore === undefined) return valore;
  if (eCifrato(valore)) return valore;
  if (!aad) throw new ErroreCifratura('AAD mancante: il cifrato non sarebbe legato alla sua riga');

  const chiave = richiediChiave();
  const nonce = randomBytes(BYTE_NONCE);
  const cifratore = createCipheriv(ALGORITMO, chiave, nonce);
  cifratore.setAAD(Buffer.from(aad, 'utf8'));

  const corpo = Buffer.concat([cifratore.update(valore, 'utf8'), cifratore.final()]);
  const tag = cifratore.getAuthTag();

  return (PREFISSO_V1 + Buffer.concat([nonce, corpo, tag]).toString('base64')) as T;
}

/**
 * Decifra un valore.
 *
 * Un valore SENZA prefisso viene restituito tale e quale: e' testo in chiaro
 * non ancora migrato, ed e' quello che rende possibile la fase di doppia
 * lettura senza colonne di servizio.
 *
 * Un valore CON prefisso che non si decifra e' invece un errore, sempre:
 * significa chiave sbagliata o dato manomesso, e restituire una stringa vuota
 * mascherebbe un guasto grave dietro una schermata che sembra funzionare.
 */
export function decifra<T extends string | null | undefined>(valore: T, aad: string): T {
  if (valore === null || valore === undefined) return valore;
  if (!eCifrato(valore)) return valore;

  const chiave = richiediChiave();
  const grezzo = Buffer.from(valore.slice(PREFISSO_V1.length), 'base64');

  if (grezzo.length < BYTE_NONCE + BYTE_TAG) {
    throw new ErroreCifratura('valore cifrato troppo corto: dato troncato');
  }

  const nonce = grezzo.subarray(0, BYTE_NONCE);
  const tag = grezzo.subarray(grezzo.length - BYTE_TAG);
  const corpo = grezzo.subarray(BYTE_NONCE, grezzo.length - BYTE_TAG);

  try {
    const decifratore = createDecifratore(chiave, nonce, tag, aad);
    return (decifratore.update(corpo, undefined, 'utf8') + decifratore.final('utf8')) as T;
  } catch {
    throw new ErroreCifratura(
      `decifratura fallita (impronta chiave in uso: ${impronta(chiave)}). ` +
        'Chiave errata, oppure dato manomesso o appartenente a un altra riga.',
    );
  }
}

function createDecifratore(chiave: Buffer, nonce: Buffer, tag: Buffer, aad: string) {
  const d = createDecipheriv(ALGORITMO, chiave, nonce);
  d.setAAD(Buffer.from(aad, 'utf8'));
  d.setAuthTag(tag);
  return d;
}

/**
 * Canarino: verifica che la chiave caricata sia quella con cui e' stato
 * cifrato un valore noto. Serve all'avvio dell'applicazione per trasformare
 * "chiave sbagliata" da corruzione silenziosa in guasto immediato.
 */
export function verificaCanarino(canarinoCifrato: string, atteso: string, aad: string): boolean {
  const ottenuto = decifra(canarinoCifrato, aad);
  if (typeof ottenuto !== 'string') return false;
  const a = Buffer.from(ottenuto, 'utf8');
  const b = Buffer.from(atteso, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
