import it from '../i18n/it.json'
import en from '../i18n/en.json'
import es from '../i18n/es.json'

/* Per aggiungere una lingua: creare src/i18n/<codice>.json con le stesse
   chiavi, importarlo qui, aggiungerlo a "dict" e aggiungere il pulsante
   in src/sections/nav.html. */
const dict = { it, en, es }
const STORAGE_KEY = 'lab21.lang'
/** Presente solo se il visitatore ha cliccato lo switcher (non per il default) */
const CHOSEN_KEY = 'lab21.lang.chosen'

/** true se la lingua corrente e' stata scelta a mano dal visitatore */
export function langChosen() {
  try { return localStorage.getItem(CHOSEN_KEY) === '1' } catch (_) { return false }
}
/** Lingua con cui si presenta il sito a chi non ha ancora scelto. */
const DEFAULT_LANG = 'en'

/** Applica la lingua a tutta la pagina e la salva nel browser. */
export function setLang(lang) {
  if (!dict[lang]) lang = DEFAULT_LANG
  const t = dict[lang]

  document.documentElement.lang = lang

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t[el.dataset.i18n]
    if (v !== undefined) el.textContent = v
  })
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = t[el.dataset.i18nHtml]
    if (v !== undefined) el.innerHTML = v
  })

  document.querySelectorAll('.lang button').forEach((b) => {
    b.classList.toggle('on', b.dataset.lang === lang)
  })

  try { localStorage.setItem(STORAGE_KEY, lang) } catch (_) {}

  // I link verso TrainMind portano con se' la lingua: li aggiorna links.js
  window.dispatchEvent(new CustomEvent('lab21:lang', { detail: lang }))
}

/**
 * Lingua iniziale: quella salvata, altrimenti inglese per tutti.
 *
 * Fino all'11/08/2026 si guardava `navigator.language`, così un visitatore
 * italiano vedeva il sito in italiano. È stato tolto di proposito: il
 * laboratorio si presenta in inglese a chiunque arrivi, e chi preferisce
 * l'italiano lo sceglie dai pulsanti in barra — da lì in poi se lo ritrova.
 */
export function initLang() {
  let saved = null
  try { saved = localStorage.getItem(STORAGE_KEY) } catch (_) {}
  setLang(dict[saved] ? saved : DEFAULT_LANG)

  document.querySelectorAll('.lang button').forEach((b) => {
    b.addEventListener('click', () => {
      try { localStorage.setItem(CHOSEN_KEY, '1') } catch (_) {}
      setLang(b.dataset.lang)
    })
  })
}
