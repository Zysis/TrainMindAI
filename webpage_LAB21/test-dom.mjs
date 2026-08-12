/* Test di verifica: carica la pagina compilata in un DOM simulato. */
import { JSDOM } from 'jsdom'
import fs from 'node:fs'

const html = fs.readFileSync('dist/index.html', 'utf8')
const bundle = fs.readFileSync('dist/' + fs.readdirSync('dist/assets').find(f => f.endsWith('.js')).replace(/^/, 'assets/'), 'utf8')

const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'dangerously' })
const { window } = dom
// Niente canvas: la pagina deve funzionare lo stesso (l'hero resta fermo
// sulla prima immagine). L'animazione ha un test suo, test-hero-morph.mjs.
window.HTMLCanvasElement.prototype.getContext = () => null
window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} }
window.eval(bundle)

const q = (s) => window.document.querySelector(s)
const nav1 = () => q('.nl a').textContent
let fail = 0
const check = (name, cond, extra = '') => { if (!cond) fail++; console.log((cond ? '✓' : '✗') + ' ' + name + (extra ? '  → ' + extra : '')) }

// Senza una scelta salvata la pagina parte in inglese, qualunque sia la
// lingua del browser (il rilevamento automatico è stato rimosso l'11/08/2026).
check('lingua iniziale: inglese', q('h1').textContent.includes('real performance'), q('h1').textContent.slice(0,30))
check('lingua iniziale: attributo lang', window.document.documentElement.lang === 'en', window.document.documentElement.lang)
q('.lang button[data-lang="it"]').click()
check('switch IT: titolo', q('h1').textContent.includes('performance reale'))
check('anno footer aggiornato', q('[data-year]').textContent === String(new Date().getFullYear()), q('[data-year]').textContent)
// il link email compare solo se in pagina c'è la sezione contatti
const mail = q('a[data-link="email"]')
if (mail) check('mailto applicato', mail.getAttribute('href').startsWith('mailto:info@lab21.it'))
const senzaHref = [...window.document.querySelectorAll('[data-link]')]
  .filter(el => !el.getAttribute('href'))
  .map(el => el.dataset.link)
check('ogni data-link ha un indirizzo', senzaHref.length === 0, [...new Set(senzaHref)].join(' '))
// "Scopri di più" porta all'app TrainMind, in una scheda nuova.
const tm = q('a[data-link="trainmind"]')
check('CTA TrainMind presente', !!tm)
if (tm) {
  check('CTA TrainMind ha un indirizzo', tm.getAttribute('href') !== '#', tm.getAttribute('href'))
  check('CTA TrainMind apre una scheda nuova', tm.getAttribute('target') === '_blank')
}
check('p.iva dal config', q('[data-text="vat"]').textContent === '00000000000')

q('.lang button[data-lang="en"]').click()
check('switch EN: titolo', q('h1').textContent.includes('real performance'))
check('switch EN: nav', nav1() === 'Products', nav1())
check('switch EN: attributo lang', window.document.documentElement.lang === 'en')
check('switch EN: bottone attivo', q('.lang button[data-lang="en"]').classList.contains('on'))
check('switch EN: showcase', q('.sc-claim').textContent.includes('designed for basketball'))

q('.lang button[data-lang="es"]').click()
check('switch ES: titolo', q('h1').textContent.includes('rendimiento real'))
check('switch ES: nav', nav1() === 'Productos', nav1())
check('switch ES: attributo lang', window.document.documentElement.lang === 'es')
check('switch ES: showcase', q('.sc-claim').textContent.includes('pensada para el baloncesto'))

q('.lang button[data-lang="it"]').click()
check('ritorno a IT', nav1() === 'Prodotti', nav1())

// tutte le lingue devono avere esattamente le stesse chiavi
const lingue = ['it', 'en', 'es']
const dizionari = Object.fromEntries(lingue.map(l => [l, JSON.parse(fs.readFileSync(`src/i18n/${l}.json`, 'utf8'))]))
const usate = [...new Set([...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map(m => m[1]))]
for (const l of lingue) {
  const mancanti = usate.filter(k => !(k in dizionari[l]))
  const inutili = Object.keys(dizionari[l]).filter(k => !usate.includes(k))
  check(`dizionario ${l}: nessuna chiave mancante`, mancanti.length === 0, mancanti.join(' '))
  check(`dizionario ${l}: nessuna chiave inutilizzata`, inutili.length === 0, inutili.join(' '))
}

let empty = 0
window.document.querySelectorAll('[data-i18n]').forEach(el => { if (!el.textContent.trim()) empty++ })
check('nessun testo vuoto', empty === 0, empty + ' vuoti')

// Il fondo nero di .hero-media.wire è indispensabile: senza, durante il
// morphing a particelle il livello verde in "multiply" non ha nulla sotto
// con cui fondersi e riempie lo schermo di verde.
const css = fs.readFileSync('dist/' + fs.readdirSync('dist/assets').find(f => f.endsWith('.css')).replace(/^/, 'assets/'), 'utf8')
check('hero wire: fondo nero presente', /\.hero-media\.wire\{[^}]*background:\s*#000/.test(css))
check('hero wire: livello verde in multiply', /mix-blend-mode:\s*multiply/.test(css))

const ancore = [...window.document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1)
const rotte = [...new Set(ancore)].filter(h => !window.document.querySelector(h))
check('ancore interne valide', rotte.length === 0, rotte.join(' '))

console.log(fail === 0 ? '\nTUTTI I CONTROLLI SUPERATI' : `\n${fail} CONTROLLI FALLITI`)
process.exit(fail === 0 ? 0 : 1)
