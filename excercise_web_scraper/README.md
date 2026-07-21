# MuscleWiki Exercise Scraper

Web scraper per raccogliere tutti gli esercizi da [MuscleWiki](https://musclewiki.com/it-it/directory).

## Come funziona

1. **Sitemap** — Legge il sitemap del sito per trovare tutte le pagine di categoria muscolare
2. **Pagine categoria** — Naviga ogni categoria per estrarre i link ai singoli esercizi
3. **Pagine dettaglio** — Per ogni esercizio estrae dati strutturati (schema.org JSON-LD)
4. **Download media** — Scarica immagini (body map) e video (MP4) dimostrativi
5. **Salvataggio** — Salva tutto in SQLite + export JSON

Usa `curl_cffi` con TLS fingerprint impersonation per bypassare la protezione Cloudflare del sito.

## Dati estratti

Per ogni esercizio vengono salvati:
- **Nome** dell'esercizio
- **Descrizione** e istruzioni passo-passo
- **Gruppo muscolare** principale
- **Muscoli secondari** coinvolti
- **Attrezzatura** necessaria
- **Difficoltà**
- **Immagini** (body map PNG/JPG) e **Video** (MP4) dimostrativi
- **URL** della pagina originale

## Struttura progetto

```
excercise_web_scraper/
├── scraper.py          # Script principale
├── database.py         # Gestione database SQLite
├── requirements.txt    # Dipendenze Python
├── README.md
├── images/             # Media organizzati per gruppo muscolare
│   ├── Biceps/
│   ├── Chest/
│   └── ...
├── exercises.db        # Database SQLite (generato)
├── exercises.json      # Export JSON (generato)
└── _cache/             # Cache link per ripresa automatica (generato)
```

## Installazione

```bash
pip install -r requirements.txt
```

## Utilizzo

```bash
python scraper.py
```

Lo scraper supporta la **ripresa automatica**: se viene interrotto, al riavvio
salta la fase di raccolta link (usa la cache) e riprende dal primo esercizio
non ancora salvato nel database.

Per forzare un refresh completo, elimina la cartella `_cache/`.

## Configurazione

In `scraper.py` puoi modificare:
- `REQUEST_DELAY` — pausa tra richieste in secondi (default: 0.5)
- `MAX_RETRIES` — tentativi per ogni richiesta HTTP (default: 3)

## Output

- **SQLite**: `exercises.db` con tabelle `exercises` e `muscle_groups`
- **JSON**: `exercises.json` con tutti gli esercizi in formato strutturato
- **Media**: cartella `images/` con sottocartelle per gruppo muscolare
