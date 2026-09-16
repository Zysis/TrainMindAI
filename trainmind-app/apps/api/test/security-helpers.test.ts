/**
 * Revisione del 16/9/2026 — le due regole pure, senza database.
 *
 * - `assertProductionSecrets`: in produzione l'API non deve partire con un
 *   JWT_SECRET vuoto o uguale a un valore pubblico (quello di sviluppo scritto
 *   nel plugin, o il segnaposto di `.env.deploy.example`).
 * - `sameOriginOr`: gli URL di ritorno da Stripe restano sulla nostra origine.
 */

import { describe, expect, it } from 'vitest';
import { assertProductionSecrets } from '../src/app.js';
import { sameOriginOr } from '../src/routes/billing.js';

describe('assertProductionSecrets', () => {
  const strong = 'k'.repeat(48);

  it('in sviluppo e nei test non blocca nulla', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionSecrets({ NODE_ENV: 'test', JWT_SECRET: '' })).not.toThrow();
  });

  it('in produzione rifiuta un segreto mancante, vuoto o corto', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    expect(() => assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it('in produzione rifiuta i valori pubblici', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: 'dev-secret-must-be-at-least-32-chars-long' }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: 'CAMBIAMI_stringa_casuale_di_almeno_32_caratteri' }),
    ).toThrow(/JWT_SECRET/);
  });

  it('in produzione accetta un segreto vero', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: strong })).not.toThrow();
  });
});

describe('sameOriginOr', () => {
  const fallback = 'https://lab21sport.com/app/dashboard/settings?billing=success';

  it('senza richiesta usa il default', () => {
    expect(sameOriginOr(undefined, fallback)).toBe(fallback);
  });

  it('accetta un percorso sulla stessa origine', () => {
    const same = 'https://lab21sport.com/app/dashboard/billing?ok=1';
    expect(sameOriginOr(same, fallback)).toBe(same);
  });

  it('scarta un dominio esterno, un sottodominio e uno schema diverso', () => {
    expect(sameOriginOr('https://evil.example/phish', fallback)).toBe(fallback);
    expect(sameOriginOr('https://lab21sport.com.evil.example/x', fallback)).toBe(fallback);
    expect(sameOriginOr('http://lab21sport.com/app', fallback)).toBe(fallback);
    expect(sameOriginOr('javascript:alert(1)', fallback)).toBe(fallback);
  });
});
