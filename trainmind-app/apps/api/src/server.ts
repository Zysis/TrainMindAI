// Deve restare il PRIMO import: popola process.env prima che gli altri
// moduli lo leggano al momento del caricamento.
import './lib/load-env.js';

import { buildApp } from './app.js';
import { describeEmailMode } from './services/email-service.js';

const start = async () => {
  const app = await buildApp();

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`TrainMind API running on http://${host}:${port}`);
    app.log.info(`Email: ${describeEmailMode()}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
