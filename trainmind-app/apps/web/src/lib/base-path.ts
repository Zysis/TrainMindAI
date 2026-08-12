/**
 * Prefisso sotto cui l'app è servita.
 *
 * In sviluppo l'app sta alla radice (`http://localhost:3000/`) e questo
 * valore è la stringa vuota: tutto continua a funzionare come prima.
 * In produzione TrainMind vive in un sottopercorso del dominio che ospita
 * il sito vetrina LAB21 (`https://dominio/app`), quindi va impostata la
 * variabile `NEXT_PUBLIC_BASE_PATH=/app`.
 *
 * Chi applica il prefisso e chi no:
 *
 *   - I `<Link>` di Next e le rotte del router lo ricevono da soli, perché
 *     `basePath` è dichiarato in `next.config.mjs`. Non toccarli.
 *   - I file dentro `public/` richiamati a mano (manifest, service worker,
 *     icone) NON lo ricevono: vanno passati da `withBasePath()`.
 *
 * È una `NEXT_PUBLIC_*`, quindi il valore viene incastonato nel bundle al
 * momento della build: cambiarlo richiede una nuova build, non basta
 * riavviare il container.
 */

/** Normalizza: nessuna barra finale, una barra iniziale se non è vuoto. */
function normalize(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.replace(/\/+$/, '');
  if (trimmed === '') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export const BASE_PATH = normalize(process.env.NEXT_PUBLIC_BASE_PATH);

/**
 * Antepone il prefisso a un percorso assoluto dell'app.
 *
 *   withBasePath('/sw.js')  →  '/sw.js'      (sviluppo)
 *                           →  '/app/sw.js'  (produzione con /app)
 */
export function withBasePath(path: string): string {
  if (!path.startsWith('/')) return `${BASE_PATH}/${path}`;
  return `${BASE_PATH}${path}`;
}
