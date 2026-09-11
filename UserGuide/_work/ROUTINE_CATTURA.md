# Routine di cattura (una lingua)

Ordine: prima i dati, poi l'interfaccia, poi le 47 schermate, in questo ordine.

## 0. Preparazione

```powershell
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm --filter @trainmind/db exec tsx prisma/traduci-dati-guida.ts <it|en|es>
```
Poi, nell'app del preparatore: **Configuración → Apariencia → Idioma** (o via DOM).

## 1. Pagine intere (37)

Per ognuna: `navigate` → `wait 8-10 s` (il banner di sincronizzazione sparisce
dopo 2,5 s) → `screenshot save_to_disk` **senza `scale`**.
Se lo screenshot va in timeout CDP, ripetere la sola chiamata.

| id | rotta / azione |
|---|---|
| A03-01, A04-01 | `/dashboard` |
| A03-02 | menù profilo in alto a destra |
| A03-03 | sidebar ridotta (pulsante "Reducir") |
| A05-02, A05-03 | `/dashboard/teams` (elenco + squadra selezionata) |
| A05-04, A06-01 | `/dashboard/athletes/<id>` — scheda e tab Metriche |
| A07-01, A07-03, A07-04 | `/dashboard/calendar` — mese, giorno, evento partita |
| A08-01 | `/dashboard/periodization` |
| A09-01 | `/dashboard/training` |
| A09-04 | `/dashboard/training/<mesociclo>` |
| A09-05 | `/dashboard/sessions/<seduta>` |
| A09-02 | `/dashboard/sessions` |
| A09-03 | `/dashboard/exercises` |
| A10-01, A10-02 | `/dashboard/field-training/<eventId>` (dal calendario, seduta di oggi) |
| A11-01 | `/dashboard/game/<eventId>` (evento partita → "Minuti partita") |
| A12-01 | `/dashboard/wellness` |
| A13-02 | `/dashboard/injuries` |
| A13-03 | infortunio → protocollo RTP |
| A13-04 | `/dashboard/injuries/protocols` |
| A13-01 | scheda dell'atleta infortunato → tab Infortuni |
| A14-01..05 | `/dashboard/analytics`, le cinque schede |
| A15-01 | `/dashboard/reports` |
| A15-02 | `/dashboard/reports/daily` |
| A15-03 | `/dashboard/reports/schedules` |
| A16-01 | `/dashboard/alerts` |
| A17-01, A17-02 | `/dashboard/chat` (vuota, poi con una domanda) |
| A17-03 | `/dashboard/adaptations` |
| A18-00, A18-01 | `/dashboard/settings` (in alto, e in fondo la lingua) |

## 2. Dialoghi (8)

Aprire il dialogo, poi eseguire `work/iso.js.txt` (`await ISO()`) e scattare.
La routine nasconde il resto della pagina, sbianca il velo e ingrandisce il
riquadro: la figura esce con il doppio dei pixel e `prepare_images.py` la
ritaglia da sola.

A05-05, A05-06, A07-02, A07-05, A08-02, A08-03, A12-02, A13-05.

## 3. App atleta (4) — viewport mobile

B21-01 (login), B22-01 (home), B23-01 (wellness), B24-01 (sessioni).

## 4. Pagine di accesso (3) — solo da sloggati

A02-01 login, A02-02 registrazione, A02-03 password dimenticata.
Lo switch di lingua è sulla pagina stessa: **tutte e tre le lingue in un solo
logout**.

## 5. Montaggio

```bash
python3 work/prepare_images.py <lang>
python3 work/build_pdf.py <lang>
```
