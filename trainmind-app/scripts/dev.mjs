/* ============================================================
   TrainMind — avvio dell'ambiente di sviluppo completo
   ------------------------------------------------------------
   `pnpm dev` non lancia piu' solo il monorepo: parte anche il
   sito vetrina LAB21, che vive in un repository separato
   (../webpage_LAB21) ed e' il punto di ingresso del percorso
   utente:

       LAB21  :5173  ──"Scopri di piu'"──▶  TrainMind :3000
                                             (landing → login / registrazione)

   Perche' uno script e non il workspace pnpm: LAB21 sta fuori
   dalla cartella di trainmind-app e pnpm non accetta pattern di
   workspace che escono dalla root ("../webpage_LAB21" non e'
   valido in pnpm-workspace.yaml). Questo script fa la stessa
   cosa — un comando solo, due processi in parallelo — senza
   toccare le dipendenze dei due progetti, che restano separate
   (LAB21 usa npm, il monorepo pnpm).

   Comandi utili:
     pnpm dev            monorepo + LAB21
     pnpm dev:apps       solo il monorepo (web, api, ai-service)
     LAB21=0 pnpm dev    monorepo, saltando LAB21 per questa volta

   Se la cartella di LAB21 e' altrove, si indica con LAB21_DIR.
   ============================================================ */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* Dove sta il sito LAB21. Di default e' la cartella sorella di
   trainmind-app: sovrascrivibile con LAB21_DIR per chi tiene i
   due progetti in posti diversi. */
const lab21Dir = process.env.LAB21_DIR
  ? resolve(process.env.LAB21_DIR)
  : resolve(root, '..', 'webpage_LAB21')

/* LAB21=0 salta la vetrina: utile quando si lavora solo sull'app. */
const wantLab21 = process.env.LAB21 !== '0' && process.env.LAB21 !== 'false'

const children = []

/**
 * Avvia un processo figlio e ne prefissa l'output, cosi' nel
 * terminale si capisce sempre chi sta parlando.
 * shell: true serve su Windows, dove pnpm e npm sono file .cmd.
 */
function run(label, command, cwd) {
  const child = spawn(command, { cwd, shell: true, stdio: ['inherit', 'pipe', 'pipe'] })
  const prefix = (chunk, stream) => {
    const text = chunk.toString()
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() !== '') stream.write(`[${label}] ${line}\n`)
    }
  }
  child.stdout.on('data', (c) => prefix(c, process.stdout))
  child.stderr.on('data', (c) => prefix(c, process.stderr))
  child.on('exit', (code, signal) => {
    // Se un pezzo muore da solo, si ferma tutto: meglio accorgersene
    // subito che restare con meta' ambiente in piedi.
    if (!shuttingDown) {
      console.log(`[${label}] terminato (${signal ?? code}). Chiudo il resto.`)
      stopAll()
    }
  })
  children.push({ label, child })
  return child
}

let shuttingDown = false
function stopAll(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const { child } of children) {
    if (child.exitCode === null) {
      // Su Windows kill() non abbatte l'albero dei processi: taskkill si'.
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' })
      } else {
        child.kill('SIGTERM')
      }
    }
  }
  setTimeout(() => process.exit(code), 500)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

/* ── monorepo: web (3000), api (3001), ai-service ── */
run('trainmind', 'pnpm run dev:apps', root)

/* ── vetrina LAB21 (5173) ── */
if (wantLab21) {
  if (!existsSync(resolve(lab21Dir, 'package.json'))) {
    console.log(`[lab21] cartella non trovata in ${lab21Dir} — parte solo il monorepo.`)
    console.log('[lab21] indica il percorso con LAB21_DIR se il sito sta altrove.')
  } else if (!existsSync(resolve(lab21Dir, 'node_modules'))) {
    console.log(`[lab21] dipendenze non installate: esegui "npm install" in ${lab21Dir}.`)
  } else {
    console.log(`[lab21] avvio da ${lab21Dir}`)
    run('lab21', 'npm run dev', lab21Dir)
  }
} else {
  console.log('[lab21] saltato (LAB21=0).')
}
