/* Controlli sull'animazione a particelle dell'hero.
   Non serve un browser vero: DOM e canvas sono simulati, i fotogrammi
   vengono richiesti a mano con un orologio finto. */
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

// Node non importa i .json come fa Vite: il modulo viene impacchettato
// con esbuild (già presente fra le dipendenze di Vite) e poi caricato.
const BUNDLE = 'node_modules/.tmp-hero-morph.mjs'
execFileSync('node_modules/.bin/esbuild',
  ['src/js/hero-morph.js', '--bundle', '--format=esm', '--outfile=' + BUNDLE],
  { stdio: 'pipe' })

const html = fs.readFileSync('dist/index.html', 'utf8')
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true })
const { window } = dom

// --- finto contesto 2D: registra i rettangoli disegnati -------------------
let disegnati = []
let alphaCorrente = 1
const ctx = {
  setTransform() {}, translate() {}, scale() {}, clearRect() { disegnati = [] },
  set globalAlpha(v) { alphaCorrente = v }, get globalAlpha() { return alphaCorrente },
  fillStyle: '',
  fillRect(x, y, w, h) { disegnati.push({ x, y, w, h, a: alphaCorrente }) }
}
window.HTMLCanvasElement.prototype.getContext = () => ctx
window.ResizeObserver = class { observe() {} disconnect() {} }
window.matchMedia = () => ({ matches: false, addEventListener() {} })
window.Element.prototype.getBoundingClientRect = function () {
  return { width: 1600, height: 900, top: 0, left: 0, right: 1600, bottom: 900 }
}

// --- orologio e fotogrammi guidati a mano --------------------------------
let adesso = 0
let prossimo = null
window.performance.now = () => adesso
window.requestAnimationFrame = (cb) => { prossimo = cb; return 1 }
window.devicePixelRatio = 1

globalThis.window = window
globalThis.document = window.document
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.performance = window.performance
globalThis.requestAnimationFrame = window.requestAnimationFrame
globalThis.matchMedia = window.matchMedia
globalThis.ResizeObserver = window.ResizeObserver
globalThis.devicePixelRatio = 1
globalThis.getComputedStyle = window.getComputedStyle.bind(window)

const { initHeroMorph } = await import('./' + BUNDLE)
initHeroMorph()

const media = document.querySelector('.hero-media')
const imgA = media.querySelector('img:not(.alt)')
const imgB = media.querySelector('img.alt')

/** Porta l'animazione al secondo indicato e restituisce lo stato. */
function frame(secondi) {
  adesso = secondi * 1000
  const cb = prossimo; prossimo = null
  cb(adesso)
  return {
    a: parseFloat(imgA.style.opacity), b: parseFloat(imgB.style.opacity),
    punti: disegnati.slice()
  }
}

let fail = 0
const check = (nome, cond, extra = '') => {
  if (!cond) fail++
  console.log((cond ? '✓' : '✗') + ' ' + nome + (extra ? '  → ' + extra : ''))
}

// tempi presi da FASI in hero-morph.js:
// fermoA 0-4.5 | esceA 4.5-5.6 | vaiAB 5.6-10.8 | entraB 10.8-11.9
// fermoB 11.9-16.4 | esceB 16.4-17.5 | vaiBA 17.5-22.7 | entraA 22.7-23.8
const CICLO = 23.8
const N = JSON.parse(fs.readFileSync('src/data/hero-points.json', 'utf8')).n

// 1. immagine 1 ferma e sola, niente particelle
let s = frame(2)
check('fase 1: si vede solo hero3', s.a === 1 && s.b === 0)
check('fase 1: nessuna particella disegnata', s.punti.length === 0, s.punti.length + ' punti')

// 2. le linee svaniscono e compaiono i punti
s = frame(5.1)
check('fase 2: hero3 sta sparendo', s.a > 0 && s.a < 1, 'opacita ' + s.a.toFixed(2))
check('fase 2: i punti sono comparsi', s.punti.length === N * 2, s.punti.length + ' rettangoli')

// 3. morphing: le due immagini sono entrambe invisibili
const inizio = frame(5.9).punti.map(p => ({ x: p.x, y: p.y }))
s = frame(8.2)
check('fase 3: nessuna immagine visibile durante il morphing', s.a === 0 && s.b === 0)
const meta = s.punti.map(p => ({ x: p.x, y: p.y }))
const fine = frame(10.5).punti.map(p => ({ x: p.x, y: p.y }))
const spostati = meta.filter((p, i) => Math.hypot(p.x - inizio[i].x, p.y - inizio[i].y) > 4).length
check('fase 3: i punti si stanno muovendo', spostati > N, spostati + ' punti spostati')
const arrivati = fine.filter((p, i) => Math.hypot(p.x - meta[i].x, p.y - meta[i].y) > 2).length
check('fase 3: il movimento prosegue fino alla fine', arrivati > N, arrivati + ' punti')

// 4. immagine 2 ferma e sola
s = frame(14)
check('fase 4: si vede solo hero4', s.b === 1 && s.a === 0)
check('fase 4: nessuna particella', s.punti.length === 0)

// 5. ritorno: i punti tornano sulla maglia e ricompare hero3
s = frame(17.1)
check('fase 5: ripartono i punti dalla sfera', s.punti.length === N * 2)
s = frame(23.4)
check('fase 6: hero3 sta tornando', s.a > 0 && s.b === 0, 'opacita ' + s.a.toFixed(2))

// 6. il ciclo si richiude senza scatti
const a0 = frame(CICLO - 0.05).a
const a1 = frame(CICLO + 0.05).a
check('ciclo continuo alla chiusura', Math.abs(a1 - a0) < 0.2, `${a0.toFixed(2)} -> ${a1.toFixed(2)}`)

// 7. nessuno stacco di opacita' lungo due cicli interi.
//    A 10 ms di distanza una dissolvenza regolare cambia al massimo di ~0.03
//    (pendenza 3 su una fase da 1,1 s); un taglio netto darebbe ~1.
let prevA = null, prevB = null, salto = 0, dove = 0
for (let t = 0; t < CICLO * 2; t += 0.01) {
  const f = frame(t)
  if (prevA !== null) {
    const j = Math.max(Math.abs(f.a - prevA), Math.abs(f.b - prevB))
    if (j > salto) { salto = j; dove = t }
  }
  prevA = f.a; prevB = f.b
}
check('transizioni morbide (nessuno stacco)', salto < 0.05,
  'salto max ' + salto.toFixed(3) + ' a t=' + dove.toFixed(2) + 's')

// 8. i punti restano attorno all'inquadratura.
//    Nella tappa in cui la figura si sfalda qualche punto sconfina di poco
//    (misurato: al massimo un centinaio di pixel, e il canvas lo taglia).
//    Qui si controlla che non ci siano coordinate impossibili e che gli
//    sconfinamenti restino una minoranza: un errore vero manderebbe
//    migliaia di punti lontanissimi, o produrrebbe NaN.
const tutti = frame(8.0).punti
const impossibili = tutti.filter(p => !isFinite(p.x) || !isFinite(p.y)).length
check('nessuna coordinata impossibile', impossibili === 0, impossibili + ' NaN')
const lontani = tutti.filter(p => p.x < -160 || p.y < -160 || p.x > 1760 || p.y > 1060).length
check('punti attorno all\'inquadratura', lontani / tutti.length < 0.02,
  (100 * lontani / tutti.length).toFixed(1) + '% oltre il margine')

// 9. due passate: alone tenue + nucleo pieno
const alpha = [...new Set(tutti.map(p => p.a.toFixed(3)))]
check('due livelli di disegno (alone + nucleo)', alpha.length === 2, alpha.join(' / '))

console.log(fail === 0 ? '\nTUTTI I CONTROLLI SUPERATI' : `\n${fail} CONTROLLI FALLITI`)
process.exit(fail === 0 ? 0 : 1)
