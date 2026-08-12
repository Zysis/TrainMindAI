# Passaggio a dominio unico: LAB21 alla radice, TrainMind sotto `/app`

Fino a oggi ogni pezzo aveva il suo sottodominio: `app.` per la web app, `api.`
per le API, `atleti.` per la PWA degli atleti. Il nuovo assetto mette il sito
vetrina LAB21 alla radice del dominio principale e sposta TrainMind in un
sottopercorso, così il percorso utente resta su un indirizzo solo:

```
tuodominio.com/            sito vetrina LAB21
     └─ "Scopri di più" ──▶ tuodominio.com/app     landing TrainMind → login / registrazione
api.tuodominio.com         API                     (invariato)
atleti.tuodominio.com      PWA atleti              (invariato)
app.tuodominio.com         301 → tuodominio.com/app
```

**Niente di tutto questo è attivo finché non si valorizzano le variabili nel
`.env.deploy`.** In sviluppo `NEXT_PUBLIC_BASE_PATH` resta vuota e l'app
continua a stare alla radice di `localhost:3000`, esattamente come prima.

## Le variabili

Nel `.env.deploy` (esempio aggiornato in `.env.deploy.example`):

| Variabile            | Valore                | A cosa serve                                                    |
| -------------------- | --------------------- | --------------------------------------------------------------- |
| `SITE_DOMAIN`        | `tuodominio.com`      | Dominio principale: vetrina alla radice, app nel sottopercorso   |
| `APP_BASE_PATH`      | `/app`                | Il sottopercorso. Cambiandolo vanno ricostruiti `web` e `lab21`  |
| `APP_DOMAIN`         | `app.tuodominio.com`  | Vecchio indirizzo, ora solo redirect                             |
| `VITE_TRAINMIND_URL` | vuota                 | Solo se TrainMind finisce su un dominio diverso da `SITE_DOMAIN` |

`SITE_DOMAIN` è una variabile a sé perché il nome del prodotto può cambiare:
al trasloco si aggiorna qui e si rifà la build, senza toccare il Caddyfile.

## Cosa è stato modificato

**`apps/web` — l'app deve sapere di stare in un sottopercorso**

- `next.config.mjs`: `basePath` e `assetPrefix` letti da `NEXT_PUBLIC_BASE_PATH`.
  Coprono rotte, `<Link>` e i file in `/_next`.
- `src/lib/base-path.ts`: helper `withBasePath()` per tutto ciò che Next **non**
  prefissa da solo, cioè i riferimenti scritti a mano ai file di `public/`.
- `src/app/manifest.ts`: il manifest della PWA ora è generato, non più servito
  da `public/manifest.json` (rimosso). Conteneva percorsi assoluti — `start_url`,
  `scope`, icone — che sotto `/app` sarebbero stati tutti sbagliati e avrebbero
  fatto fallire l'installazione della PWA senza un messaggio d'errore chiaro.
  L'indirizzo passa da `/manifest.json` a `/manifest.webmanifest`.
- `public/sw.js` e `public/offline.html`: sono file statici che non passano dal
  bundler, quindi non possono leggere la variabile. Ricavano il prefisso dal
  proprio indirizzo. La versione della cache del service worker è passata a `v2`
  per costringere i client a rifare la cache con i percorsi nuovi.
- `src/hooks/use-pwa.ts`: registra il service worker con file e scope prefissati.
- `src/middleware.ts`: nel matcher `manifest.json` diventa `manifest.webmanifest`.

**Infrastruttura**

- `infra/Caddyfile`: `SITE_DOMAIN` serve LAB21 alla radice e inoltra
  `{$APP_BASE_PATH}` al container web; `APP_DOMAIN` fa un 301 conservando il
  percorso, così i link di reset password già spediti restano validi.
- `docker-compose.deploy.yml`: nuovo servizio `lab21`; `NEXT_PUBLIC_BASE_PATH`
  fra i build arg di `web`; `CORS_ORIGIN` e `APP_PUBLIC_URL` dell'API aggiornati;
  healthcheck di `web` puntato al sottopercorso (alla radice risponderebbe 404 e
  il container risulterebbe sempre malato).
- `webpage_LAB21/Dockerfile`: build Vite servita da Caddy statico.

## Come si passa al nuovo assetto

1. Puntare il record A di `SITE_DOMAIN` all'IP del VPS. Lasciare in piedi anche
   quello di `APP_DOMAIN`: serve al redirect.
2. Compilare le nuove variabili nel `.env.deploy`.
3. Ricostruire e riavviare:

   ```bash
   docker compose -f docker-compose.deploy.yml --env-file .env.deploy build web lab21
   docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d
   ```

   `web` va ricostruita, non solo riavviata: il sottopercorso viene incastonato
   nel bundle al momento della build.

### Da controllare dopo il passaggio

- `tuodominio.com/` mostra LAB21 e "Scopri di più" apre `tuodominio.com/app`.
- `app.tuodominio.com/dashboard` reindirizza a `tuodominio.com/app/dashboard`.
- Login, logout e reset password: il link nell'email deve contenere `/app`.
- PWA: `tuodominio.com/app/manifest.webmanifest` risponde 200 e i percorsi delle
  icone al suo interno iniziano con `/app`.
- Chi aveva già installato la PWA dal vecchio indirizzo deve reinstallarla: lo
  scope del service worker è cambiato e la vecchia registrazione resta legata a
  `app.tuodominio.com`.

## Quando cambierà il dominio

Servirà: aggiornare `SITE_DOMAIN`, verificare il nuovo dominio su Resend e
aggiornare `AUTH_FROM_EMAIL` / `REPORT_FROM_EMAIL`, rifare la build di `web` e
`lab21`, e tenere il vecchio dominio puntato al VPS con un redirect finché i
link in circolazione non si esauriscono.
