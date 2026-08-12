/** La navbar diventa bianca dopo l'hero. */
export function initNav() {
  const nav = document.getElementById('nav')
  if (!nav) return
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > window.innerHeight * 0.82)
  onScroll()
  addEventListener('scroll', onScroll, { passive: true })
}
