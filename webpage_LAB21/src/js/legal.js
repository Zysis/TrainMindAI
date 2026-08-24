/* ============================================================
   LAB21 — punto di ingresso delle pagine legali
   Serve solo lingua + link dinamici (email, P.IVA, anno):
   niente hero, contatori, video o reveal.
   ============================================================ */
import '../styles/main.css'
import '../styles/legal.css'
import { initLang } from './i18n.js'
import { applyLinks } from './links.js'
import { initLegalToc } from './legal-toc.js'

applyLinks()
initLang()
// Dopo initLang: il testo è già nella pagina, così l'indice parte completo.
initLegalToc()
