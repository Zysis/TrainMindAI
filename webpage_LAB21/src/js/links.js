import { site } from './config.js'

/**
 * Applica i link definiti in config.js agli elementi con data-link="chiave"
 * e i testi agli elementi con data-text="chiave" (email, vat).
 * Aggiorna anche l'anno nel footer (data-year).
 */
export function applyLinks() {
  const mailto = `mailto:${site.email}?subject=${encodeURIComponent(site.emailSubject)}`

  document.querySelectorAll('[data-link]').forEach((el) => {
    const key = el.dataset.link
    const href = key === 'email' ? mailto : site.links[key]
    if (!href) return
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

  document.querySelectorAll('[data-text]').forEach((el) => {
    const key = el.dataset.text
    if (key === 'email') el.textContent = site.email
    if (key === 'vat') el.textContent = site.vat
  })

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear()
  })
}
