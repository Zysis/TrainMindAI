# Sistema spese TrainMind

Tiene traccia di quanto costa mantenere online TrainMind: server, dominio, API AI,
email. Legge direttamente i PDF delle fatture, quindi non devi ricopiare niente a mano.

## Come si usa (30 secondi al mese)

1. Salvi il PDF della fattura nella sottocartella del fornitore
   (`ionos/`, `openai/`, `resend/`...). Il nome del file non conta.
2. **Doppio clic su `dashboard.bat`**: aggiorna tutto e apre la dashboard nel
   browser, con il bottone **Aggiorna ora** attivo per i giri successivi.

Se ti serve solo rigenerare i file senza aprire il browser, usa `aggiorna.bat`
(o `bash aggiorna.sh` da terminale) e poi apri `Registro-Spese.xlsx`.

Un solo comando fa tutto, in tre passi:

```
[1/3] Metriche dal VPS...          scarica utenti e costi AI dal DB di produzione
[2/3] Lettura fatture PDF...       importa solo i file nuovi
[3/3] Generazione Excel e dashboard
```

Il passo 1 **non e' bloccante**: se il VPS non e' raggiungibile o non hai la chiave
SSH a portata, lo script te lo dice e prosegue usando le metriche scaricate l'ultima
volta. Le fatture gia' importate sono riconosciute tramite hash del file, quindi
puoi rilanciare quante volte vuoi senza creare duplicati.

### Opzioni

| Comando | Cosa fa |
|---|---|
| `bash aggiorna.sh` | tutto: metriche VPS, fatture, report |
| `bash aggiorna.sh --dashboard` | come sopra, poi apre la dashboard interattiva |
| `bash aggiorna.sh --senza-metriche` | salta il collegamento SSH (piu' veloce) |
| `bash aggiorna.sh --solo-report` | rigenera solo i report, utile dopo aver modificato `config.json` |
| `bash aggiorna.sh --reimporta` | rilegge tutti i PDF da zero |

Le stesse opzioni funzionano con `aggiorna.bat` da PowerShell
(`.\aggiorna.bat --senza-metriche`) e chiamando direttamente
`python _sistema/importa.py`, che e' il motore sotto a tutti i wrapper.

## Il bottone "Aggiorna ora"

Un file HTML aperto con un doppio clic (`file://`) **non puo' eseguire programmi
sul computer**: e' una regola del browser, non un limite dello script. Un bottone
messo li' sarebbe decorativo.

Per questo `dashboard.bat` avvia un mini server locale (`_sistema/server.py`,
sola libreria standard) e apre la pagina da `http://127.0.0.1:8765`. Da li' il
bottone chiama un endpoint che rilancia `importa.py` e ricarica la pagina con i
dati nuovi. La casella "includi metriche dal VPS" decide se fare anche il giro SSH.

Il bottone funziona **solo finche' la finestra del terminale resta aperta**: e' lei
che serve la pagina. Se la chiudi, la dashboard resta consultabile con un doppio
clic, ma senza bottone — al suo posto compare il comando da lanciare.

Sulla sicurezza: il server ascolta solo su `127.0.0.1` (non e' raggiungibile dalla
rete locale ne' da internet), rifiuta richieste con un `Host` diverso da localhost,
non serve i file di `_sistema/` e blocca i path traversal. Un aggiornamento alla
volta, per non avere due import concorrenti sullo stesso file.

Se la porta 8765 e' occupata ne cerca una libera tra le 10 successive. Per fissarla:
`bash aggiorna.sh --dashboard --porta 9000`.

## Cosa c'e' dentro

```
Fatture/
├── dashboard.bat                ← LANCIA QUESTO: aggiorna e apre la dashboard
├── aggiorna.bat / aggiorna.sh   ← solo aggiornamento, senza browser
├── ionos/  openai/  resend/     ← ci metti i PDF, uno per fornitore
├── spese_manuali.csv            ← spese senza fattura PDF (bonifici, ecc.)
├── Registro-Spese.xlsx          ← generato: 9 fogli, per te e il commercialista
├── Dashboard-Spese.html         ← generato: grafici, scadenze, bottone
├── dati/
│   ├── spese.json               ← fonte di verita', generato
│   └── metriche.json            ← metriche utenti dal VPS, generato
└── _sistema/
    ├── config.json              ← fornitori, contratti, rinnovi, VPS  ← MODIFICA QUI
    ├── importa.py               ← il motore
    ├── server.py                ← server locale per il bottone Aggiorna
    └── metriche.sql             ← query metriche sul DB di produzione
```

## Aggiungere un fornitore nuovo

Apri `_sistema/config.json`:

1. Aggiungi una voce in `"fornitori"` (la chiave deve corrispondere **esattamente**
   al nome della sottocartella). Se non esiste un parser dedicato usa
   `"parser": "generico"`: proverà a estrarre i totali e segnalerà i valori da
   controllare nella colonna Note del Registro.
2. Se il costo e' ricorrente, aggiungi anche una voce in `"contratti"`: e' da li'
   che nascono le previsioni e gli avvisi di rinnovo.

## Spese senza fattura PDF

Aggiungi una riga a `spese_manuali.csv`:

```csv
data,fornitore,categoria,descrizione,numero,valuta,netto,iva,cambio
2026-09-01,Commercialista,Servizi,Consulenza trimestrale,,EUR,200,44,1
```

`cambio` = quanti EUR vale 1 unita' di quella valuta (metti `1` per gli euro).

## Metriche utenti e break-even

Il costo per utente arriva dal database di produzione, e viene aggiornato dal passo
1 di `aggiorna.sh` (o dal bottone, con la casella "includi metriche dal VPS"
spuntata): non devi fare nulla di separato. Sotto il cofano lo script si collega in
SSH al VPS ed esegue `_sistema/metriche.sql` dentro il container Postgres.

Le impostazioni stanno in `_sistema/config.json`, sezione `"vps"`. Se host, utente o
nome del database cambiano, puoi anche sovrascriverli al volo senza toccare il file:

```bash
VPS_HOST=root@31.70.77.212 DB_USER=trainmind DB_NAME=trainmind bash aggiorna.sh
```

Serve una chiave SSH gia' configurata: lo script gira in `BatchMode`, quindi non
chiede password e se non riesce a connettersi va avanti senza bloccarsi.

La query e' **solo in lettura** (nessuna scrittura sul DB) e restituisce:
organizzazioni totali e paganti, utenti attivi, atleti, e il costo AI reale del
mese preso da `ai_usage_logs.costUsd`.

Quando avrai abbonamenti attivi, valorizza `ricavo_mensile_eur` in fondo a
`metriche.sql` (c'e' il commento con l'esempio): da quel momento la dashboard
calcola margine e break-even.

## Cosa non copre

- La **previsione a 12 mesi include solo i costi fissi**. OpenAI e' a consumo e
  non e' prevedibile: lo trovi nello storico e nella quota AI del break-even,
  non nella previsione.
- Il cambio USD→EUR viene ricavato dalla fattura stessa quando disponibile
  (OpenAI riporta l'IVA anche in euro). Solo se manca si usa il valore di
  fallback in `config.json`.
- Le fatture scansionate come immagine non sono leggibili: servirebbe l'OCR.
  Lo script te lo segnala invece di importare dati sbagliati.

## Aggiornamento automatico

Un task schedulato (`spese-trainmind-mensile`) gira il **1° di ogni mese alle 9:00**:
importa le fatture nuove, segnala quelle attese che non sono arrivate e avvisa dei
rinnovi entro 45 giorni. Lo gestisci dalla sezione "Scheduled" nella sidebar.

Gira solo con l'app aperta; se il PC era spento, parte al primo avvio successivo.

## Requisiti

- Python 3.10+
- `pip install openpyxl`
- `pdftotext` (poppler). Windows: `scoop install poppler` oppure
  `winget install oschwartz10612.Poppler`. Linux: `apt install poppler-utils`.
- `ssh` nel PATH — solo per le metriche utenti. Su Windows e' incluso in
  Git for Windows e nell'OpenSSH client di Windows 10/11.
