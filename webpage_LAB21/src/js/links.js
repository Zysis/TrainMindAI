import { site } from './config.js'
import { langChosen } from './i18n.js'

/**
 * Parametri di campagna da tramandare a TrainMind.
 *
 * Il visitatore arriva qui con `?utm_source=...` da un annuncio o da un post,
 * poi clicca "Scopri di piu'" e passa all'app. Senza riattaccarli al link,
 * quei parametri finiscono qui e nella console di amministrazione l'iscritto
 * risulta arrivato da nessuna parte.
 *
 * Niente cookie e niente storage: il sito e' una pagina sola, quindi
 * l'indirizzo del browser conserva i parametri per tutta la visita ed e' gia'
 * la memoria che serve. Un dato in meno da chiedere nel banner dei consensi.
 */
const CAMPAIGN_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  // `k` non e' una campagna: e' il token che apre le registrazioni quando sono
  // chiuse al pubblico. Viaggia con gli altri perche' fa lo stesso percorso.
  'k'
]

function campaignParams() {
  const here = new URLSearchParams(window.location.search)
  const out = new URLSearchParams()

  CAMPAIGN_KEYS.forEach((key) => {
    const value = here.get(key)
    if (value) out.set(key, value.slice(0, 500))
  })

  // La provenienza vera la vede solo questo sito: quando l'utente sara' sulla
  // pagina di registrazione, il suo referrer saremo noi, che non dice niente.
  // Per questo la inoltriamo esplicitamente.
  if (document.referrer) {
    try {
      const from = new URL(document.referrer)
      if (from.hostname !== window.location.hostname) {
        out.set('ref', document.referrer.slice(0, 500))
      }
    } catch {
      /* referrer malformato: si ignora */
    }
  }

  // Da quale pagina del sito e' partito il clic.
  out.set('landing', window.location.pathname.slice(0, 500))

  // La lingua della vetrina: TrainMind si apre nella stessa. `lang_set`
  // distingue la scelta fatta a mano dall'inglese di default, cosi' per chi
  // ha gia' un account la lingua del profilo vince sul default ma non su una
  // scelta esplicita.
  const lang = document.documentElement.lang
  if (lang) {
    out.set('lang', lang)
    if (langChosen()) out.set('lang_set', '1')
  }

  return out.toString()
}

function withCampaign(href) {
  const params = campaignParams()
  if (!params) return href
  return href.includes('?') ? `${href}&${params}` : `${href}?${params}`
}

/**
 * Applica i link definiti in config.js agli elementi con data-link="chiave"
 * e i testi agli elementi con data-text="chiave" (email, vat).
 * Aggiorna anche l'anno nel footer (data-year).
 */
export function applyLinks() {
  applyHrefs()

  document.querySelectorAll('[data-text]').forEach((el) => {
    const key = el.dataset.text
    if (key === 'email') el.textContent = site.email
    if (key === 'vat') el.textContent = site.vat
  })

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear()
  })

  // Cambio lingua dallo switcher: il link verso TrainMind va riscritto
  window.addEventListener('lab21:lang', applyHrefs)
}

function applyHrefs() {
  const mailto = `mailto:${site.email}?subject=${encodeURIComponent(site.emailSubject)}`

  document.querySelectorAll('[data-link]').forEach((el) => {
    const key = el.dataset.link
    const base = key === 'email' ? mailto : site.links[key]
    if (!base) return
    // Solo il link verso TrainMind porta con se' i parametri: agli altri
    // (social, email) non servono e sarebbe solo rumore negli indirizzi.
    const href = key === 'trainmind' ? withCampaign(base) : base
    el.setAttribute('href', href)
    // Nuova scheda per i link fuori dal sito. `data-link-blank` lo impone
    // anche quando l'indirizzo è relativo: in produzione TrainMind sta in
    // un sottopercorso dello stesso dominio (/app), ma resta un'altra
    // applicazione e la vetrina deve restare aperta dietro.
    if (href.startsWith('http') || el.hasAttribute('data-link-blank')) {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener')
    }
  })
}
