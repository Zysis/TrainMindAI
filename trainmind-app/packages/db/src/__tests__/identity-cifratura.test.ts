import { describe, it, expect, beforeEach } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cifra,
  decifra,
  eCifrato,
  chiaveDaBase64,
  chiaveDaFile,
  inizializzaCifratura,
  azzeraCifratura,
  impronta,
  verificaCanarino,
  ErroreCifratura,
  PREFISSO_V1,
} from '../identity-cifratura.js';

// Chiave fissa, solo per i test: 32 byte in base64.
const CHIAVE_TEST = Buffer.alloc(32, 7).toString('base64');
const ATLETA = 'cmttrxi25001f3h2p9smahv8c';

beforeEach(() => {
  azzeraCifratura();
  inizializzaCifratura(chiaveDaBase64(CHIAVE_TEST));
});

describe('andata e ritorno', () => {
  it('restituisce il valore originale', () => {
    const c = cifra('Bortolotti', ATLETA);
    expect(c).not.toBe('Bortolotti');
    expect(eCifrato(c)).toBe(true);
    expect(decifra(c, ATLETA)).toBe('Bortolotti');
  });

  it('regge accenti e caratteri non ASCII', () => {
    const nome = "Niccolò D'Ambrosio-Müller";
    expect(decifra(cifra(nome, ATLETA), ATLETA)).toBe(nome);
  });

  it('due cifrature dello stesso valore sono diverse (nonce casuale)', () => {
    expect(cifra('Rossi', ATLETA)).not.toBe(cifra('Rossi', ATLETA));
  });

  it('lascia passare null e undefined', () => {
    expect(cifra(null, ATLETA)).toBeNull();
    expect(cifra(undefined, ATLETA)).toBeUndefined();
    expect(decifra(null, ATLETA)).toBeNull();
  });

  it('non cifra due volte lo stesso valore', () => {
    const c = cifra('Rossi', ATLETA);
    expect(cifra(c, ATLETA)).toBe(c);
  });
});

describe('il dato e legato alla sua riga (AAD)', () => {
  it('non si decifra con un athleteId diverso', () => {
    const c = cifra('Bortolotti', ATLETA);
    expect(() => decifra(c, 'un-altro-atleta')).toThrow(ErroreCifratura);
  });

  it('rifiuta di cifrare senza AAD', () => {
    expect(() => cifra('Bortolotti', '')).toThrow(ErroreCifratura);
  });
});

describe('convivenza con il testo in chiaro', () => {
  it('un valore senza prefisso torna immutato: e dato non ancora migrato', () => {
    expect(decifra('Bortolotti', ATLETA)).toBe('Bortolotti');
    expect(eCifrato('Bortolotti')).toBe(false);
  });
});

describe('guasti che devono essere rumorosi', () => {
  it('un cifrato manomesso fallisce', () => {
    const c = cifra('Bortolotti', ATLETA) as string;
    const manomesso = PREFISSO_V1 + 'A' + c.slice(PREFISSO_V1.length + 1);
    expect(() => decifra(manomesso, ATLETA)).toThrow(ErroreCifratura);
  });

  it('un cifrato troncato fallisce', () => {
    expect(() => decifra(PREFISSO_V1 + 'YWJj', ATLETA)).toThrow(ErroreCifratura);
  });

  it('una chiave diversa non apre il dato', () => {
    const c = cifra('Bortolotti', ATLETA);
    inizializzaCifratura(chiaveDaBase64(Buffer.alloc(32, 9).toString('base64')));
    expect(() => decifra(c, ATLETA)).toThrow(ErroreCifratura);
  });

  it('senza chiave inizializzata non si cifra ne si decifra', () => {
    azzeraCifratura();
    expect(() => cifra('Rossi', ATLETA)).toThrow(/non inizializzata/);
    expect(() => decifra(PREFISSO_V1 + 'YWJjZGVmZ2hpamts', ATLETA)).toThrow(/non inizializzata/);
  });
});

describe('caricamento della chiave', () => {
  it("l'a capo finale non cambia la chiave", () => {
    const a = chiaveDaBase64(CHIAVE_TEST);
    const b = chiaveDaBase64(CHIAVE_TEST + '\n');
    const c = chiaveDaBase64('  ' + CHIAVE_TEST + ' \n');
    expect(impronta(a)).toBe(impronta(b));
    expect(impronta(a)).toBe(impronta(c));
  });

  it('rifiuta una chiave di lunghezza sbagliata', () => {
    expect(() => chiaveDaBase64(Buffer.alloc(16, 1).toString('base64'))).toThrow(/32/);
  });

  it('rifiuta una chiave vuota', () => {
    expect(() => chiaveDaBase64('   ')).toThrow(ErroreCifratura);
  });

  it('legge da file e ignora l a capo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chiave-'));
    const f = join(dir, 'identity.key');
    writeFileSync(f, CHIAVE_TEST + '\n');
    expect(impronta(chiaveDaFile(f))).toBe(impronta(chiaveDaBase64(CHIAVE_TEST)));
  });

  it('un file inesistente e un errore, non un silenzio', () => {
    expect(() => chiaveDaFile('/percorso/che/non/esiste')).toThrow(ErroreCifratura);
  });

  it("l'impronta e stabile e non rivela la chiave", () => {
    const i = impronta(chiaveDaBase64(CHIAVE_TEST));
    expect(i).toHaveLength(16);
    expect(i).toBe(impronta(chiaveDaBase64(CHIAVE_TEST)));
    expect(CHIAVE_TEST).not.toContain(i);
  });
});

describe('canarino di avvio', () => {
  it('conferma la chiave giusta', () => {
    const c = cifra('TRAINMIND-CANARINO', 'canarino') as string;
    expect(verificaCanarino(c, 'TRAINMIND-CANARINO', 'canarino')).toBe(true);
  });

  it('con la chiave sbagliata solleva, non restituisce false silenziosamente', () => {
    const c = cifra('TRAINMIND-CANARINO', 'canarino') as string;
    inizializzaCifratura(chiaveDaBase64(Buffer.alloc(32, 3).toString('base64')));
    expect(() => verificaCanarino(c, 'TRAINMIND-CANARINO', 'canarino')).toThrow(ErroreCifratura);
  });
});
