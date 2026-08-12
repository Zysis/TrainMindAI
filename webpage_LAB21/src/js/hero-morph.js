/* ============================================================
   LAB21 — transizione a particelle dell'hero

   Sequenza (ciclo continuo):
     1. si vede hero3 (la maglia con le linee)
     2. le linee svaniscono e restano i punti d'incrocio
     3. i punti si spostano e compongono la sfera di hero4
     4. si vede hero4 (l'immagine intera)
     5. i punti si ridistribuiscono sulla maglia
     6. si torna a hero3

   I punti sono estratti dalle due immagini da tools/extract-points.py
   e salvati in src/data/hero-points.json. Il colore è quello del sito
   (--acc), letto dal CSS: cambiando il token cambia anche l'animazione.
   ============================================================ */
import dati from '../data/hero-points.json'

// durate in secondi delle fasi, nell'ordine
const FASI = [
  ['fermoA', 4.5],   // immagine 1 ferma
  ['esceA', 1.1],    // le linee svaniscono, restano i punti
  ['vaiAB', 5.2],    // i punti attraversano le tappe fino alla sfera
  ['entraB', 1.1],   // compare l'immagine 2
  ['fermoB', 4.5],   // immagine 2 ferma
  ['esceB', 1.1],    // tornano i punti
  ['vaiBA', 5.2],    // stesso percorso, al contrario
  ['entraA', 1.1]    // ricompare l'immagine 1
]

/* Il viaggio non è una linea retta fra le due figure: passa da tre tappe.
     1. la maglia si SFALDA — ogni punto si stacca verso l'esterno
     2. i punti si raccolgono in un ANELLO attorno alla sfera
     3. l'anello si chiude sulla figura finale
   Le tappe valgono in tutte e due le direzioni, semplicemente al contrario. */
const TAPPE = [0.30, 0.62]      // dove finiscono la prima e la seconda tappa
const SFALDA = 0.085            // quanto si allontanano i punti, in frazione di schermo
const ANELLO_X = 0.34           // semiassi dell'anello, in frazione di schermo:
const ANELLO_Y = 0.40           // sta al centro dell'inquadratura, non della sfera,
                                // così non esce mai dal riquadro
const CICLO = FASI.reduce((s, f) => s + f[1], 0)

const ZOOM_MIN = 1.06, ZOOM_MAX = 1.16, ZOOM_PERIODO = 26 // secondi
const SCIA = 0.22          // sfasamento fra i punti: dà l'effetto onda
const DIM_PUNTO = 1.7      // lato del quadratino, in pixel CSS

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

/** Riquadro di disegno equivalente a object-fit:cover. */
function cover(ratio, w, h) {
  const s = Math.max(w / ratio, h)
  const dw = ratio * s, dh = s
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh }
}

export function initHeroMorph() {
  const media = document.querySelector('.hero-media')
  const canvas = media?.querySelector('.hero-fx')
  const imgA = media?.querySelector('img:not(.alt)')
  const imgB = media?.querySelector('img.alt')
  if (!media || !canvas || !imgA || !imgB) return

  // Con "riduci animazioni" attivo resta la prima immagine, ferma.
  const menoMoto = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  if (menoMoto) {
    canvas.remove(); imgB.remove()
    imgA.style.opacity = 1
    return
  }

  // Se il canvas non è disponibile resta la prima immagine, ferma.
  const ctx = canvas.getContext && canvas.getContext('2d', { alpha: true })
  if (!ctx) { canvas.remove(); imgB.remove(); imgA.style.opacity = 1; return }
  // Le coordinate sono salvate come interi per tenere il file leggero:
  // qui tornano in frazioni di immagine (0→1).
  const S = dati.scala || 1
  const n = Math.min(dati.a.p.length, dati.b.p.length)
  const A = new Float32Array(n * 2), B = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    A[i * 2] = dati.a.p[i][0] / S; A[i * 2 + 1] = dati.a.p[i][1] / S
    B[i * 2] = dati.b.p[i][0] / S; B[i * 2 + 1] = dati.b.p[i][1] / S
  }

  // ritardo di partenza di ogni punto: onda da sinistra a destra
  const ritardo = new Float32Array(n)
  for (let i = 0; i < n; i++) ritardo[i] = A[i * 2] * SCIA

  // Tappa 1: direzione in cui ogni punto si sfalda. Un po' verso l'esterno
  // rispetto al centro, un po' a caso, così il distacco non è geometrico.
  const sfx = new Float32Array(n), sfy = new Float32Array(n)
  let seme = 21
  const casuale = () => {           // generatore ripetibile: stesso effetto a ogni giro
    seme = (seme * 1103515245 + 12345) & 0x7fffffff
    return seme / 0x7fffffff
  }
  for (let i = 0; i < n; i++) {
    const dx = A[i * 2] - 0.5, dy = A[i * 2 + 1] - 0.5
    const d = Math.hypot(dx, dy) || 1
    // chi sta al centro si allarga, chi è già al bordo rientra: così la
    // nuvola respira senza che i punti escano dall'inquadratura
    const radiale = (0.30 - d) * 2.4
    const a = casuale() * Math.PI * 2, amp = 0.45 + casuale() * 0.85
    sfx[i] = (dx / d * radiale + Math.cos(a) * 0.55) * amp
    sfy[i] = (dy / d * radiale + Math.sin(a) * 0.55) * amp
  }

  // Tappa 2: l'anello. Ogni punto tiene l'angolo che ha dentro la sfera,
  // così quando l'anello si chiude ognuno arriva già dalla parte giusta.
  let cx = 0, cy = 0
  for (let i = 0; i < n; i++) { cx += B[i * 2]; cy += B[i * 2 + 1] }
  cx /= n; cy /= n
  // seno e coseno si calcolano una volta sola: con 5000 punti e 60 fotogrammi
  // al secondo, rifarli a ogni giro costerebbe più di tutto il resto
  const angCos = new Float32Array(n), angSin = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(B[i * 2 + 1] - cy, B[i * 2] - cx)
    angCos[i] = Math.cos(a); angSin[i] = Math.sin(a)
  }

  // colore del brand, preso dal CSS
  const acc = getComputedStyle(document.documentElement)
    .getPropertyValue('--acc').trim() || '#00C9A7'

  let w = 0, h = 0, dpr = 1
  const misura = () => {
    const r = media.getBoundingClientRect()
    dpr = Math.min(devicePixelRatio || 1, 2)
    w = r.width; h = r.height
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
  }
  misura()
  if (typeof ResizeObserver === 'function') new ResizeObserver(misura).observe(media)
  else addEventListener('resize', misura)

  const t0 = performance.now()

  function fase(t) {
    let acc2 = 0
    for (const [nome, dur] of FASI) {
      if (t < acc2 + dur) return [nome, (t - acc2) / dur]
      acc2 += dur
    }
    return ['fermoA', 0]
  }

  function disegna(now) {
    const tempo = (now - t0) / 1000
    const [nome, p] = fase(tempo % CICLO)

    // zoom lento condiviso da immagini e particelle
    const z = lerp(ZOOM_MIN, ZOOM_MAX,
      (1 - Math.cos((tempo / ZOOM_PERIODO) * Math.PI * 2)) / 2)
    imgA.style.transform = imgB.style.transform = `scale(${z})`

    // opacità delle due immagini e del livello particelle
    let oA = 0, oB = 0, oP = 0, m = 0, verso = 'AB'
    switch (nome) {
      case 'fermoA': oA = 1; break
      case 'esceA':  oA = 1 - easeInOut(p); oP = easeOut(p); break
      case 'vaiAB':  oP = 1; m = p; break
      case 'entraB': oB = easeInOut(p); oP = 1 - easeOut(p); m = 1; break
      case 'fermoB': oB = 1; m = 1; break
      case 'esceB':  oB = 1 - easeInOut(p); oP = easeOut(p); m = 0; verso = 'BA'; break
      case 'vaiBA':  oP = 1; m = p; verso = 'BA'; break
      case 'entraA': oA = easeInOut(p); oP = 1 - easeOut(p); m = 1; verso = 'BA'; break
    }
    imgA.style.opacity = oA
    imgB.style.opacity = oB

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (oP <= 0.001) { requestAnimationFrame(disegna); return }

    // stesso zoom delle immagini, attorno al centro
    ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2)

    const ca = cover(dati.a.ratio, w, h)
    const cb = cover(dati.b.ratio, w, h)
    const da = verso === 'AB' ? ca : cb
    const db = verso === 'AB' ? cb : ca
    const PA = verso === 'AB' ? A : B
    const PB = verso === 'AB' ? B : A

    // L'anello è centrato sull'inquadratura, uguale nei due versi.
    const anCx = w / 2, anCy = h / 2
    const anRx = w * ANELLO_X, anRy = h * ANELLO_Y
    const [t1, t2] = TAPPE

    const lato = DIM_PUNTO
    const mezzo = lato / 2
    ctx.fillStyle = acc

    // alone tenue
    ctx.globalAlpha = oP * 0.16
    disegnaPunti(3.4)
    // nucleo
    ctx.globalAlpha = oP * 0.92
    disegnaPunti(lato)

    function disegnaPunti(dim) {
      const off = dim / 2 - mezzo
      for (let i = 0; i < n; i++) {
        const t = clamp01((m - ritardo[i]) / (1 - SCIA))

        // le quattro tappe del percorso, nel verso giusto
        const ax = da.x + PA[i * 2] * da.w, ay = da.y + PA[i * 2 + 1] * da.h
        const bx = db.x + PB[i * 2] * db.w, by = db.y + PB[i * 2 + 1] * db.h
        const rx = anCx + angCos[i] * anRx
        const ry = anCy + angSin[i] * anRy
        const px = (verso === 'AB' ? ax : bx) + sfx[i] * SFALDA * w
        const py = (verso === 'AB' ? ay : by) + sfy[i] * SFALDA * w

        let x, y
        if (t < t1) {                       // 1. la figura si sfalda
          const e = easeInOut(t / t1)
          x = lerp(ax, px, e); y = lerp(ay, py, e)
        } else if (t < t2) {                // 2. i punti si dispongono in anello
          const e = easeInOut((t - t1) / (t2 - t1))
          x = lerp(px, rx, e); y = lerp(py, ry, e)
        } else {                            // 3. l'anello si chiude sulla figura
          const e = easeInOut((t - t2) / (1 - t2))
          x = lerp(rx, bx, e); y = lerp(ry, by, e)
        }

        ctx.fillRect(x - mezzo - off, y - mezzo - off, dim, dim)
      }
    }

    ctx.globalAlpha = 1
    requestAnimationFrame(disegna)
  }

  imgA.style.opacity = 1
  imgB.style.opacity = 0
  requestAnimationFrame(disegna)
}
