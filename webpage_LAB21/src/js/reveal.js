/** Comparsa progressiva degli elementi con classe .rv allo scroll. */
export function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    })
  }, { threshold: 0.14 })
  document.querySelectorAll('.rv').forEach((n) => io.observe(n))
}
