# webpage_LAB21

Sito vetrina di **LAB21 — Sport Science Innovation Lab**.
Sito statico costruito con [Vite](https://vitejs.dev): HTML, CSS e JavaScript, senza framework.

## Comandi rapidi

```bash
npm install     # una volta sola, installa le dipendenze
npm run dev     # sviluppo su http://localhost:5173 (si ricarica da solo)
npm run build   # genera il sito pronto in dist/
npm run preview # controlla il risultato di build su http://localhost:4173
npm test        # controlli automatici su lingue, link e ancore
```

## Struttura

```
webpage_LAB21/
├─ index.html                 pagina principale (include i parziali)
├─ vite.config.js             config Vite + plugin per gli include HTML
├─ package.json
├─ public/                    file copiati così come sono
│  ├─ logo/                   loghi LAB21
│  └─ assets/
│     ├─ img/                 immagini (ora segnaposto)
│     └─ video/               qui va lab-reel.mp4
├─ src/
│  ├─ sections/               una sezione HTML per file
│  │  ├─ nav.html  hero.html  products.html
│  │  └─ method.html  team.html  contact.html  footer.html
│  ├─ styles/                 un CSS per componente + main.css
│  ├─ js/                     moduli JS (config, i18n, nav, reveal…)
│  └─ i18n/                   it.json / en.json / es.json — tutti i testi
└─ tools/gen-placeholders.py  rigenera le immagini segnaposto
```

## Dove mettere le mani

| Cosa cambiare | File |
|---|---|
| Testi (italiano, inglese, spagnolo) | `src/i18n/it.json`, `en.json`, `es.json` |
| Email, P.IVA, link social, Calendly, TrainMind | `src/js/config.js` |
| Colori e font | `src/styles/tokens.css` |
| Struttura di una sezione | `src/sections/<sezione>.html` |
| Foto | sostituire i file in `public/assets/img/` mantenendo i nomi |
| Video del lab | `public/assets/video/lab-reel.mp4` |
| Tempi della transizione a particelle | `src/js/hero-morph.js` (costante `FASI`) |

## Transizione a particelle dell'hero

Le due immagini dell'hero sono collegate da un morphing: le linee della maglia
svaniscono lasciando i punti d'incrocio, i punti si spostano a comporre la
sfera, e viceversa. I punti vengono estratti dalle immagini una volta sola:

```bash
python3 tools/extract-points.py     # sorgenti/hero3.jpg + hero4.jpg -> src/data/hero-points.json
python3 tools/resize-hero.py sorgenti/hero3.jpg public/assets/img/hero3
```

Il colore è `--acc`, letto dal CSS a runtime: cambiando il token cambia anche
l'animazione. Con "riduci animazioni" attivo nel sistema resta la prima
immagine, ferma.

Le lingue funzionano con l'attributo `data-i18n="chiave"` (testo semplice)
oppure `data-i18n-html="chiave"` (testo con tag HTML). La chiave deve esistere
in tutti i file JSON: `npm test` segnala eventuali chiavi mancanti o inutilizzate.

Per aggiungere una lingua: copiare `it.json` in `src/i18n/<codice>.json`, tradurre
i valori, importarlo in `src/js/i18n.js` (dentro `dict`) e aggiungere il pulsante
in `src/sections/nav.html`.
