# TrainMind AI — Installazione su Mobile e Tablet (PWA)

Questa guida spiega come **installare TrainMind AI** come app sul tuo smartphone o tablet. La versione mobile è una **PWA (Progressive Web App)**: si installa direttamente dal browser, senza passare da App Store o Play Store, e si comporta come un'app nativa (icona sulla home, schermo intero, supporto offline).

> Requisito unico: il server TrainMind AI deve essere raggiungibile dal device (HTTPS in produzione obbligatorio per il funzionamento della PWA).

---

## Indice

1. [Avvio del server (sviluppatore)](#1-avvio-del-server-sviluppatore)
2. [Installazione su iPhone / iPad (iOS / iPadOS)](#2-installazione-su-iphone--ipad-ios--ipados)
3. [Installazione su Android (smartphone e tablet)](#3-installazione-su-android-smartphone-e-tablet)
4. [Installazione su tablet Windows / Surface](#4-installazione-su-tablet-windows--surface)
5. [Aggiornamento dell'app](#5-aggiornamento-dellapp)
6. [Disinstallazione](#6-disinstallazione)
7. [Risoluzione problemi](#7-risoluzione-problemi)

---

## 1. Avvio del server (sviluppatore)

La cartella `trainmind-mobile/` è un workspace pnpm **autonomo**. NON va inserita dentro `trainmind-app/pnpm-workspace.yaml`: se lo fai, `turbo dev` tenta di lanciare anche mobile da dentro trainmind-app e fallisce per mancanza di `node_modules`. Vedi la guida `START_HERE.md` di mobile.

Procedura corretta — due terminali separati:

```powershell
# Terminale 1 — trainmind-app (intatto)
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-app
pnpm dev

# Terminale 2 — trainmind-mobile (autonomo)
cd C:\Users\TeamDS\Documents\projects\projects\TrainMindAI\trainmind-mobile
pnpm install   # solo la prima volta
pnpm dev       # porta 3003
```

Backend `apps/api` (porta 3001) e DB sono condivisi tramite proxy `/api/v1/*` del Next.js mobile, niente CORS, niente modifiche a trainmind-app.

### 1.2 Esponi il server in HTTPS sulla rete locale

Le PWA richiedono HTTPS (eccezione: `localhost`). Per testare da device fisico via Wi-Fi:

**Opzione A — ngrok (più semplice):**
```bash
npx ngrok http 3003
# Apri sul telefono l'URL https://xxxxx.ngrok.io
```

**Opzione B — server in produzione:**
deploy su Vercel / server proprio con SSL valido. Apri l'URL pubblico dal browser del device.

---

## 2. Installazione su iPhone / iPad (iOS / iPadOS)

> Su iOS solo **Safari** può installare PWA. Chrome/Firefox per iOS **non** mostrano l'opzione "Aggiungi a Home".

1. Apri **Safari** sul device.
2. Naviga all'indirizzo dell'app (es. `https://trainmind.tuodominio.com` o `https://xxxx.ngrok.io`).
3. Effettua il login.
4. Tocca il pulsante **Condividi** ![share](https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Apple_share_icon.svg/24px-Apple_share_icon.svg.png) nella barra inferiore (quadrato con freccia verso l'alto).
5. Scorri verso il basso e tocca **"Aggiungi alla schermata Home"** (o **"Add to Home Screen"**).
6. Modifica il nome se vuoi (default: *TrainMind*) e tocca **Aggiungi** in alto a destra.
7. L'icona TrainMind appare sulla Home. Toccala per aprire in modalità **fullscreen** (senza barra Safari).

> **iPadOS 16+**: in modalità landscape l'app supporta layout tablet (sidebar 260px sempre visibile). In portrait usa il layout mobile (drawer + bottom nav).

### Note iOS

- Le notifiche push web funzionano da **iOS 16.4+** solo dopo l'installazione PWA.
- Il safe-area di iPhone con notch è gestito automaticamente.
- Il pinch-zoom è abilitato (a differenza della versione desktop) per accessibilità.

---

## 3. Installazione su Android (smartphone e tablet)

### Chrome / Edge / Brave

1. Apri **Chrome** (o un browser Chromium).
2. Naviga all'indirizzo dell'app.
3. Dopo qualche secondo Chrome mostra automaticamente il banner **"Installa app"** (icona ⊕ nella barra indirizzi).
4. Tocca **Installa** → conferma.

In alternativa: menu ⋮ → **Installa app** → **Installa**.

### Firefox per Android

1. Apri **Firefox**.
2. Naviga all'app.
3. Menu ⋮ → **Installa** (o **Aggiungi a schermata Home**).

### Samsung Internet

1. Naviga all'app.
2. Menu ☰ → **Aggiungi pagina a** → **Schermata Home** → **Installa**.

> Sull'Android l'icona TrainMind compare nel cassetto app. Lanciandola, parte in modalità standalone (senza barra Chrome). Funzionano shortcuts dal long-press dell'icona: Dashboard / Calendario / Atleti / AI Chat.

---

## 4. Installazione su tablet Windows / Surface

1. Apri **Microsoft Edge** o **Chrome**.
2. Naviga all'app.
3. Clicca l'icona **App disponibile** nella barra degli indirizzi (a destra) ⊕.
4. Conferma con **Installa**.

L'app appare nel menu Start e nella taskbar come un'app desktop autonoma.

---

## 5. Aggiornamento dell'app

L'aggiornamento è **automatico**:

- Quando rilasci una nuova versione, il **service worker** (`/sw.js`) la scarica in background.
- Al successivo avvio, l'app mostra un toast/banner di aggiornamento (componente `<PWARegister />`).
- Tocca *Aggiorna* per applicare immediatamente, oppure attendi: l'app si aggiorna automaticamente alla prossima apertura.

> Per forzare un aggiornamento immediato: chiudi completamente l'app (swipe via in iOS, swipe up in Android) e riaprila.

---

## 6. Disinstallazione

- **iOS / iPadOS**: tieni premuto l'icona → **Rimuovi app** → **Elimina app**.
- **Android**: tieni premuto l'icona → **Disinstalla** (o trascina sul cestino).
- **Windows**: Start → click destro sull'icona TrainMind → **Disinstalla**.

La disinstallazione cancella la cache locale ma **non** i dati utente sul server.

---

## 7. Risoluzione problemi

| Problema | Causa probabile | Soluzione |
|---|---|---|
| Su iPhone non vedo "Aggiungi alla Home" | Stai usando Chrome iOS | Apri lo stesso URL con **Safari** |
| Schermo bianco dopo apertura | Service worker corrotto | Disinstalla e reinstalla l'app |
| Layout desktop su tablet | Browser non è in modalità desktop, ok | Il tablet > 1024px mostra layout desktop di proposito; ruota in portrait per layout tablet |
| Pulsante hamburger non appare | Stai su tablet landscape (>=768px) | Il hamburger è solo per <768px. Il sidebar è già visibile |
| Form-input apre tastiera e zooma | Bug iOS Safari | Già gestito: tutti gli input mobile hanno `font-size: 16px` |
| Notifiche push non arrivano (iOS) | Versione iOS < 16.4 | Aggiorna iOS o usa Android |
| Bottom-nav copre il contenuto in fondo | Mancato safe-area | Verifica che la build sia con la `globals.css` aggiornata (`--bottom-nav-height`) |
| App non si installa (Android) | Manifest non valido o no HTTPS | Apri DevTools → Application → Manifest e correggi errori |

### Verifica installabilità da DevTools

1. Apri Chrome → `F12` → tab **Application**.
2. Sezione **Manifest**: nessun errore.
3. Sezione **Service Workers**: stato `activated and is running`.
4. Esegui **Lighthouse** → categoria **Progressive Web App** → punteggio ≥ 90.

---

## Riepilogo identità visiva

La trasformazione mobile **non modifica** colori, font, icone, spaziature, bordi o ombre della versione web. Variabili CSS chiave:

```css
:root {
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 72px;
  --topbar-height: 64px;
  --bottom-nav-height: 56px;   /* nuovo (solo mobile) */
}
```

Palette identica: teal `#0D3B3B`/`#14B8A6`, slate `#0F172A`/`#F8FAFC`, semantic colors invariati.

---

Per domande o problemi, apri un issue sul repository o contatta il team tecnico.
