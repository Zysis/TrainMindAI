/* ============================================================
   LAB21 — punto di ingresso
   ============================================================ */
import '../styles/main.css'
import { initLang } from './i18n.js'
import { applyLinks } from './links.js'
import { initNav } from './nav.js'
import { initReveal } from './reveal.js'
import { initCounters } from './counters.js'
import { initVideo } from './video.js'
import { initHeroMorph } from './hero-morph.js'

applyLinks()
initLang()
initNav()
initReveal()
initCounters()
initVideo()
initHeroMorph()
