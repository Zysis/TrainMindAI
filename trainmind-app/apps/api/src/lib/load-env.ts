/**
 * Caricamento esplicito delle variabili d'ambiente.
 *
 * Perche' serve:
 *   L'API non caricava alcun file .env. Funzionava lo stesso perche' Prisma
 *   carica per conto proprio il .env accanto al suo schema (packages/db/.env),
 *   quindi DATABASE_URL arrivava. Tutte le altre variabili definite nel .env
 *   alla radice di trainmind-app (RESEND_API_KEY, OPENAI_API_KEY, JWT_SECRET,
 *   VAPID_*, ...) venivano invece ignorate in silenzio, e il codice ripiegava
 *   sui default.
 *
 * Ordine di precedenza (dal piu' forte al piu' debole):
 *   1. Variabili gia' presenti in process.env (shell, Docker, CI)
 *   2. apps/api/.env            — configurazione specifica dell'API
 *   3. <root>/.env              — configurazione condivisa del monorepo
 *
 * dotenv NON sovrascrive variabili gia' definite, quindi l'ordine sotto
 * realizza esattamente questa precedenza. In produzione (Docker) le env
 * iniettate dal container continuano a vincere su tutto.
 *
 * IMPORTANTE: questo modulo va importato per PRIMO in server.ts, prima di
 * qualsiasi import che legga process.env al momento del caricamento.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/api/src/lib
const apiRoot = path.resolve(here, '../..'); // apps/api
const monorepoRoot = path.resolve(here, '../../../..'); // trainmind-app

config({ path: path.join(apiRoot, '.env') });
config({ path: path.join(monorepoRoot, '.env') });
