import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Configurazione dei test della web app.
 *
 * L'alias `@` non e' un vezzo: senza, ogni file sotto test che importa
 * `@/lib/...` fallisce con "cannot find package" — Vitest non legge da solo i
 * `paths` del tsconfig.
 *
 * Ambiente `node` e non `jsdom`: i test attuali riguardano logica pura e si
 * costruiscono da soli le due proprieta' del browser che servono. Quando
 * arriveranno test su componenti React, qui si passa a `jsdom`.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
