/* ============================================================
   LAB21 — indice delle pagine legali

   Il corpo del documento arriva da i18n.js, che lo inietta con
   innerHTML e lo rifà da capo a ogni cambio lingua. Per questo
   l'indice non si costruisce una volta sola: un MutationObserver
   lo rigenera ogni volta che il testo cambia, così le voci sono
   sempre nella lingua giusta e gli ancoraggi restano validi.
   ============================================================ */

/** Slug stabile per l'ancora, indipendente dalla lingua. */
function slug(text, i) {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // via gli accenti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base ? `s-${i + 1}-${base}`.slice(0, 60) : `s-${i + 1}`
}

function build(body, toc) {
  const headings = [...body.querySelectorAll('h2')]
  if (!headings.length) {
    toc.innerHTML = ''
    return []
  }

  const items = headings.map((h, i) => {
    h.id = slug(h.textContent, i)
    return { id: h.id, text: h.textContent, el: h }
  })

  // Il titolo dell'indice segue la lingua del documento: lo prendiamo
  // dall'attributo lang, senza aggiungere chiavi ai dizionari.
  const label =
    { it: 'In questa pagina', es: 'En esta página' }[document.documentElement.lang] ||
    'On this page'

  toc.innerHTML =
    `<h2>${label}</h2><ol>` +
    items.map((it) => `<li><a href="#${it.id}">${it.text}</a></li>`).join('') +
    '</ol>'

  return items
}

/** Evidenzia nell'indice la sezione che si sta leggendo. */
function spy(items, toc) {
  if (!items.length || !('IntersectionObserver' in window)) return null

  const links = new Map(
    [...toc.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]),
  )
  const visible = new Set()

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target.id)
        else visible.delete(e.target.id)
      }
      // Attiva la prima sezione visibile in ordine di documento.
      const current = items.find((it) => visible.has(it.id))
      links.forEach((a, id) => a.classList.toggle('on', !!current && id === current.id))
    },
    // La fascia esclude la barra in alto e gran parte della metà inferiore:
    // così "attiva" è la sezione in cima allo schermo, non l'ultima passata.
    { rootMargin: '-90px 0px -65% 0px' },
  )

  items.forEach((it) => io.observe(it.el))
  return io
}

export function initLegalToc() {
  const body = document.querySelector('.legal-body')
  const toc = document.querySelector('.legal-toc')
  if (!body || !toc) return

  let io = null
  const refresh = () => {
    if (io) io.disconnect()
    io = spy(build(body, toc), toc)
  }

  refresh()

  // i18n.js riscrive .legal-body a ogni cambio lingua: ricostruiamo.
  new MutationObserver(refresh).observe(body, { childList: true })
}
